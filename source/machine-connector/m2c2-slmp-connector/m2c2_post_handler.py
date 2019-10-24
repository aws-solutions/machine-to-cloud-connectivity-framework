## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import json
import logging
import uuid
import datetime
from datetime import date
import greengrasssdk

import m2c2_globals as var
import m2c2_utils as utils


logger = logging.getLogger()
logger.setLevel(logging.INFO)

iot_client = greengrasssdk.client('iot-data')

def to_user(type, job_data, msg):
    job_name = utils.get_metadata("name", job_data, 0)
    job_version = utils.get_metadata("version", job_data, 0)
    topic = "m2c2/job/" + job_name + "/" + type
    user_message = {
        "message": msg,
        "_id_": str(uuid.uuid4()),
        "_timestamp_": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f"),
        "version": job_version}
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(user_message))

def to_stream(job_name, job_version, payload):
    list_of_tags = list(payload.keys())
    for i in range (0,len(list_of_tags)):
        topic = "m2c2/job/" + job_name + "/" + list_of_tags[i]
        user_message = {
            "version": str(job_version),
            "message": payload[list_of_tags[i]],
            "_id_": str(uuid.uuid4()),
            "_timestamp_": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        }
        iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(user_message))

