# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import time
import os
import OpenOPC
import messages as msg
import awsiot.greengrasscoreipc

from awsiot.greengrasscoreipc.model import (
    QOS,
    SubscribeToIoTCoreRequest
)
from greengrasssdk.stream_manager import ExportDefinition
from inspect import signature
from threading import Timer
from typing import Union
from utils import StreamManagerHelperClient, AWSEndpointClient, InitMessage
from utils.subscription_stream_handler import SubscriptionStreamHandler
from utils.custom_exception import OPCDaConnectorException
from validations.message_validation import MessageValidation

# payload array containing responses from the OPC DA server
# appended to at each execution of the thread
payload_content = []
control = ""  # connection control variables monitored by the thread
lock = False  # flag used to prevent concurrency
connection = None  # OPC connection to the server
# Measured execution time of the thread
# used to ensure the thread has completed its execution
ttl = 0.2

# Greengrass Stream name
CONNECTION_GG_STREAM_NAME = os.environ["CONNECTION_GG_STREAM_NAME"]

# Constant variables
# Connection name from component environment variables
CONNECTION_NAME = os.getenv("CONNECTION_NAME")
# Site name from component environment variables
SITE_NAME = os.getenv("SITE_NAME")
# Area from component environment variables
AREA = os.getenv("AREA")
# Process from component environment variables
PROCESS = os.getenv("PROCESS")
# Machine name from component environment variables
MACHINE_NAME = os.getenv("MACHINE_NAME")
# Connection retry count
CONNECTION_RETRY = 10
# Error retry count
ERROR_RETRY = 5

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5G

# Clients and logging
smh_client = StreamManagerHelperClient()
connector_client = AWSEndpointClient()
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def form_map() -> dict:
    return {
        "name": CONNECTION_NAME,
        "site_name": SITE_NAME,
        "area": AREA,
        "process": PROCESS,
        "machine_name": MACHINE_NAME
    }


def validate_schema(message: dict) -> None:
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
        validation = MessageValidation(topic)
        validation.validate_schema(message)
    except Exception as err:
        logger.error(f"Message validation failed. Error: {err}")
        raise OPCDaConnectorException(msg.ERR_MSG_VALIDATION.format(err))


def m2c2_stream_required_format(tag: str, messages: list) -> dict:
    user_message = {}
    format_map = form_map()
    alias = "{site_name}/{area}/{process}/{machine_name}/{tag}".format(
        **format_map, tag=tag
    )
    user_message["alias"] = alias
    user_message["messages"] = [dict(item, name=alias) for item in messages]

    return user_message


def info_or_error_format(message: str, post_type: str) -> tuple:
    init_message = InitMessage()
    user_message = init_message.init_user_message()
    format_map = form_map()
    topic = "m2c2/{post_type}/{name}".format(
        **format_map, post_type=post_type
    )
    user_message["message"] = message
    return topic, user_message


def post_to_user(post_type: str, message: Union[str, dict]) -> None:
    try:
        if post_type == "data":
            for key in message.keys():
                formatted_payload = m2c2_stream_required_format(
                    key, message[key])

                # Validate data format
                validate_schema(formatted_payload)

                # Write messages to the GG message stream
                avail_streams = smh_client.list_streams()

                if CONNECTION_GG_STREAM_NAME not in avail_streams:
                    logger.info(
                        f"Stream {CONNECTION_GG_STREAM_NAME} not found, attempting to create it."
                    )
                    gg_exports = ExportDefinition()
                    smh_client.create_stream(
                        CONNECTION_GG_STREAM_NAME, max_stream_size, gg_exports
                    )

                smh_client.write_to_stream(
                    CONNECTION_GG_STREAM_NAME, formatted_payload)

        else:
            topic, user_message = info_or_error_format(message, post_type)
            connector_client.publish_message_to_iot_topic(topic, user_message)
    except Exception as err:
        logger.error(
            f"Failed to publish message to IoT topic or Stream Manager. Error: {err}"
        )
        raise


def device_connect(connection_data: dict) -> None:
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

                logger.error("Connection failed to %s, retry to connect...",
                             connection_data["opcDa"]["machineIp"])
                time.sleep(i + 1)
    except Exception as err:
        logger.error(f"Connection failed. Error: {err}")
        raise OPCDaConnectorException(msg.ERR_MSG_FAIL_TO_CONNECT)


def read_opc_da_data(tags: list, list_tags: list, payload_content: list) -> list:
    """
    Reads the OPC DA data from the server.

    :param tags: The individual OPC DA tags
    :param list_tags: The wildcard pattern OPC DA tags
    :param payload_content: The payload content list
    """

    # Pull data based on explicit tags provided by the user
    if tags:
        payload_content.extend(
            connection.read(tags)
        )

    # Pull data based on a wildcard pattern tags provided by the user
    # Here, to find all tags that match the wild card, we first must list the tags, then read them
    if list_tags:
        for entry in list_tags:
            payload_content.extend(
                connection.read(
                    connection.list(entry)
                )
            )

    return payload_content


def send_opc_da_data(payload_content: list, current_iteration: int, iterations: int) -> tuple:
    """
    Sends the data if the query iterations are done.

    :param payload_content: The payload content
    :param current_iteration: The current iteration
    :param iterations: The iterations to send data to the cloud
    :return: The payload content and the current iteration
    """

    if current_iteration >= iterations:
        current_iteration = 0
        post_to_user("data", convert_to_json(payload_content))
        payload_content = []

    return payload_content, current_iteration


def handle_get_data_error(connection_data: dict, error: Exception, error_count: int) -> int:
    """
    Handles job execution error.
    When it exceeds the number of retry, `ERROR_RETRY`, retry to connect to OPC DA server.
    When if fails ultimately, the connection is going to be stopped.

    :param connection_data: The connection data
    :param error: The error occurring while getting the data
    :param error_count: The number of error count
    :return: The number of error count
    """
    logger.error(f"Unable to read from server: {error}")
    error_count += 1

    if error_count >= ERROR_RETRY:
        try:
            logger.error("Connection retry to OPC DA server...")
            device_connect(connection_data)
            logger.warn(
                "Connection completed. Connection starts again...")
        except Exception as err:
            logger.error(f"Connection retry failed: {err}")
            logger.error("Stopping the connection.")

            global control
            control = "stop"
            post_to_user(
                "error", msg.ERR_MSG_LOST_CONNECTION_STOPPED.format(err))

    return error_count


def data_collection_control(connection_data: dict, payload_content: list = [], iteration: int = 0, error_count: int = 0) -> None:
    """
    Controls data collection from the OPC DA server.
    When the control is `start`, it starts reading the data based on the provided tags.
    When the control is `stop`, it stops reading the data.

    :param connection_data: The connection data
    :param payload_content: The payload content which will be sent to the cloud
    :param iteration: The current iteration
    :param error_count: The number of error count
    """

    global control, ttl, connection

    if control == "start":
        current_error_count = error_count
        current_iteration = iteration
        opc_da_data = connection_data["opcDa"]

        try:
            start_time = time.time()
            payload_content = read_opc_da_data(
                tags=opc_da_data["tags"], list_tags=opc_da_data["listTags"], payload_content=payload_content
            )

            current_iteration += 1
            current_error_count = 0

            payload_content, current_iteration = send_opc_da_data(
                payload_content=payload_content,
                current_iteration=current_iteration,
                iterations=opc_da_data["iterations"]
            )
            ttl = time.time() - start_time
        except Exception as err:
            current_error_count = handle_get_data_error(
                connection_data=connection_data,
                error=err,
                error_count=current_error_count
            )

        Timer(
            interval=opc_da_data["interval"],
            function=data_collection_control,
            args=[connection_data, payload_content,
                  current_iteration, current_error_count]
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


def start(connection_data: dict) -> None:
    """Start a connection based on the connection data."""

    try:
        if connector_client.is_running:
            post_to_user(
                "info", msg.ERR_MSG_FAIL_LAST_COMMAND_START.format(CONNECTION_NAME))
        else:
            logger.info("User request: start")

            global control
            control = "start"

            connector_client.start_client(
                connection_name=CONNECTION_NAME,
                connection_configuration=connection_data
            )
            device_connect(connection_data)

            post_to_user("info", msg.INF_MSG_CONNECTION_STARTED)
            data_collection_control(connection_data=connection_data)
    except Exception as err:
        error_message = f"Failed to execute the start: {err}"
        logger.error(error_message)
        raise OPCDaConnectorException(error_message)


def stop() -> None:
    """Stop a connection based on the connection data."""

    try:
        if connector_client.is_running:
            logger.info("User request: stop")

            global control
            control = "stop"

            time.sleep(min(5 * ttl, 3))
            local_connection_data = connector_client.read_local_connection_configuration(
                connection_name=CONNECTION_NAME
            )

            if local_connection_data:
                local_connection_data["control"] = "stop"
                connector_client.write_local_connection_configuration_file(
                    connection_name=CONNECTION_NAME,
                    connection_configuration=local_connection_data,
                )
                post_to_user("info", msg.INF_MSG_CONNECTION_STOPPED)
        else:
            post_to_user(
                "info", msg.ERR_MSG_FAIL_LAST_COMMAND_STOP.format(CONNECTION_NAME))
    except Exception as err:
        error_message = f"Failed to execute the stop: {err}"
        logger.error(error_message)
        raise OPCDaConnectorException(error_message)


def push(connection_data: dict) -> None:
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
        error_message = msg.ERR_MSG_FAIL_SERVER_NAME.format(err)
        logger.error(error_message)
        post_to_user("error", error_message)


def pull() -> None:
    """Send the local connection data, if exists, to users through the IoT topic."""

    logger.info("User request: pull")

    try:
        local_connection_data = connector_client.read_local_connection_configuration(
            CONNECTION_NAME)

        if local_connection_data:
            post_to_user("info", local_connection_data)
        else:
            post_to_user(
                "error", msg.ERR_MSG_NO_CONNECTION_FILE.format(CONNECTION_NAME))
    except Exception as err:
        error_message = msg.ERR_MSG_FAIL_SERVER_NAME.format(err)
        logger.error(error_message)
        post_to_user("error", error_message)


def convert_to_json(payload_content: list) -> dict:
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
        error_message = f"Failed to convert the data to JSON: {err}"
        logger.error(error_message)
        return {"error": error_message}


def control_switch() -> dict:
    """Acts like switch/case in the source code for the connection control."""
    return {
        "start": start,
        "stop": stop,
        "pull": pull,
        "push": push
    }


def message_handler(connection_data: dict) -> None:
    """
    OPC DA Connector message handler.

    :param connection_data: The connection data including the connection control and connection information
    """

    global lock

    try:
        if not lock:
            lock = True
            connection_control = connection_data["control"].lower()

            if connection_control in control_switch().keys():
                control_action_function = control_switch().get(
                    connection_control
                )

                # Pass the connection data when action requires the connection data as a parameter: start, update, push
                # Otherwise, it doesn't pass the connection data as a parameter: push, pull
                if len(signature(control_action_function).parameters) > 0:
                    control_action_function(connection_data)
                else:
                    control_action_function()
            else:
                post_to_user("error", msg.ERR_MSG_FAIL_UNKNOWN_CONTROL.format(
                    connection_control))

            lock = False
        else:
            logger.info("The function is still processing.")
    except Exception as err:
        logger.error(f"Failed to run the connection on the function: {err}")

        if type(err).__name__ != "KeyError":
            post_to_user("error", f"Failed to run the connection: {err}")

        lock = False
        connector_client.stop_client()

        raise


def main():
    """
    Runs infinitely unless there is an error.
    The main subscribes the `m2c2/job/{CONNECTION_NAME}` topic,
    and when it gets a message from the cloud, it handles the connection control.
    """

    topic = f"m2c2/job/{CONNECTION_NAME}"
    qos = QOS.AT_MOST_ONCE
    operation = None

    try:
        # When the connection configuration exists and the last control is `start`, start the connection.
        existing_configuration = connector_client.read_local_connection_configuration(
            connection_name=CONNECTION_NAME
        )

        if existing_configuration and existing_configuration.get("control", None) == "start":
            message_handler(existing_configuration)

        request = SubscribeToIoTCoreRequest()
        request.topic_name = topic
        request.qos = qos

        handler = SubscriptionStreamHandler(
            message_handler_callback=message_handler
        )
        ipc_client = awsiot.greengrasscoreipc.connect()
        operation = ipc_client.new_subscribe_to_iot_core(handler)
        future = operation.activate(request)
        future.result(10)  # 10 is timeout

        # Keep the main thread alive
        while True:
            time.sleep(10)
    except Exception as err:
        logger.error(f"An error occurred on the OPC DA connector: {err}")

        if operation:
            operation.close()


if __name__ == "__main__":
    main()
