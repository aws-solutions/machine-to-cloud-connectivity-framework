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


import socket
import json
import logging

import time
import threading
from threading import Timer
import os

import m2c2_local_resource as local
import m2c2_comms as comms
import m2c2_utils as utils
import m2c2_post_handler as post
import m2c2_globals as var
import m2c2_transform as tform

payload = []
execution_control = ""
connection_handler = ""
ttl = ""

logger = logging.getLogger()
logger.setLevel(logging.INFO)

execution_control =""
payload_content = []
connection_handler = ""
event = ""
ttl = 0.2
current_job = ""
loop_count = 0

def function_handler(job_data, context):
    global execution_control
    job_name = utils.get_metadata("name", job_data, 0)
    job_control = utils.get_metadata("control", job_data, 0)
    if (execution_control == "run") and (job_control in ["start"]):
        post.to_user("info", job_data, var.m2c2_already_started)
    elif (execution_control == "stop") and (job_control in ["stop"]):
        post.to_user("info", job_data, var.m2c2_already_stopped)
    else:
        if job_control == "start":
            start(job_data)
        elif job_control == "stop":
            stop(job_data)
        elif job_control == "push":
            push(job_data)
        elif job_control == "update":
            update(job_data)
        elif job_control == "pull":
            pull(job_data)

def push(job_data):
    logger.info("User request: push")
    comms_handler = comms.DeviceCommunication(job_data)
    if comms_handler.open():
        logger.info("successfully connected.")
        post.to_user("info", job_data, var.m2c2_job_push_success)
    else:
        logger.info("Failed to connect.")
        post.to_user("info", job_data, var.m2c2_job_push_fail)
    comms_handler.close()
    return 1

def start(job_data):
    global event, connection_handler, execution_control
    logger.info("User request: start")
    local.write(job_data)
    event = job_data
    connection_handler = comms.DeviceCommunication(job_data)
    if connection_handler.open():
        logger.info("successfully connected.")
        execution_control = "run"
        post.to_user("info", job_data, var.m2c2_job_started)
        job_execution()
        return 1
    else:
        connection_handler.close()
        logger.info("Failed to connect.")
        post.to_user("info", job_data, var.m2c2_job_push_fail)
        return 0

def stop(job_data):
    global execution_control, ttl
    logger.info("User request: stop")
    execution_control = "stop"
    time.sleep(min(10 * ttl, 3))
    temp = local.read(job_data)
    if temp:
        temp["job"]["control"] = utils.get_metadata("control", job_data,0)
        local.write(temp)
    if utils.get_metadata("control", job_data,0) == "stop":
        post.to_user("info", job_data, var.m2c2_job_stopped)

def update(job_data):
    logger.info("User request: update")
    stop(job_data)
    start(job_data)
    post.to_user("info", job_data, var.m2c2_job_updated)

def pull(job_data):
    logger.info("User request: pull")  
    job_data = local.read(job_data)
    if job_data != "":
        post.to_user("info", job_data, job_data)

def job_execution():
    # runs while execution_control is set to run. Transmissions are time-based only.
    global execution_control, payload_content, connection_handler, loop_count, event, ttl, current_job
    #logger.info("Job execution thead count: " + str(threading.activeCount()))
    if execution_control == "run":
        current_job = event
        start_time = time.time()
        try:
            payload_content.append(connection_handler.read())
        except Exception as err:
            execution_control = "stop"
            logger.info("Unable to read from server: " + str(err))
            post.to_user("error", current_job, var.m2c2_lost_communication)
        
        loop_count += 1
        if loop_count >= utils.get_metadata("machine-query-iterations", current_job, 0):
            loop_count = 0
            try:
                tform.transform(payload_content,current_job)
            except Exception as err:
                logger.info("Unable to transform dataset: " + str(err))
            payload_content = []
        ttl = time.time() - start_time

        Timer(utils.get_metadata("machine-query-time-interval", current_job, 0), job_execution).start()
    elif execution_control == "stop":
        loop_count = 0
        if payload_content != []:
            try:
                tform.transform(payload_content,current_job)
            except Exception as err:
                logger.info("Unable to transform dataset: " + str(err))
        payload_content = []
        try:
            connection_handler.close()
        except:
            pass
        return 0
