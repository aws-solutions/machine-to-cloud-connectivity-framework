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
import greengrasssdk
import binascii
import datetime
from datetime import date
import time
import threading
import uuid
from threading import Timer
import os
import Pyro
import OpenOPC
import messages as msg

logger = logging.getLogger()
logger.setLevel(logging.INFO)

connection_handler = ""     # handler for OPC communication
control = ""                # job control variables monitored by the thread 

kinesisfirehose_topic = 'kinesisfirehose/message'
config_path =               "/m2c2/job/"  # Path to affiliated resource
event = ""                  # job description as received or as read from file
opcda_iot_client = greengrasssdk.client('iot-data')
payload_content = []        # payload array containing responses from the OPCDA server, appended to at each execution of the thread
loop_count = 0              # number of job loops used to decide whether the payload is due to be push to data topic
ttl = 0.2                     # measured execution time of the thread, used to ensure the thread has completed its execution
last_command = ""           # used to ignore consecutive repeat action on control such as start or stop
busy = False                # flag used to prevent concurrency
machine_name = os.environ["machinename"]
onsite_area = os.environ["area"]
process = os.environ["process"]
site_name = os.environ["sitename"]


def post_to_user(name, version, type, message):
    kinesis_request_data = {}
    request = {}
    user_message = {}
    try:
        if type == "data":
            list_of_tags = message.keys()
            for i in range (0,len(list_of_tags)):
                topic = "m2c2/job/" + name + "/" +  site_name + "/" + onsite_area + "/" + process + "/" + machine_name + "/" + list_of_tags[i]
                if version != "": user_message["version"] = str(version)
                user_message["area"] = os.environ["area"]
                user_message["machine-name"] = os.environ["machinename"]
                user_message["process"] = os.environ["process"]
                user_message["site-name"] = os.environ["sitename"]
                user_message["message"] = message[list_of_tags[i]]
                user_message["_id_"] = str(uuid.uuid4())
                user_message["_timestamp_"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
                request["data"] = str(user_message)
                kinesis_request_data["request"] = request
                kinesis_request_data["id"] = str(uuid.uuid4())
                logger.info("Publishing this data to topic {0}: {1}".format(str(topic), str(user_message)))
                try:
                    opcda_iot_client.publish(
                        topic=topic,
                        qos=1,
                        payload=json.dumps(user_message))
                except Exception as err:
                    logger.info("Failed to publish telemetry data to the IoT topic. Error: ", str(err))
                logger.info("Publishing this data to topic {0}: {1}".format(str(kinesisfirehose_topic), str(kinesis_request_data)))
                try:
                    opcda_iot_client.publish(
                        topic=kinesisfirehose_topic,
                        payload=json.dumps(kinesis_request_data))
                except Exception as err:
                    logger.info("Failed to send data to the Kinesis Data Firehose topic. Error: ", str(err))
        else:
            topic = "m2c2/job/" + name + "/" + site_name + "/" + onsite_area + "/" + process + "/" + machine_name + "/" + type
            if version != "": user_message["version"] = str(version)
            user_message["area"] = os.environ["area"]
            user_message["machine-name"] = os.environ["machinename"]
            user_message["process"] = os.environ["process"]
            user_message["site-name"] = os.environ["sitename"]
            user_message["message"] = message
            user_message["_id_"] = str(uuid.uuid4())
            user_message["_timestamp_"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
            request["data"] = str(user_message)
            kinesis_request_data["request"] = request
            kinesis_request_data["id"] = str(uuid.uuid4())
            logger.info("Publishing this data to topic {0}: {1}".format(str(topic), str(user_message)))
            try:
                opcda_iot_client.publish(
                    topic=topic,
                    qos=1,
                    payload=json.dumps(user_message))
            except Exception as err:
                    logger.info("Failed to publish telemetry data to the IoT topic. Error: ", str(err))
            logger.info("Publishing this data to topic {0}: {1}".format(str(kinesisfirehose_topic), str(kinesis_request_data)))
            try:
                opcda_iot_client.publish(
                    topic=kinesisfirehose_topic,
                    payload=json.dumps(kinesis_request_data))
            except Exception as err:
                    logger.info("Failed to send data to the Kinesis Data Firehose topic. Error: ", str(err))
    except Exception as err:
        logger.info("Failed to publish data to IoT topic and Kinesis Data Firehose. Error: ", str(err))

def device_connect():
    global connection_handler, event
    job_name = event["job"]["properties"][0]["name"]
    job_version = event["job"]["properties"][0]["version"]
    try:
        connection_handler = OpenOPC.open_client(event["job"]["machine-details"]["connectivity-parameters"]["machine-ip"])
        connection_handler.connect(event["job"]["machine-details"]["connectivity-parameters"]["opcda-server-name"])
    except:
        post_to_user(job_name, job_version, "error", msg.ERR_MSG_FAIL_TO_CONNECT)
    else:
        return connection_handler


def job_execution():
    global control, payload_content, connection_handler, event, loop_count, ttl, last_command
    if control == "start":
        try:
            start_time = time.time()
            data = event
            for i in range(0, len(data["job"]["machine-details"]["data-parameters"]["attributes"])):
                if data["job"]["machine-details"]["data-parameters"]["attributes"][i]["function"].lower() == "read_tags":
                    payload_content.append(connection_handler.read(data["job"]["machine-details"]["data-parameters"]["attributes"][i]["address-list"]))
                elif data["job"]["machine-details"]["data-parameters"]["attributes"][i]["function"].lower() == "read_list":
                    for j in range(0, len(data["job"]["machine-details"]["data-parameters"]["attributes"][i]["address-list"])):
                        payload_content.append(connection_handler.read(connection_handler.list(data["job"]["machine-details"]["data-parameters"]["attributes"][i]["address-list"][j])))
            loop_count += 1
            if loop_count >= data["job"]["machine-details"]["data-parameters"]["machine-query-iterations"]:
                loop_count = 0
                post_to_user(data["job"]["properties"][0]["name"], data["job"]["properties"][0]["version"], "data", convert_to_json(payload_content))
                payload_content = []
            ttl = time.time() - start_time
        except Exception as err:
            control = "stop"
            last_command = ""
            logger.info("Unable to read from server: " + str(err))
            post_to_user(data["job"]["properties"][0]["name"], data["job"]["properties"][0]["version"], "error", msg.ERR_MSG_LOST_COMMS_JOB_STOPPED %(str(err)))
        Timer(data["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"], job_execution).start()
    elif control == "stop":
        loop_count = 0
        if payload_content != []:
            post_to_user(event["job"]["properties"][0]["name"], event["job"]["properties"][0]["version"], "data", convert_to_json(payload_content))
        payload_content = []
        try:
            connection_handler.close()
        except:
            pass


def start():
    logger.info("User request: start")
    global control, event, connection_handler,busy
    job_name = event["job"]["properties"][0]["name"]
    job_version = event["job"]["properties"][0]["version"]
    try:
        write_to_file(event)
        connection_handler = device_connect()
        post_to_user(job_name, job_version, "info", msg.INF_MSG_JOB_STARTED)
        control = "start"
        job_execution()
    except Exception as err:
        logger.info("Failed to execute the start. Error: ", str(err))
    busy = False

def stop():
    logger.info("User request: stop")
    global control, event, ttl,busy
    job_name = event["job"]["properties"][0]["name"]
    job_version = event["job"]["properties"][0]["version"]
    try:
        control = "stop"
        time.sleep(min(5 * ttl, 3))
        event = read_from_file(event)
        if event != "":
            event["job"]["control"] = "stop"
            write_to_file(event)
            post_to_user(job_name, job_version, "info", msg.INF_MSG_JOB_STOPPED)
    except Exception as err:
        logger.info("Failed to execute the update. Error: ",(str(err)))
    busy = False

def update():
    logger.info("User request: update")
    global control, event, ttl, connection_handler,busy
    job_name = event["job"]["properties"][0]["name"]
    job_version = event["job"]["properties"][0]["version"]
    try:
        control = "stop"
        time.sleep(min(10 * ttl,3))
        write_to_file(event)
        connection_handler = device_connect()
        post_to_user(job_name, job_version, "info", msg.INF_MSG_JOB_UPDATED)
        control = "start"
        job_execution()
    except Exception as err:
        logger.info("Failed to execute the update. Error: ",(str(err)))
    busy = False

def push():
    logger.info("User request: push")
    global event,busy
    job_name = event["job"]["properties"][0]["name"]
    job_version = event["job"]["properties"][0]["version"]   
    try:
        opc = OpenOPC.open_client(event["job"]["machine-details"]["connectivity-parameters"]["machine-ip"])
        server = opc.servers()
        opc.close()
    except Exception as err:
        logger.info(msg.ERR_MSG_FAIL_SERVER_NAME %(str(err)))
        post_to_user(job_name, job_version, "error", msg.ERR_MSG_FAIL_SERVER_NAME %(str(err)))
    else:
        post_to_user(job_name, job_version, "info", msg.INF_MSG_SERVER_NAME + str(server))
    busy = False

def pull():
    logger.info("User request: pull")
    global event,busy
    try:
        job_name = event["job"]["properties"][0]["name"]
        event = read_from_file(event)
        if event != "":
            post_to_user(job_name, "", "info", event)
        busy = False
    except Exception as err:
        logger.info(msg.ERR_MSG_FAIL_SERVER_NAME %(str(err))) 

def function_handler(job_data, context):
    global event, last_command, busy
    try:
        if not busy:
            busy = True
            job_name = job_data["job"]["properties"][0]["name"]
            if job_data["job"]["control"].lower() == "start":
                event = job_data
                if last_command == "start":
                    post_to_user(job_name, "", "info", msg.ERR_MSG_FAIL_LAST_COMMAND_START %(job_name))
                    busy = False
                else:
                    last_command = "start"
                    start()
            elif job_data["job"]["control"].lower() == "stop":
                event = job_data
                if last_command == "stop":
                    post_to_user(job_name, "", "info", msg.ERR_MSG_FAIL_LAST_COMMAND_STOP %(job_name))
                    busy = False
                else:
                    last_command = "stop"
                    stop()
            elif job_data["job"]["control"].lower() == "push":
                event = job_data
                push()
            elif job_data["job"]["control"].lower() == "update":
                event = job_data
                last_command = "start"
                update()
            elif job_data["job"]["control"].lower() == "pull":
                event = job_data
                pull()
            else:
                post_to_user(job_name, "", "error", msg.ERR_MSG_FAIL_UNKWOWN_CONTROL %(job_data["job"]["control"]))
                busy = False
    except Exception as err:
        logger.info("Failed to convert the data to JSON. Error: ", str(err))
        raise

def convert_to_json(payload_content):
    json_response = {}
    try:
        for i in range(0, len(payload_content)):
            for j in range(0, len(payload_content[i])):
                if len(payload_content[i][j]) == 4:
                    temp = {}
                    temp["value"] = payload_content[i][j][1]
                    temp["quality"] = payload_content[i][j][2]
                    temp["timestamp"] = payload_content[i][j][3]
                else:
                    temp = {}
                    temp["value"] = "Parameters cannot be read from server"
                if payload_content[i][j][0].replace(".", "-") in json_response:
                    json_response[payload_content[i][j][0].replace(".", "-")].append(temp)
                else:
                    json_response[payload_content[i][j][0].replace(".", "-")] = []
                    json_response[payload_content[i][j][0].replace(".", "-")].append(temp)
        return json_response
    except Exception as err:
        logger.info("Failed to convert the data to JSON. Error: ", str(err))
        raise

def write_to_file(data):
    global config_path
    data["job"]["_last-update-timestamp_"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    try:
        with open(config_path + data["job"]["properties"][0]["name"] + ".json", "w+") as file:
            json.dump(data, file)
        return 1
    except Exception as err:
        logger.info("Failed to write to file. Error: ", str(err))
        raise


def read_from_file(data):
    global config_path
    job_name = data["job"]["properties"][0]["name"]
    try:
        if os.path.exists(config_path + job_name + ".json"):
            with open(config_path + job_name + ".json") as file:
                data = json.load(file)
            return data
        else:
            post_to_user(job_name, "", "error", msg.ERR_MSG_NO_JOB_FILE %(job_name))
            return ""
    except Exception as err:
        logger.info("Failed to read the file. Error: ", str(err))
        raise
