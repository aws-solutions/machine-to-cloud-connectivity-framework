## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import json
import boto3
import logging
import os
import urllib

import m2c2_metrics as metrics
import m2c2_globals as var
import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Resource and clients

iot_client = boto3.client('iot-data', config=utils.get_boto_config())

def to_user(name, version, type, message):
    user_message = {}
    if name == "":
        topic = "m2c2/job/" + type
    else:
        topic = "m2c2/job/" + name + "/" + type
        user_message["job-name"] = name
    if version != "": user_message["version"] = version
    user_message["message"] = message
    logger.info("User message: " + str(user_message))
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(user_message))

def to_lambda(job_name, message):
    if os.environ["SEND_ANONYMOUS_METRIC"] == "Yes":
        metrics.get_metrics(message)
    topic = "m2c2/job/" + job_name + "/submit"
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(message)
    )

def to_metrics(metrics):
    metrics = json.dumps(metrics).encode("utf-8")
    headers = {'content-type': 'application/json'}
    req = urllib.request.Request(var.m2c2_metrics_url, metrics, headers)
    response = urllib.request.urlopen(req)
    print('Response code:: {}'.format(response.getcode()))
    print('Metrics sent:: {}'.format(metrics))
