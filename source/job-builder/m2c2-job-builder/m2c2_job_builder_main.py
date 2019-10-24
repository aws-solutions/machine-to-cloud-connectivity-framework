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
import logging
import os


import m2c2_s3_handler as s3
import m2c2_ddb_handler as ddb
import m2c2_post_handler as post
import m2c2_utils as utils
import m2c2_json_checks as json_check
import m2c2_metrics as metrics
import m2c2_greengrass_handler as gg
import m2c2_protocol_converter as build
import m2c2_globals as var

logger = logging.getLogger()
logger.setLevel(logging.INFO)
enable_metrics = os.environ["MET_ENB"]

# AWS Resource and clients
iot_client = boto3.client('iot-data')

job_in_ddb = ""

class process_control:
    def __init__(self, job_request):
        validated_job_schema = json_check.check_schema(job_request)
        if validated_job_schema:
            self.run(validated_job_schema)
        else:
            post.to_user("", "", "error", var.m2c2_err_json_schema)
        return

    def run(self, user_job_request):
        if utils.get_metadata("control",user_job_request,0) == "start":
            return self.start(user_job_request)
        elif utils.get_metadata("control",user_job_request,0) == "stop":
            return self.stop(user_job_request)
        elif utils.get_metadata("control",user_job_request,0)== "push":
            return self.push(user_job_request)
        elif utils.get_metadata("control",user_job_request,0) == "pull":
            return self.pull(user_job_request)
        elif utils.get_metadata("control",user_job_request,0) == "update":
            return self.update(user_job_request)
        elif utils.get_metadata("control",user_job_request,0) == "deploy":
            return self.deploy(user_job_request)

    def deploy(self, user_job_request):
        job_name = utils.get_metadata("name",user_job_request,0)
        job_version = utils.get_metadata("version",user_job_request,0)
        control = utils.get_metadata("control",user_job_request,0)

        if ddb.valid_job_request(job_name, job_version, control):
            logger.info("Setting greengrass group")
            connector = gg.generate_greengrass_resources(user_job_request)
            if not connector.create_gg_definitions():
                return 0
            else:
                # write raw job to s3
                logger.info("Writing raw job to s3")
                if not s3.write(user_job_request,"raw"): 
                    connector.delete_gg_definitions()
                    return 0
                # build job as per protocol
                logger.info("Processing job request")
                processed_job_request = build.job(user_job_request)
                if not processed_job_request:
                    connector.delete_gg_definitions()
                    return 0
                # write process job to s3
                logger.info("Writing processed job to s3")
                if not s3.write(processed_job_request,"json"): 
                    connector.delete_gg_definitions()
                    return 0
                # update DynamoDB as all other jobs on this gg group id will stop during manual deployment
                logger.info("Updating datase to stop all jobs for the group id")
                if not ddb.update(job_name, job_version, control, user_job_request): 
                    connector.delete_gg_definitions()
                    return 0
                # create an entry in DynamoDB
                logger.info("Creating database entry")
                if not ddb.write(user_job_request): 
                    connector.delete_gg_definitions()
                    return 0
                # collect metrics
                if os.environ["MET_ENB"].lower() == "true":
                    metrics.get_metrics(user_job_request)
                # prompt user to deploy via the console
                post.to_user(job_name, job_version, "info", var.m2c2_user_deploy_request)
                return 1
        else:
            return 0

    def start(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            job_control = utils.get_metadata("control",user_job_request,0)
            if ddb.valid_job_request(job_name, job_version, job_control):
                stored_job_request = s3.read(job_name, job_version)
                if not stored_job_request: 
                    return 0
                if not ddb.update(job_name, job_version, job_control,""): 
                    return 0
                stored_job_request["job"]["control"] = "start"
                post.to_lambda(job_name, stored_job_request)
            else:
                return 0

    def stop(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            job_control = utils.get_metadata("control",user_job_request,0)
            if ddb.valid_job_request(job_name, job_version, job_control):
                stored_job_request = s3.read(job_name, job_version)
                if not stored_job_request: 
                    return 0
                if not ddb.update(job_name, job_version, job_control, stored_job_request): 
                    return 0
                stored_job_request["job"]["control"] = "stop"
                del stored_job_request["job"]["machine-details"]
                post.to_lambda(job_name, stored_job_request)
            else:
                return 0

    def update(self, user_job_request):
        job_name = utils.get_metadata("name",user_job_request,0)
        job_version = utils.get_metadata("version",user_job_request,0)
        job_control = utils.get_metadata("control",user_job_request,0)
        if ddb.valid_job_request(job_name, job_version, job_control):
            # build job as per protocol
            processed_job_request = build.job(user_job_request)
            if not processed_job_request:
                return 0
            # write process job to s3
            if not s3.write(processed_job_request,"json"):
                return 0
            # update DynamoDB as all other jobs on this gg group id will stop during manual deployment
            if not ddb.update(job_name, job_version, job_control, ""):
                return 0
            # create an entry in DynamoDB
            if not ddb.write(user_job_request):
                return 0
            post.to_lambda(job_name, processed_job_request)
        else:
            return 0
        return 1

    def push(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            job_control = utils.get_metadata("control",user_job_request,i)
            if ddb.valid_job_request(job_name, job_version, job_control):
                stored_job_request = s3.read(job_name, job_version)
                if not stored_job_request: 
                    return 0
                stored_job_request["job"]["control"] = "push"
                post.to_lambda(job_name, stored_job_request)
            else:
                return 0

    def pull(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_control = utils.get_metadata("control",user_job_request,0)
            if ddb.valid_job_request(job_name, "", job_control):
                post.to_lambda(job_name, user_job_request)
            else:
                return 0
        return 1

def lambda_handler(event, context):
    process_control(event)
    return