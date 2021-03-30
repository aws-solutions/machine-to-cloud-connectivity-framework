## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime
import logging
import os
import json

import m2c2_post_handler as post
import m2c2_utils as utils
import m2c2_globals as var
import m2c2_job_builder_main
import m2c2_s3_handler as s3


logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Resource and clients
ddb_client = boto3.resource('dynamodb', config=utils.get_boto_config())

ddb_table = ddb_client.Table(os.environ["JOB_DYNAMODB_TABLE"])


def valid_job_request(job_name):
    global job_in_ddb
    job_in_ddb = read_ddb_jobid(job_name)
    return 1

# This functions retrieves all ddb job entries for a given job name
def read_ddb_jobid(job_name):
    try:
        return ddb_table.query(KeyConditionExpression=Key("jobid").eq(job_name))
    except:
        post.to_user(job_name, "", "error", var.m2c2_ddb_access % ddb_table)
        return 0

# This functions extract the details of a job version from a list of job names
def get_job_details(job_version):
    global job_in_ddb
    for i in job_in_ddb['Items']:
        if i["version"] == int(job_version):
            return(i)
    return 0

# This functions checks whether oter versions of a named job are started
def write(user_job_request):
    job_name = utils.get_metadata("name",user_job_request,0)
    job_protocol = utils.get_metadata("protocol",user_job_request,0)
    control = utils.get_metadata("control",user_job_request,0)
    job_version = utils.get_metadata("version",user_job_request,0)

    try:
        # first ensure that optional keys have a value that can be written to ddb
        na = "not specified"
        site = utils.get_metadata("site-name",user_job_request,0)
        if site == "":
            site = na

        area = utils.get_metadata("area",user_job_request,0)
        if area == "":
            area = na

        process = utils.get_metadata("process",user_job_request,0)
        if process == "":
            process = na

        machine = utils.get_metadata("machine-name",user_job_request,0)
        if machine == "":
            machine = na

        if not job_version:
            job_versions = retrieve_entry_value(user_job_request, "version")["Items"]
            if control == "deploy":
                job_version = max([item.get("version", 0) for item in job_versions], default=0) + 1
            else:
                if not job_versions:
                    logger.error("There is no job entry by the name {0} to {1}".format(job_name, control))
                    return 0
                else:
                    job_version = max([item["version"] for item in job_versions], default=1)


        ddb_table.put_item(
            Item={"jobid": job_name,
                  "control": control,
                  "properties": utils.get_metadata("properties", user_job_request,0),
                  "version": int(job_version),
                  "gggroupid": utils.get_metadata("gg-group-id",user_job_request,0),
                  "machine-details": utils.get_metadata("machine-details",user_job_request,0),
                  "process": process,
                  "site": site,
                  "area": area,
                  "machine": machine,
                  "data_parameters": utils.get_metadata("data-parameters",user_job_request,0),
                  "machine_query_iterations": utils.get_metadata("machine-query-iterations", user_job_request,0),
                  "machine_query_time_interval": utils.get_metadata("machine-query-time-interval",user_job_request,0),
                  "attributes": utils.get_metadata("protocol",user_job_request,0),
                  "protocol": job_protocol,
                  "address": utils.get_metadata("machine-ip",user_job_request,0),
                  "job_details": json.dumps(user_job_request),
                  "timestamp": datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f")
                  })
        return job_version
    except Exception as err:
        logger.error("ddb write traceback:"+ str(err))
        post.to_user(job_name, job_version, "error", var.m2c2_ddb_access % ddb_table)
        return 0

def stop_group_entries(job_name, job_version, user_job_request):
    gg_group_id = utils.get_metadata("gg-group-id",user_job_request,0)
    all_entries = ddb_table.scan()
    last_evaluated_key = all_entries.get('LastEvaluatedKey')
    while last_evaluated_key:
            more_entries = ddb_table.scan()
            all_entries['Items'].extend(more_entries['Items'])
            last_evaluated_key = more_entries.get('LastEvaluatedKey')
    jobs_to_stop = {
        "job": {
            "control": "stop",
            "properties":[]
        }
    }
    other_job_stop_request = False
    for i in range (0, all_entries["Count"]):
        if all_entries["Items"][i]["gggroupid"] == gg_group_id:
            if all_entries["Items"][i]['control'] != "stop":
                other_job_stop_request = True
                jobs_to_stop["job"]["properties"].append({
                    'name': all_entries["Items"][i]['jobid'],
                    'version': str(all_entries["Items"][i]['version'])
                })
    if other_job_stop_request:
        post.to_user(job_name, job_version, "info", var.m2c2_ddb_controller_restart %(jobs_to_stop))
        ddb_controlled_stop(jobs_to_stop)
    return 1

def ddb_controlled_stop(user_job_request):
    for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
        job_name = utils.get_metadata("name",user_job_request,i)
        job_version = utils.get_metadata("version",user_job_request,i)
        job_control = utils.get_metadata("control",user_job_request,0)
        temp_json = {
            "job": {
                "control": job_control,
                "properties": [
                    {
                        "name": job_name,
                        "version": job_version
                    }
                ]
            }
        }
        post.to_lambda(job_name, temp_json)
    else:
        return 0

def stop_name_entries(job_name, job_version):
    global job_in_ddb
    for i in range (0,job_in_ddb["Count"]):
        try:
            ddb_table.update_item(
                Key={
                'jobid': job_name,
                'version': job_in_ddb["Items"][i]['version']
                },
                UpdateExpression="set #t =:t, control =:c",
                ExpressionAttributeValues={
                    ':t': datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                    ':c': "stop"
                },
                ExpressionAttributeNames={"#t": "timestamp"}
                )
        except Exception as err:
            logger.error("ddb update - update traceback:"+ str(err))
            post.to_user(job_name, job_version, "error", var.m2c2_ddb_access % ddb_table)
            return 0
    return 1

# After a Greengrass deploy, all running jobs will be stopped as the lambda functions are redeployed to the edge device. Will go through and start all jobs that should be running
def start_jobs_after_gg_deploy(user_job_request):
    gg_group_id = utils.get_metadata("gg-group-id",user_job_request,0)
    job_name = utils.get_metadata("name",user_job_request,0)
    jobs_to_restart = []
    try:
        all_entries = ddb_table.scan(Select='ALL_ATTRIBUTES', FilterExpression=Attr('control').eq('start'))
        last_evaluated_key = all_entries.get('LastEvaluatedKey')
        while last_evaluated_key:
            more_entries = ddb_table.scan(Select='ALL_ATTRIBUTES', FilterExpression=Attr('control').eq('start'), ExclusiveStartKey=last_evaluated_key)
            all_entries['Items'].extend(more_entries['Items'])
            last_evaluated_key = more_entries.get('LastEvaluatedKey')
        for entry in all_entries['Items']:
            if job_name != entry['jobid'] and entry['gggroupid'] == gg_group_id:
                job_version = str(entry['version'])
                temp_json = {
                        "job": {
                            "control": entry['control'],
                            "properties": [
                                {
                                    "name": entry['jobid'],
                                    "version": job_version
                                }
                            ]
                        }
                    }
                jobs_to_restart.append(temp_json)
        return jobs_to_restart
    except Exception as err:
        logger.error("ddb update - update traceback:"+ str(err))
        post.to_user(job_name, job_version, "error", var.m2c2_jobs_to_restart %(str(err)))
        return 0

def retrieve_entry_value(user_job_request, attribute):
    job_name = utils.get_metadata("name",user_job_request,0)
    try:
       job_value = ddb_table.query(Select='SPECIFIC_ATTRIBUTES', ProjectionExpression=attribute, KeyConditionExpression=Key('jobid').eq(job_name))
       return job_value
    except Exception as err:
        logger.error("ddb version - retrieve traceback:"+ str(err))
        post.to_user(job_name, "", "error", var.m2c2_ddb_retrieving_values %(str(job_name), str(err)))
        return 0


def update(job_name, job_version, job_control, user_job_request):
    global job_in_ddb
    # Update key items control and timestamp everytime an action on the job is performed.
    if job_control == "deploy":
        # all ddb entries in the group must be stopped
        return stop_group_entries(job_name, job_version, user_job_request)

    elif job_control == "update":
        # all ddb entries for the job name must be stopped
        return stop_name_entries(job_name, job_version)

    elif job_control in ["start", "stop"]:
        job_detail = get_job_details(job_version)
        if not (job_detail["control"] == job_control):
            try:
                ddb_table.update_item(
                    Key={
                        'jobid': job_name,
                        'version': int(float(str(job_version)))
                    },
                    UpdateExpression="set #t =:t, control =:c",
                    ExpressionAttributeValues={
                        ':t': datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                        ':c': job_control
                    },
                    ExpressionAttributeNames={"#t": "timestamp"}
                )
            except Exception as err:
                logger.error("ddb update - start stop traceback:"+ str(err))
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_access % ddb_table)
                return 0
        return 1
    return 0
