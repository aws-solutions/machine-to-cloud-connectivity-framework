## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import boto3
from boto3.dynamodb.conditions import *
from datetime import datetime
import logging
import os

import m2c2_post_handler as post
import m2c2_utils as utils
import m2c2_globals as var
import m2c2_job_builder_main
import m2c2_s3_handler as s3


logger = logging.getLogger()
logger.setLevel(logging.INFO)

ddb_client = boto3.resource('dynamodb')
ddb_table = ddb_client.Table(os.environ["JBM_TBL"])


def valid_job_request(job_name, job_version, job_control):
    global job_in_ddb
    job_in_ddb = read_ddb_jobid(job_name, job_version)
    if job_in_ddb:
        checked_job = check_job(job_name, job_version)
        other_running = other_job_running(job_name, job_version)
        
        if job_control == "deploy":
            if checked_job == 0:
                return 1
            else:
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_exists %(job_name))
                return 0

        elif job_control == "update":
            if checked_job == 1:
                return 1
            else:
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_version_must_be_unique %(job_name, job_version))
                return 0

        elif job_control == "stop":
            if checked_job == 2:
                return 1
            else:
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_version_must_be_unique %(job_name, job_version))
                return 0

        elif job_control == "pull":
            if checked_job > 0:
                return 1
            else:
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_does_not_exist %(job_name))
                return 0

        elif job_control == "push":
            if checked_job == 2:
                return 1
            else:
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_version_must_be_unique %(job_name, job_version))
                return 0
        
        elif job_control == "start":
            if checked_job == 2 and not other_running:
                return 1
            else:
                if other_running:
                    post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_running %(job_name))
                    return 0
                else:
                    post.to_user(job_name, job_version, "error", var.m2c2_ddb_job_name_version_must_be_unique %(job_name, job_version))
                    return 0
    else:
        return 0

# This functions retrieves all ddb job entries for a given job name
def read_ddb_jobid(job_name, job_version):
    try:
        return ddb_table.query(KeyConditionExpression=Key("jobid").eq(job_name))
    except Exception as err:
        post.to_user(job_name, job_version, "error", var.m2c2_ddb_access %(os.environ["JBM_TBL"]))
        return 0

# This functions extract the details of a job version from a list of job names
def get_job_details(job_version):
    global job_in_ddb
    for i in range(0, job_in_ddb["Count"]):
        if str(job_in_ddb["Items"][i]["version"]) == job_version:
            return job_in_ddb["Items"][i]
    return 0

# This function checks whether a job name exist, with a requested version and is unique
def check_job(job_name, job_version):
    global job_in_ddb
    if job_in_ddb["Count"] == 0:
        # name does not exist
        return 0
    else:
        version_count = 0
        for i in range(0, job_in_ddb["Count"]):
            if str(job_in_ddb["Items"][i]["version"]) == job_version:
                version_count += 1
        if version_count == 1:
            # name and version is unique
            return 2
        elif version_count > 1:
            # multiple name and version
            return -1
        elif version_count == 0:
            # name exists but version not found
            return 1

# This functions checks whether oter versions of a named job are started
def other_job_running(job_name, job_version):
    global job_in_ddb
    for i in range(0, job_in_ddb["Count"]):
        if job_in_ddb["Items"][i]["control"] == "start" and  str(job_in_ddb["Items"][i]["version"]) != job_version :
            return 1
    return 0

def write(user_job_request):
    job_name = utils.get_metadata("name",user_job_request,0)
    job_version = utils.get_metadata("version",user_job_request,0)
    job_protocol = utils.get_metadata("protocol",user_job_request,0)

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
 
        ddb_table.put_item(
            Item={"jobid": job_name,
                  "timestamp": datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                  "site": site,
                  "area": area,
                  "process": process,
                  "version": int(job_version),
                  "s3 bucket": "https://" + os.environ["JBM_BCK"] + ".s3-" + os.environ["AWS_REGION"] + ".amazonaws.com" + "/" + job_protocol + "-" + os.environ["JBM_KEY"] + job_name + "#v" + job_version + ".json",
                  "control": utils.get_metadata("control",user_job_request,0),
                  "gggroupid": utils.get_metadata("gg-group-id",user_job_request,0),
                  "machine": machine,
                  "protocol": utils.get_metadata("protocol",user_job_request,0),
                  "address": utils.get_metadata("machine-ip",user_job_request,0)
                  })
        return 1
    except Exception as err:
        logger.info("ddb write traceback:"+ str(err))
        post.to_user(job_name, job_version, "error", var.m2c2_ddb_access %(os.environ["JBM_TBL"]))
        return 0

def stop_group_entries(job_name, job_version, user_job_request):
    gg_group_id = utils.get_metadata("gg-group-id",user_job_request,0)
    all_entries = ddb_table.scan()
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
            try:
                ddb_table.update_item(
                    Key={
                        'jobid': all_entries["Items"][i]['jobid'],
                        'version': all_entries["Items"][i]['version']
                    },
                    UpdateExpression="set #t =:t, control =:c",
                    ExpressionAttributeValues={
                        ':t': datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                        ':c': "stop"
                    },
                    ExpressionAttributeNames={"#t": "timestamp"}
                )
            except Exception as err:
                logger.info("ddb update - deploy traceback:"+ str(err))
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_access %(os.environ["JBM_TBL"]))
                return 0
    if other_job_stop_request:
        logger.info("jobs to stop: " + str(jobs_to_stop))
        post.to_user(job_name, job_version, "info", var.m2c2_ddb_controller_stop %(jobs_to_stop))
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
            logger.info("ddb update - update traceback:"+ str(err))
            post.to_user(job_name, job_version, "error", var.m2c2_ddb_access %(os.environ["JBM_TBL"]))
            return 0
    return 1    

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
        if (job_detail["control"] == job_control):
                post.to_user(job_name, job_version, "error", var.m2c2_ddb_update_already %(job_control))
        else:
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
                 logger.info("ddb update - start stop traceback:"+ str(err))
                 post.to_user(job_name, job_version, "error", var.m2c2_ddb_access %(os.environ["JBM_TBL"]))
                 return 0
        return 1
    return 0
