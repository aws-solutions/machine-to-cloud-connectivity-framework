## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import json
import boto3
import os
import logging

import m2c2_post_handler as post
import m2c2_utils as utils
import m2c2_globals as var
import m2c2_ddb_handler as ddb
import m2c2_job_builder_main

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.resource('s3')

def write(user_job_request,type):
    job_name = utils.get_metadata("name",user_job_request,0)
    job_version = utils.get_metadata("version",user_job_request,0)
    job_protocol = utils.get_metadata("protocol",user_job_request,0)
    try:
        s3object = s3_client.Object(os.environ["JBM_BCK"], job_protocol + "-" + os.environ["JBM_KEY"] + job_name + "#v" + job_version + "." + type)
        s3object.put(Body=(bytes(json.dumps(user_job_request).encode('UTF-8'))))
    except Exception as err:
        logger.info("s3 write traceback:"+ str(err))
        post.to_user(job_name, job_version, "error", var.m2c2_s3_fail_write %(os.environ["JBM_BCK"]))
        return 0
    return 1

def read(job_name, job_version):
    job = ddb.get_job_details(job_version)
    job_protocol = job["protocol"]
    try:
        s3object = s3_client.Object(os.environ["JBM_BCK"], job_protocol +"-" + os.environ["JBM_KEY"] + job_name + "#v" + job_version + ".json")
        return json.loads(s3object.get()['Body'].read().decode('utf-8'))
    except Exception as err:
        logger.info("s3 read traceback:"+ str(err))
        post.to_user(job_name, job_version, "error", var.m2c2_s3_fail_read %(os.environ["JBM_BCK"]))
        return 0
    return 1

