# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import logging
import threading
import os
import boto3
import sendcfnresponse
import uuid
import datetime
import urllib.request

from botocore.config import Config

# Send user agent string for the solution
solution_id = os.environ["SOLUTION_ID"]
solution_version = os.environ["SOLUTION_VERSION"]

config = {}
if solution_id and solution_version:
    config["user_agent_extra"] = "AwsSolution/" + solution_id + "/" + solution_version


s3 = boto3.client('s3', config=Config(**config))

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def send_metrics(config):
    metrics = {
        "Solution": config['SolutionId'],
        "UUID": config['UUID'],
        "TimeStamp": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
        "Version": config['Version'],
        "Data": {
            "ExistingGreengrassGroup": config.get("ExistingGreengrassGroup", "") != "",
            "ExistingKinesisStream": config.get("ExistingKinesisStream", "") != "",
            "Region": config["Region"],
            "EventType": config["EventType"]
        }
    }
    url = 'https://metrics.awssolutionsbuilder.com/generic'
    data = json.dumps(metrics).encode('utf8')
    headers = {'content-type': 'application/json'}
    req = urllib.request.Request(url, data, headers)
    response = urllib.request.urlopen(req)
    logger.info('RESPONSE CODE:: %s', response.getcode())
    logger.info('METRICS SENT:: %s', data)

def timeout(event, context):
    logger.error('Execution is about to time out, sending failure response to CloudFormation')
    sendcfnresponse.send_response(event, context, sendcfnresponse.FAILED, {})

def handler(event, context):
    # make sure we send a failure to CloudFormation if the function
    # is going to timeout
    timer = threading.Timer((context.get_remaining_time_in_millis()
                / 1000.00) - 0.5, timeout, args=[event, context])
    timer.start()
    logger.info('Received event: %s', json.dumps(event))
    status = sendcfnresponse.SUCCESS
    responseData = {}
    config = event['ResourceProperties']

    try:
        if event['RequestType'] in ['Create', 'Update'] :
            if config['Resource'] == 'CreateUUID':
                responseData['UUID'] = str(uuid.uuid4())
            elif config['Resource'] == 'SendAnonymousMetrics':
                if event['RequestType'] == 'Create':
                    config['EventType'] = 'DeployStack'
                elif event['RequestType'] == 'Update':
                    config['EventType'] = 'UpdateStack'

                try:
                    send_metrics(config)
                except:
                    pass
        elif event['RequestType'] == 'Delete':
            if config['Resource'] == 'SendAnonymousMetrics':
                config['EventType'] = 'DeleteStack'

                try:
                    send_metrics(config)
                except:
                    pass
    except Exception as e:
        logging.error('Exception: %s' % e, exc_info=True)
        status = sendcfnresponse.FAILED
    finally:
        timer.cancel()
        sendcfnresponse.send_response(event, context, status, responseData)