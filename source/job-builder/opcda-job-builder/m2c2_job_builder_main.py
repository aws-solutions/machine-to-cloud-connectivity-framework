#####################################################################################################################
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                   #
# Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
# with the License. A copy of the License is located at                                                             #
#                                                                                                                   #
#     http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                   #
# or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES #
# OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing         #
# permissions and limitations under the License.                                                                    #
######################################################################################################################


import json
import boto3
from boto3.dynamodb.conditions import *
from datetime import datetime
import logging
import os
import sys as sys

import m2c2_greengrass_group_creation as resources
import m2c2_job_builder_messages as msg
import m2c2_job_builder_lib as lib

logger = logging.getLogger()
logger.setLevel(logging.INFO)
enable_metrics = os.environ["MET_ENB"]

reference_bucket = os.environ["JBM_BCK"]
reference_key = os.environ["JBM_KEY"]
reference_table = os.environ["JBM_TBL"]

# AWS Resource and clients
iot_client = boto3.client('iot-data')
s3_client = boto3.resource('s3')
ddb_client = boto3.resource('dynamodb')
ddb_table = ddb_client.Table(reference_table)



# Function to post properly formated JSON to the conector lamdba running in on the edge device
def post_to_lambda(job_name, message):
    global enable_metrics
    if enable_metrics.lower() == "true":
        lib.get_metrics(message)
    topic = "m2c2/job/" + job_name + "/submit"
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(message)
    )


def write_to_s3(user_job_request):
    job_name = user_job_request["job"]["properties"][0]["name"]
    job_version = user_job_request["job"]["properties"][0]["version"]
    global reference_bucket, reference_key
    s3object = s3_client.Object(reference_bucket, reference_key + job_name + "#v" + job_version + ".json")
    try:
        s3object.put(Body=(bytes(json.dumps(user_job_request).encode('UTF-8'))))
        return 1
    except Exception as err:
        logger.info("traceback:"+ str(err))
        lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_S3_READ_FAILURE %(reference_key + job_name + "#v" + job_version + ".json",reference_bucket))
        return ""


def read_from_s3(job_name, job_version):
    global reference_bucket, reference_key
    s3object = s3_client.Object(reference_bucket, reference_key +
                                job_name + "#v" +
                                job_version + ".json")
    try:
        return json.loads(s3object.get()['Body'].read().decode('utf-8'))
    except Exception as err:
        logger.info("traceback:"+ str(err))
        lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_S3_WRITE_FAILURE %(reference_key + job_name + "#v" + job_version + ".json",reference_bucket))
        return ""


# Returns TRUE if a job version exists in the database for the job name
def check_job_version_exists(job_name, job_version):
    # This function checks whether the user requested job version already exists. If mutliple entries are found, an error is flagged.
    try:
        job_in_ddb = ddb_table.query(
            KeyConditionExpression=
            Key("jobid").eq(job_name) &
            Key("version").eq(int(float(str(job_version)))))
    except Exception as err:
        logger.info("traceback:"+ str(err))
        lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_DDB_QUERY_FAILURE)
        return ""
    else:
        if job_in_ddb["Count"] == 0:
            return False
        elif job_in_ddb["Count"] == 1:
            return True
        else:
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_DDB_MULTIPLE_ENTRIES_FOUND)
            logger.info(msg.ERR_MSG_DDB_MULTIPLE_ENTRIES_FOUND)
            return ""


# Returns TRUE if a job name exists. Note: this implies the greengrass resources required to perform the job have already been deployed
def check_job_name_exists(job_name, job_version):
    try:
        job_in_ddb = ddb_table.query(KeyConditionExpression=Key("jobid").eq(job_name))
    except Exception as err:
        logger.info("traceback:"+ str(err))
        lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_DDB_QUERY_FAILURE)
        return ""
    else:
        return job_in_ddb["Count"]

def write_to_ddb(user_job_request):
    job_name = user_job_request["job"]["properties"][0]["name"]
    job_version = user_job_request["job"]["properties"][0]["version"]
    job_control = user_job_request["job"]["control"]

    if job_control == "update":
        # Change any entries entries for this job name to "stop"
        job_in_ddb = ddb_table.query(KeyConditionExpression=Key("jobid").eq(job_name))
        for i in range (0,job_in_ddb["Count"]):
            if (job_in_ddb["Items"][i]["control"] == "start") or (job_in_ddb["Items"][i]["control"] == "update"):
                try:
                    ddb_table.update_item(
                            Key={
                                'jobid': job_in_ddb["Items"][i]["jobid"],
                                'version': job_in_ddb["Items"][i]["version"]
                            },
                            UpdateExpression="set #t =:t, control =:c",
                            ExpressionAttributeValues={
                                ':t': datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                                ':c': "stop"
                            },
                            ExpressionAttributeNames={"#t": "timestamp"}
                        )
                except:
                    lib.post_to_user(job_name, job_version, "error",msg.ERR_MSG_DDB_UPDATE_FAILURE %(reference_table))
                    logger.info(msg.ERR_MSG_DDB_UPDATE_FAILURE %(reference_table))
                    return ""

    # get greengrass group id to also store in the ddb
    gg_group_id = ""
    if job_control == "deploy":
        if "gg_group_id" in user_job_request["job"]:
            gg_group_id = user_job_request["job"]["gg_group_id"]
        else:
            gg_group_id = os.environ["GGG_ID"]
    elif job_control == "update":
        for i in range (0, job_in_ddb["Count"]):
            if "gggroupid" in job_in_ddb["Items"][i]:
                if job_in_ddb["Items"][i]["gggroupid"] != "":
                    gg_group_id = job_in_ddb["Items"][i]["gggroupid"]

    try:
        ddb_table.put_item(
            Item={"jobid": job_name,
                  "timestamp": datetime.now().strftime("%d/%m/%Y,%H:%M:%S.%f"),
                  "site": user_job_request["job"]["machine-details"]["site-name"],
                  "area": user_job_request["job"]["machine-details"]["area"],
                  "process": user_job_request["job"]["machine-details"]["process"],
                  "version": int(float(str(job_version))),
                  "s3 bucket": "https://" + reference_bucket + ".s3-" + os.environ["AWS_REGION"] + ".amazonaws.com" + " / " + reference_key + job_name + "#v" + job_version + ".json",
                  "control": job_control,
                  "gggroupid": gg_group_id,
                  "machine": user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-name"],
                  "protocol": user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"]
                  })
        return 1
    except:
        lib.post_to_user(job_name, job_version, "error",msg.ERR_MSG_DDB_WRITE_FAILURE %(reference_table))
        logger.info(msg.ERR_MSG_DDB_WRITE_FAILURE %(reference_table))
        return ""

def scan_for_deploy():
    temp = ddb_table.scan()
    for i in range (0, temp["Count"]):
        if temp["Items"][i]["control"] == "deploy":
            return True
    return False

def update_ddb(job_name, job_version, job_control):
    # Update key items control and timestamp everytime an action on the job is performed.
    if job_control == "start":
        job_in_ddb = ddb_table.query(KeyConditionExpression=Key("jobid").eq(job_name))
        for i in range (0,job_in_ddb["Count"]):
            if (job_in_ddb["Items"][i]["control"] == "start") or (job_in_ddb["Items"][i]["control"] == "update"):
                #perform tablescan for any job name in deploy state
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
                    logger.info(err)

    if job_control == "stop":
        job_in_ddb = ddb_table.query(
            KeyConditionExpression=
            Key("jobid").eq(job_name) &
            Key("version").eq(int(float(str(job_version)))))
        if (job_in_ddb["Items"][0]["control"] == "stop"):
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_FAIL_ALREADY_STOP)
                logger.info(msg.ERR_MSG_FAIL_ALREADY_STOP)
                return ""

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
        return 1
    except:
        lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_DDB_UPDATE_FAILURE %(reference_table))
        logger.info(msg.ERR_MSG_DDB_UPDATE_FAILURE %(reference_table))
        return ""


class process_control:
    def __init__(self, job_request):
        if job_request["job"]["control"].lower() not in ["start", "stop", "push", "pull", "update", "deploy"]:
            lib.post_to_user("","", "error",msg.ERR_MSG_UNKNOWN_CONTROL %(job_request["job"]["control"]))
            logger.info(msg.ERR_MSG_UNKNOWN_CONTROL %(job_request["job"]["control"]))
            return ""
        validated_job_request = lib.json_check(job_request)
        if not validated_job_request: return
        self.run(validated_job_request)
        return

    def run(self, user_job_request):
        if user_job_request["job"]["control"].lower() == "start":
            self.start(user_job_request)
        elif user_job_request["job"]["control"].lower() == "stop":
            self.stop(user_job_request)
        elif user_job_request["job"]["control"].lower() == "push":
            self.push(user_job_request)
        elif user_job_request["job"]["control"].lower() == "pull":
            self.pull(user_job_request)
        elif user_job_request["job"]["control"].lower() == "update":
            self.update(user_job_request)
        elif user_job_request["job"]["control"].lower() == "deploy":
            self.deploy(user_job_request)
        return 1

    def deploy(self, user_job_request):
        global enable_metrics
        job_name = user_job_request["job"]["properties"][0]["name"]
        job_version = user_job_request["job"]["properties"][0]["version"]
        if "gg_group_id" in user_job_request["job"]:
            gg_group_id = user_job_request["job"]["gg_group_id"]
        else:
            gg_group_id = ""
        if check_job_name_exists(job_name, job_version):
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_DEPLOY_JOB_NAME_ALREAD_EXIST)
            logger.info(msg.ERR_MSG_DEPLOY_JOB_NAME_ALREAD_EXIST)
            return ""
        else:
            new_resource = resources.generate_greengrass_resources(job_name, job_version, gg_group_id,user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"])
            if not new_resource.create(job_name, job_version, gg_group_id,user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"]): return ""
            user_job_request = lib.create_job(user_job_request)
            
            if not user_job_request: return ""
            if not write_to_s3(user_job_request): return ""
            if not write_to_ddb(user_job_request): return ""
            if enable_metrics.lower() == "true":
                lib.get_metrics(user_job_request)
            lib.post_to_user(job_name, job_version, "info", msg.INF_MSG_MANUAL_DEPLOY_REQUIRED)

    def start(self, user_job_request):
        for i in range(0, len(user_job_request["job"]["properties"])):
            job_name = user_job_request["job"]["properties"][i]["name"]
            job_version = user_job_request["job"]["properties"][i]["version"]
            if check_job_name_exists(job_name, job_version):
                if check_job_version_exists(job_name, job_version):
                    checked_job_request = read_from_s3(job_name, job_version)
                    if not checked_job_request: return ""
                    if not update_ddb(job_name, job_version, "start"): return ""
                    checked_job_request["job"]["control"] = "start"
                    post_to_lambda(job_name, checked_job_request)
                else:
                    lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                    logger.info(msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                    return ""
            else:
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
                logger.info(msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
                return ""

    def push(self, user_job_request):
        job_name = user_job_request["job"]["properties"][0]["name"]
        job_version = user_job_request["job"]["properties"][0]["version"]
        if check_job_name_exists(job_name, job_version):
            if check_job_version_exists(job_name, job_version):
                user_job_request = read_from_s3(job_name, job_version)
                if not user_job_request: return ""
                if not update_ddb(job_name, job_version, "push"): return ""
                user_job_request["job"]["control"] = "push"
                post_to_lambda(job_name, user_job_request)
            else:
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                logger.info(msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                return ""
        else:
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
            logger.info(msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
            return ""

    def stop(self, user_job_request):
        for i in range(0, len(user_job_request["job"]["properties"])):
            job_name = user_job_request["job"]["properties"][i]["name"]
            job_version = user_job_request["job"]["properties"][i]["version"]
            checked_job_request = {}
            checked_job_request["job"] = {}
            checked_job_request["job"]["properties"] = []
            temp = {}
            temp["name"] = job_name
            temp["version"] = job_version
            checked_job_request["job"]["properties"].append(temp)
            checked_job_request["job"]["control"] = user_job_request["job"]["control"]
            if check_job_name_exists(job_name, job_version):
                if check_job_version_exists(job_name, job_version):
                    if not update_ddb(job_name, job_version, "stop"): return ""
                    post_to_lambda(job_name, checked_job_request)
                else:
                    lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                    logger.info(msg.ERR_MSG_JOB_VERSION %(job_name,job_version,reference_table))
                    return ""
            else:
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
                logger.info(msg.ERR_MSG_JOB_NAME %(job_name,reference_table))
                return ""

    def update(self, user_job_request):
        job_name = user_job_request["job"]["properties"][0]["name"]
        job_version = user_job_request["job"]["properties"][0]["version"]
        if check_job_name_exists(job_name, job_version):
            if check_job_version_exists(job_name, job_version):
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_UPDATE_JOB_ALREADY_EXISTS %(job_name,job_version))
                logger.info(msg.ERR_MSG_UPDATE_JOB_ALREADY_EXISTS %(job_name,job_version))
                return ""
            else:
                user_job_request["job"]["control"] = "update"
                user_job_request = lib.create_job(user_job_request)
                if not write_to_s3(user_job_request): return ""
                if not write_to_ddb(user_job_request): return ""
                post_to_lambda(job_name, user_job_request)
        else:
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_UPDATE_JOB_DOES_NOT_EXISTS %(job_name))
            logger.info(msg.ERR_MSG_UPDATE_JOB_DOES_NOT_EXISTS %(job_name))
            return ""

    def pull(self, user_job_request):
        job_name = user_job_request["job"]["properties"][0]["name"]
        for i in range(0, len(user_job_request["job"]["properties"])):
            if check_job_name_exists(job_name, ""):
                job_name = user_job_request["job"]["properties"][i]["name"]
                checked_job_request = {}
                checked_job_request["job"] = {}
                checked_job_request["job"]["properties"] = []
                temp = {}
                temp["name"] = job_name
                checked_job_request["job"]["properties"].append(temp)
                checked_job_request["job"]["control"] = user_job_request["job"]["control"]
                post_to_lambda(job_name, checked_job_request)
            else:
                lib.post_to_user(job_name, "", "error", msg.ERR_MSG_PULL_JOB_DOES_NOT_EXISTS %(job_name))
                logger.info(msg.ERR_MSG_PULL_JOB_DOES_NOT_EXISTS %(job_name))
                return ""

def lambda_handler(event, context):
    process_control(event)
    return