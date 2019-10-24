## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import os
import logging
import datetime
from datetime import datetime

import m2c2_post_handler as post
import m2c2_utils as utils
import m2c2_protocol_converter as build

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_metrics(user_job_request):
    aws_metrics = {}
    aws_metrics = generic_metrics(user_job_request)
    if utils.get_metadata("control",user_job_request,0) in ["start", "push", "update"]:
        aws_metrics = build.protocol_metrics(user_job_request,aws_metrics)
        
    post.to_metrics(aws_metrics)
    return 1

def generic_metrics(user_job_request):
    aws_metrics = {}
    aws_metrics['Solution'] = os.environ["SOL_ID"]
    aws_metrics['UUID'] = os.environ["UUID"]
    aws_metrics['TimeStamp'] = str(datetime.utcnow().isoformat())
    aws_metrics["Data"] ={
        "EventType": utils.get_metadata("control",user_job_request,0),
        "Version": os.environ["SOL_VER"],
        "JobName" : utils.get_metadata("name",user_job_request,0)}
    return aws_metrics