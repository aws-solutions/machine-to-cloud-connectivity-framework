# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import greengrasssdk
import time
import os
import OpenOPC
import messages as msg

from threading import Timer

from greengrasssdk.stream_manager import ExportDefinition

from utils import StreamManagerHelperClient, AWSEndpointClient, InitMessage

from validations.message_validation import MessageValidation

# payload array containing responses from the OPCDA server
# appended to at each execution of the thread
payload_content = []
control = ""  # connection control variables monitored by the thread
lock = False  # flag used to prevent concurrency
connection = None  # OPC connection to the server
connection_name = ""  # Connection name from the connection data
# Measured execution time of the thread
# used to ensure the thread has completed its execution
ttl = 0.2

# Greengrass Stream name
CONNECTION_GG_STREAM_NAME = os.environ["CONNECTION_GG_STREAM_NAME"]

# Constant variables
# Site name from Greengrass Lambda Environment variables
SITE_NAME = os.getenv("SITE_NAME")
# Area from Greengrass Lambda Environment variables
AREA = os.getenv("AREA")
# Process from Greengrass Lambda Environment variables
PROCESS = os.getenv("PROCESS")
# Machine name from Greengrass Lambda Environment variables
MACHINE_NAME = os.getenv("MACHINE_NAME")
# Connection retry count
CONNECTION_RETRY = 10
# Error retry count
ERROR_RETRY = 5

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5G

# Clients and logging
opcda_iot_client = greengrasssdk.client("iot-data")
smh_client = StreamManagerHelperClient()
connector_client = AWSEndpointClient()
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def form_map():
    format_map = {
        "name": connection_name,
        "site_name": SITE_NAME,
        "area": AREA,
        "process": PROCESS,
        "machine_name": MACHINE_NAME
    }
    return format_map


def validate_schema(message):
    """ensure that the data format is as should be"""
    """ Ex:
    {
        "alias": "{site_name}/{area}/{process}/{machine_name}/{tag}",
        "messages": [{
            "name": alias,
            "timestamp": str, (also validate this is a valid timestamp)
            "quality": 'Good|GOOD|Bad|BAD|Uncertain|UNCERTAIN',
            "value": any
        }]
    }
    """

    format_map = form_map()
    post_type = "error"
    topic = "m2c2/{post_type}/{name}".format(
        **format_map, post_type=post_type
    )

    try:
        vals = MessageValidation(topic)
        vals.validate_schema(message)
    except Exception as err:
        logger.error("Message validation failed. Error: %s", str(err))
        raise Exception(msg.ERR_MSG_VALIDATION.format(err))


def m2c2_stream_required_format(tag, messages):
    user_message = {}
    format_map = form_map()
    alias = "{site_name}/{area}/{process}/{machine_name}/{tag}".format(
        **format_map, tag=tag
    )
    user_message["alias"] = alias
    user_message["messages"] = [dict(item, name=alias) for item in messages]

    return user_message


def info_or_error_format(message, post_type):
    init_message = InitMessage()
    user_message = init_message.init_user_message()
    format_map = form_map()
    topic = "m2c2/{post_type}/{name}".format(
        **format_map, post_type=post_type
    )
    user_message["message"] = message
    return topic, user_message


def post_to_user(post_type, message):
    try:
        if post_type == 'data':
            for key in message.keys():
                formatted_payload = m2c2_stream_required_format(key, message[key])
                """ Validate data format"""
                validate_schema(formatted_payload)
                """Write messages to the GG message stream"""
                avail_streams = smh_client.list_streams()
                if CONNECTION_GG_STREAM_NAME not in avail_streams:
                    logger.info(
                        "Stream {} not found, attempting to create it.".format(CONNECTION_GG_STREAM_NAME)
                    )
                    gg_exports = ExportDefinition()
                    smh_client.create_stream(
                        CONNECTION_GG_STREAM_NAME, max_stream_size, gg_exports
                    )
                smh_client.write_to_stream(CONNECTION_GG_STREAM_NAME, formatted_payload)

        else:
            topic, user_message = info_or_error_format(message, post_type)
            connector_client.publish_message_to_iot_topic(topic, user_message)

    except Exception as err:
        logger.error("Failed to publish message to IoT topic or Stream Manager. Error: %s", str(err))
        raise


def device_connect(connection_data):
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
                    host=connection_data["opcDa"]["machineIp"]
                )
                connection.connect(
                    opc_server=connection_data["opcDa"]["serverName"]
                )
                break
            except:
                if i == CONNECTION_RETRY - 1:
                    raise

                logger.error("Connection failed to %s, retry to connect...", connection_data["opcDa"]["machineIp"])
                time.sleep(i + 1)
    except Exception as err:
        logger.error("Connection failed. Error: %s", str(err))
        raise Exception(msg.ERR_MSG_FAIL_TO_CONNECT)


def job_execution(connection_data, running_count=0, error_count=0):
    """Executes the job."""

    global payload_content, control, ttl, connection

    if control == "start":
        try:
            start_time = time.time()

# In this section, the program will pull data based on explicit tags (in keywork ['tags'])
# provided by the user or tags based on a wild card pattern
# provided by the user (in key word ['listTags])

            if connection_data["opcDa"]["tags"]:
                payload_content.extend(
                    connection.read(connection_data["opcDa"]["tags"])
                )

            # Here, to find all tags that match the wild card,
            # we first must list the tags, then read them
            if connection_data["opcDa"]["listTags"]:
                for entry in connection_data["opcDa"]["listTags"]:
                    payload_content.extend(
                        connection.read(connection.list(entry))
                    )

            running_count += 1
            error_count = 0

            # Send the data if the query iterations are done.
            if running_count >= connection_data["opcDa"]["iterations"]:
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
                    device_connect(connection_data)
                    logger.warn("Connection completed. Connection starts again...")
                except Exception as e:
                    logger.error("Connection retry failed: %s", str(e))
                    logger.error("Stopping the connection.")

                    control = "stop"
                    post_to_user("error", msg.ERR_MSG_LOST_COMMS_CONNECTION_STOPPED.format(err))

        Timer(
            interval=connection_data["opcDa"]["interval"],
            function=job_execution,
            args=[connection_data, running_count, error_count]
        ).start()
    elif control == "stop":
        if payload_content:
            post_to_user("data", convert_to_json(payload_content))
            payload_content = []

        connector_client.stop_client()

        try:
            connection.close()
            connection = None
        except Exception:
            pass


def start(connection_data):
    """Start a connection based on the connection data."""

    logger.info("User request: start")

    try:
        global control
        control = "start"

        connector_client.start_client(
            connection_name=connection_name,
            connection_configuration=connection_data
        )
        device_connect(connection_data)

        post_to_user("info", msg.INF_MSG_CONNECTION_STARTED)
        job_execution(connection_data=connection_data)
    except Exception as err:
        logger.error("Failed to execute the start: %s", str(err))
        raise Exception("Failed to execute the start: {}".format(err)) from err


def stop():
    """Stop a connection based on the connection data."""

    logger.info("User request: stop")

    try:
        global control
        control = "stop"

        time.sleep(min(5 * ttl, 3))
        local_connection_data = connector_client.read_local_connection_configuration(
            connection_name=connection_name
        )

        if local_connection_data:
            local_connection_data["control"] = "stop"
            connector_client.write_local_connection_configuration_file(
                connection_name=connection_name, connection_configuration=local_connection_data
            )
            post_to_user("info", msg.INF_MSG_CONNECTION_STOPPED)
    except Exception as err:
        logger.error("Failed to execute the stop: %s", str(err))
        raise Exception("Failed to execute the stop: {}".format(err)) from err


def update(connection_data):
    """Update an existing connection."""

    logger.info("User request: update")

    try:
        global control
        control = "stop"

        time.sleep(min(10 * ttl, 3))
        connector_client.start_client(connection_name=connection_name, connection_configuration=connection_data)
        device_connect(connection_data)

        control = "start"
        post_to_user("info", msg.INF_MSG_CONNECTION_UPDATED)
        job_execution(connection_data=connection_data)
    except Exception as err:
        logger.error("Failed to execute the update: %s", str(err))
        raise Exception("Failed to execute the update: {}".format(err)) from err


def push(connection_data):
    """Send the list of servers to users through the IoT topic."""

    logger.info("User request: push")

    try:
        opc = OpenOPC.open_client(
            host=connection_data["opcDa"]["machineIp"]
        )
        server = opc.servers()
        opc.close()

        post_to_user("info", msg.INF_MSG_SERVER_NAME.format(server))
    except Exception as err:
        logger.info(msg.ERR_MSG_FAIL_SERVER_NAME.format(err))
        post_to_user("error", msg.ERR_MSG_FAIL_SERVER_NAME.format(err))


def pull():
    """Send the local connection data, if exists, to users through the IoT topic."""

    logger.info("User request: pull")

    try:
        local_connection_data = connector_client.read_local_connection_configuration(connection_name)

        if local_connection_data:
            post_to_user("info", local_connection_data)
        else:
            post_to_user("error", msg.ERR_MSG_NO_CONNECTION_FILE.format(connection_name))
    except Exception as err:
        logger.error(msg.ERR_MSG_FAIL_SERVER_NAME.format(err))
        post_to_user("error", msg.ERR_MSG_FAIL_SERVER_NAME.format(err))


def convert_to_json(payload_content):
    """Convert the OPC DA array data to JSON (Dict) and return the aggregated JSON data."""

    try:
        json_response = {}

        for t in payload_content:  # tuple in payload_content
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


def set_connection_properties(connection_data):
    """Set the connection name to the global variables."""

    try:
        global connection_name
        connection_name = connection_data["connectionName"]
    except KeyError:
        raise KeyError("Failed to retrieve the connection name from the connection data.")


def function_handler(connection_data, context):
    """OPC DA Connector function handler."""

    global lock

    try:
        if not lock:
            lock = True
            connection_control = connection_data["control"].lower()
            set_connection_properties(connection_data)

            if connection_control == "start":
                if connector_client.is_running:
                    post_to_user("info", msg.ERR_MSG_FAIL_LAST_COMMAND_START.format(connection_name))
                else:
                    start(connection_data)
            elif connection_control == "stop":
                if connector_client.is_running:
                    stop()
                else:
                    post_to_user("info", msg.ERR_MSG_FAIL_LAST_COMMAND_STOP.format(connection_name))
            elif connection_control == "update":
                update(connection_data)
            elif connection_control == "push":
                push(connection_data)
            elif connection_control == "pull":
                pull()
            else:
                post_to_user("error", msg.ERR_MSG_FAIL_UNKWOWN_CONTROL.format(connection_control))

            lock = False
        else:
            logger.info("The function is still processing.")
    except Exception as err:
        logger.error("Failed to run the connection on the function: %s", str(err))

        if type(err).__name__ != "KeyError":
            post_to_user("error", "Failed to run the connection: {}".format(str(err)))

        lock = False
        connector_client.stop_client()

        raise
