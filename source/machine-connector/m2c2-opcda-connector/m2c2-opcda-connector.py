# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import logging
import greengrasssdk
import time
import uuid
import os
import OpenOPC
import messages as msg

from threading import Timer
from datetime import datetime
from greengrasssdk.stream_manager import (
    ExportDefinition,
    KinesisConfig,
    MessageStreamDefinition,
    ResourceNotFoundException,
    StrategyOnFull,
    StreamManagerClient
)
from connector import ConnectorClient

payload_content = []  # payload array containing responses from the OPCDA server, appended to at each execution of the thread
control = ""  # job control variables monitored by the thread
lock = False  # flag used to prevent concurrency
connection = None  # OPC connection to the server
job_name = ""  # Job name from the job data
version = None  # Version from the job data
ttl = 0.2  # Measured execution time of the thread, used to ensure the thread has completed its execution
send_data_to_iot_topic = False  # Flag to send data to IoT topic
send_data_to_stream_manager = True  # Flag to send data to Stream Manager

# Constant variables
# Site name from Greengrass Lambda Environment variables
SITE_NAME = os.environ["sitename"]
# Area from Greengrass Lambda Environment variables
AREA = os.environ["area"]
# Process from Greengrass Lambda Environment variables
PROCESS = os.environ["process"]
# Machine name from Greengrass Lambda Environment variables
MACHINE_NAME = os.environ["machinename"]
# Kinesis Data Stream name
KINESIS_STREAM_NAME = os.environ["kinesisstream"]
# Connection retry count
CONNECTION_RETRY = 10
# Error retry count
ERROR_RETRY = 5

# Clients and logging
opcda_iot_client = greengrasssdk.client("iot-data")
connector_client = ConnectorClient(
    kinesis_stream_name=KINESIS_STREAM_NAME, connection_retry=CONNECTION_RETRY
)
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def post_to_user(post_type, message):
    """Post messages to users through the IoT topic and Stream Manager."""

    user_message = {
        "_id_": str(uuid.uuid4()),
        "_timestamp_": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    }

    if version:
        user_message["version"] = version

    user_message["site-name"] = SITE_NAME
    user_message["area"] = AREA
    user_message["process"] = PROCESS
    user_message["machine-name"] = MACHINE_NAME

    format_map = {
        "name": job_name,
        "site_name": SITE_NAME,
        "area": AREA,
        "process": PROCESS,
        "machine_name": MACHINE_NAME
    }

    try:
        if post_type == "data":
            if send_data_to_iot_topic or send_data_to_stream_manager:
                for tag in message.keys():
                    alias = "{site_name}/{area}/{process}/{machine_name}/{tag}".format(
                        **format_map, tag=tag
                    )
                    user_message["tag"] = tag
                    user_message["alias"] = alias
                    user_message["messages"] = [dict(item, name=alias) for item in message[tag]]

                    if send_data_to_iot_topic:
                        topic = "m2c2/job/{name}/{alias}".format(
                            name=job_name, alias=alias
                        )
                        connector_client.publish_message_to_iot_topic(
                            topic=topic, payload=user_message
                        )

                    if send_data_to_stream_manager:
                        connector_client.append_stream_manager_message(user_message)

                    user_message["_id_"] = str(uuid.uuid4())
                    user_message["_timestamp_"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        else:
            topic = "m2c2/job/{name}/{site_name}/{area}/{process}/{machine_name}/{post_type}".format(
                **format_map, post_type=post_type
            )
            user_message["message"] = message
            connector_client.publish_message_to_iot_topic(topic, user_message)
    except Exception as err:
        logger.error("Failed to publish data to IoT topic or Stream Manager. Error: %s", str(err))


def device_connect(job_data):
    """Connect the device to OPC server."""

    try:
        global connection

        if connection:
            logger.warn("connection exists, closing it...")
            connection = None
            logger.warn("connection closed done.")

        # Connection retries
        for i in range(CONNECTION_RETRY):
            try:
                connection = OpenOPC.open_client(
                    host=job_data["job"]["machine-details"]["connectivity-parameters"]["machine-ip"]
                )
                connection.connect(
                    opc_server=job_data["job"]["machine-details"]["connectivity-parameters"]["opcda-server-name"]
                )
                break
            except:
                if i == CONNECTION_RETRY - 1:
                    raise

                logger.error("Connection failed to %s, retry to connect...", job_data["job"]["machine-details"]["connectivity-parameters"]["machine-ip"])
                time.sleep(i + 1)
    except Exception as err:
        logger.error("Connection failed. Error: %s", str(err))
        raise Exception(msg.ERR_MSG_FAIL_TO_CONNECT)


def job_execution(job_data, running_count=0, error_count=0):
    """Executes the job."""

    global payload_content, control, ttl, connection

    if control == "start":
        try:
            start_time = time.time()

            for attribute in job_data["job"]["machine-details"]["data-parameters"]["attributes"]:
                if attribute["function"].lower() == "read_tags":
                    payload_content.append(
                        connection.read(attribute["address-list"])
                    )
                elif attribute["function"].lower() == "read_list":
                    for address in attribute["address-list"]:
                        payload_content.append(
                            connection.read(connection.list(address))
                        )

            running_count += 1
            error_count = 0

            # Send the data if the query iterations are done.
            if running_count >= job_data["job"]["machine-details"]["data-parameters"]["machine-query-iterations"]:
                running_count = 0
                post_to_user("data", convert_to_json(payload_content))
                payload_content = []

            ttl = time.time() - start_time
        except Exception as err:
            logger.error("Unable to read from server: %s", str(err))

            error_count += 1

            if error_count >= ERROR_RETRY:
                try:
                    logger.error("Connection retry to OPC DA server...")
                    device_connect(job_data)
                    logger.warn("Connection completed. Job starts again...")
                except Exception as e:
                    logger.error("Connection retry failed: %s", str(e))
                    logger.error("Stopping the job.")

                    control = "stop"
                    post_to_user("error", msg.ERR_MSG_LOST_COMMS_JOB_STOPPED.format(err))

        Timer(
            interval=job_data["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"],
            function=job_execution,
            args=[job_data, running_count, error_count]
        ).start()
    elif control == "stop":
        if payload_content:
            post_to_user("data", convert_to_json(payload_content))
            payload_content = []

        connector_client.stop_client()

        try:
            connection.close()
            connection = None
        except:
            pass


def start(job_data):
    """Start a job based on the job data."""

    logger.info("User request: start")

    try:
        global control, send_data_to_iot_topic, send_data_to_stream_manager
        control = "start"

        # By default, the connector does not send data to the IoT Topics
        try:
            send_data_to_iot_topic = job_data["job"]["send-data-to-iot-topic"]
        except:
            send_data_to_iot_topic = False

        # By default, the connector sends data to the Stream Manager
        try:
            send_data_to_stream_manager = job_data["job"]["send-data-to-stream-manager"]
        except:
            send_data_to_stream_manager = True

        connector_client.start_client(job_name=job_name, job_configuration=job_data)
        device_connect(job_data)

        post_to_user("info", msg.INF_MSG_JOB_STARTED)
        job_execution(job_data=job_data)
    except Exception as err:
        logger.error("Failed to execute the start: %s", str(err))
        raise Exception("Failed to execute the start: {}".format(err)) from err


def stop(job_data):
    """Stop a job based on the job data."""

    logger.info("User request: stop")

    try:
        global control
        control = "stop"

        time.sleep(min(5 * ttl, 3))
        local_job_data = connector_client.read_local_job_configuration(
            job_name=job_name
        )

        if local_job_data:
            local_job_data["job"]["control"] = "stop"
            connector_client.write_local_job_configuration_file(
                job_name=job_name, job_configuration=local_job_data
            )
            post_to_user("info", msg.INF_MSG_JOB_STOPPED)
    except Exception as err:
        logger.error("Failed to execute the stop: %s", str(err))
        raise Exception("Failed to execute the stop: {}".format(err)) from err


def update(job_data):
    """Update an existing job."""

    logger.info("User request: update")

    try:
        global control
        control = "stop"

        time.sleep(min(10 * ttl, 3))
        connector_client.start_client(job_name=job_name, job_configuration=job_data)
        device_connect(job_data)

        control = "start"
        post_to_user("info", msg.INF_MSG_JOB_UPDATED)
        job_execution(job_data=job_data)
    except Exception as err:
        logger.error("Failed to execute the update: %s", str(err))
        raise Exception("Failed to execute the update: {}".format(err)) from err


def push(job_data):
    """Send the list of servers to users through the IoT topic."""

    logger.info("User request: push")

    try:
        opc = OpenOPC.open_client(
            host=job_data["job"]["machine-details"]["connectivity-parameters"]["machine-ip"]
        )
        server = opc.servers()
        opc.close()

        post_to_user("info", msg.INF_MSG_SERVER_NAME.format(server))
    except Exception as err:
        logger.info(msg.ERR_MSG_FAIL_SERVER_NAME.format(err))
        post_to_user("error", msg.ERR_MSG_FAIL_SERVER_NAME.format(err))


def pull(job_data):
    """Send the local job data, if exists, to users through the IoT topic."""

    logger.info("User request: pull")

    try:
        local_job_data = connector_client.read_local_job_configuration(job_name)

        if local_job_data:
            post_to_user("info", local_job_data)
        else:
            post_to_user("error", msg.ERR_MSG_NO_JOB_FILE.format(job_name))
    except Exception as err:
        logger.error(msg.ERR_MSG_FAIL_SERVER_NAME.format(err))
        post_to_user("error", msg.ERR_MSG_FAIL_SERVER_NAME.format(err))


def convert_to_json(payload_content):
    """Convert the OPC DA array data to JSON (Dict) and return the aggregated JSON data."""

    try:
        json_response = {}

        for arr in payload_content:  # array in payload_content
            for t in arr:  # tuple in arr
                temp = {}
                key = t[0].replace(".", "-").replace("/", "_")

                if len(t) == 4:
                    temp["value"] = t[1]
                    temp["quality"] = t[2]
                    temp["timestamp"] = t[3]
                else:
                    temp["value"] = "Parameters cannot be read from server"

                json_response.setdefault(key, []).append(temp)

        return json_response
    except Exception as err:
        logger.error("Failed to convert the data to JSON: %s", str(err))
        return {"error": "Failed to covert the data to JSON: {}".format(err)}


def set_job_properties(job_data):
    """Set the job name and version to the global variables."""

    try:
        global job_name, version
        job_name = job_data["job"]["properties"][0]["name"]

        try:
            version = job_data["job"]["properties"][0]["version"]
        except KeyError:
            pass
    except KeyError:
        raise KeyError("Failed to retrieve the job name from the job data.")


def function_handler(job_data, context):
    """OPC DA Connector function handler."""

    global lock

    try:
        if not lock:
            lock = True
            job_control = job_data["job"]["control"].lower()
            set_job_properties(job_data)

            if job_control == "start":
                if connector_client.is_running:
                    post_to_user("info", msg.ERR_MSG_FAIL_LAST_COMMAND_START.format(job_name))
                else:
                    start(job_data)
            elif job_control == "stop":
                if connector_client.is_running:
                    stop(job_data)
                else:
                    post_to_user("info", msg.ERR_MSG_FAIL_LAST_COMMAND_STOP.format(job_name))
            elif job_control == "update":
                update(job_data)
            elif job_control == "push":
                push(job_data)
            elif job_control == "pull":
                pull(job_data)
            else:
                post_to_user("error", msg.ERR_MSG_FAIL_UNKWOWN_CONTROL.format(job_control))

            lock = False
        else:
            logger.info("The function is still processing.")
    except Exception as err:
        logger.error("Failed to run the job on the function: %s", str(err))

        if type(err).__name__ != "KeyError":
            post_to_user("error", "Failed to run the job: {}".format(str(err)))

        lock = False
        connector_client.stop_client()

        raise
