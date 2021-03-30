## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import json
import boto3
import logging
import os
import time


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

# AWS Resource and clients
iot_client = boto3.client('iot-data', config=utils.get_boto_config())

topic='m2c2/job/request'

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
        job_name = utils.get_metadata("name",user_job_request,0)
        control = utils.get_metadata("control",user_job_request,0)
        logger.info("Received {0} control for job id {1}".format(str(control), str(job_name)))
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
        protocol = utils.get_metadata("protocol",user_job_request,0)
        if ddb.valid_job_request(job_name):
            logger.info("Setting greengrass group")
            connector = gg.generate_greengrass_resources(user_job_request)
            if not connector.create_gg_definitions():
                return 0
            else:
                logger.info("Processing job request")
                processed_job_request = build.job(user_job_request)
                if not processed_job_request:
                    connector.delete_gg_definitions()
                    return 0
                # write process job to s3
                if protocol == 'slmp':
                    logger.info("Writing processed job to s3")
                    if not s3.write(processed_job_request,"json"):
                        connector.delete_gg_definitions()
                        return 0
                # create an entry in DynamoDB
                logger.info("Creating database entry")
                new_job_version = str(ddb.write(user_job_request))
                if not new_job_version:
                    connector.delete_gg_definitions()
                    return 0
                # collect metrics
                if os.environ["SEND_ANONYMOUS_METRIC"] == "Yes":
                    metrics.get_metrics(user_job_request)
                # prompt user to deploy via the console
                post.to_user(job_name, new_job_version, "info", var.m2c2_user_deploy_request)
                logger.info("Deploying to GG edge")
                if not connector.deploy_gg_group():
                    return 0
                logging.info("Starting jobs")
                user_job_request['job']['control'] = "start"
                user_job_request['job']['properties'][0]['version'] = str(new_job_version)
                logger.info("Sending the following to the IoT topic {0}: {1}".format(topic, str(user_job_request)))
                try:
                    resp = iot_client.publish(topic=topic, qos=0, payload=json.dumps(user_job_request))
                except Exception as err:
                    logger.error("There was an issue publishing start to the IoT topic m2c2/job/request:"+ str(err))
                    post.to_user(job_name, new_job_version, "error", var.m2c2_publish_to_topic %(user_job_request))
                jobs_to_restart = []
                jobs_to_restart = ddb.start_jobs_after_gg_deploy(user_job_request)
                for entry in jobs_to_restart:
                    for item in entry['job']['properties']:
                        if item['name'] == user_job_request['job']['properties'][0]['name']:
                            entry['control'] = 'stop'
                logger.info("Restarting jobs")
                if jobs_to_restart:
                    try:
                        for entry in jobs_to_restart:
                            logger.info("Sending the following to the IoT topic {0}: {1}".format(topic, str(entry)))
                            resp = iot_client.publish(topic=topic, qos=0, payload=json.dumps(entry))
                            time.sleep(5)
                    except Exception as err:
                        logger.error("There was an issue publishing start to the IoT topic m2c2/job/request:"+ str(err))
                        post.to_user(job_name, new_job_version, "error", var.m2c2_publish_to_topic %(entry))
                return 1
        else:
            return 0

    def start(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            job_control = utils.get_metadata("control",user_job_request,i)
            jobs = ddb.read_ddb_jobid(job_name)["Items"]
            if not job_version:
                # Start latest version
                job_version = max([item.get("version", 0) for item in jobs], default=0)
                job_entry = ([item for item in jobs if item['version'] == job_version])[0]
            else:
                for entry in jobs:
                    if str(entry["version"]) == str(job_version):
                        job_entry = entry
            if ddb.valid_job_request(job_name):
                if not job_entry:
                    logger.info("There was an issue retriving job information for job {0}".format(job_name))
                    return 0
                json_job = json.loads(job_entry["job_details"])
                if str(job_entry['version']) == str(job_version):
                        job_to_start = json_job
                if not ddb.update(job_name, job_version, job_control,""):
                    return 0
                for entry in jobs:
                    if entry["version"] != int(job_version):
                        json_job_details = json.loads(entry['job_details'])
                        json_job_details['job']['properties'][0]['version'] = str(entry['version'])
                        self.stop(json_job_details)
                job_to_start["job"]["control"] = "start"
                job_to_start["job"]["properties"][0]["version"] = str(job_version)
                post.to_lambda(job_name, job_to_start)
            else:
                return 0

    def stop(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            desired_job_control = "stop"
            jobs = ddb.read_ddb_jobid(job_name)["Items"]
            if not job_version:
                # Stop running version
                job_entry = ([item for item in jobs if item['control'] == 'start' or item['control'] == 'update'])[0]
                job_version = job_entry["version"]
            else:
               for entry in jobs:
                   if str(entry["version"]) == str(job_version):
                       job_entry = entry
            job_control = job_entry['control']
            if job_control != desired_job_control:
                if ddb.valid_job_request(job_name):
                    if not job_entry:
                        logger.info("There was an issue retrieving job {0}".format(job_name))
                        return 0
                    if not ddb.update(job_name, job_version, desired_job_control, job_entry['job_details']):
                        return 0
                    # for item in stored_job_request:
                    json_job = json.loads(job_entry["job_details"])
                    if str(job_entry["version"]) == str(job_version):
                        job_to_stop = json_job
                    job_to_stop["job"]["control"] = "stop"
                    del job_to_stop["job"]["machine-details"]
                    post.to_lambda(job_name, job_to_stop)
                else:
                    return 0

    def update(self, user_job_request):
        job_name = utils.get_metadata("name",user_job_request,0)
        job_version = ddb.retrieve_entry_value(user_job_request, "version")
        job_control = utils.get_metadata("control",user_job_request,0)
        protocol = utils.get_metadata("protocol", user_job_request,0)
        if ddb.valid_job_request(job_name):
            # build job as per protocol
            processed_job_request = build.job(user_job_request)
            if not processed_job_request:
                return 0
            if protocol == 'slmp':
                logger.info("Writing processed job to s3")
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
        job = None

        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            job_version = utils.get_metadata("version",user_job_request,i)
            if ddb.valid_job_request(job_name):
                jobs = ddb.read_ddb_jobid(job_name)["Items"]

                if not jobs:
                    return 0

                if not job_version:
                    job_version = max([item.get("version", 1) for item in jobs], default=1)
                    job = ([item for item in jobs if item['version'] == job_version])[0]
                else:
                    for item in jobs:
                        if str(item["version"]) == str(job_version):
                            job = item
                            break

                if job:
                    job_to_push = json.loads(job["job_details"])
                    job_to_push["job"]["control"] = "push"
                    post.to_lambda(job_name, job_to_push)
                else:
                    logger.warn("No job found")
            else:
                return 0

    def pull(self, user_job_request):
        for i in range(0, len(utils.get_metadata("properties",user_job_request,0))):
            job_name = utils.get_metadata("name",user_job_request,i)
            if ddb.valid_job_request(job_name):
                post.to_lambda(job_name, user_job_request)
            else:
                return 0
        return 1

def lambda_handler(event, context):
    process_control(event)
    return