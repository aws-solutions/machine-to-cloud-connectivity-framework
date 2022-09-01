# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0


import json
import logging
from pickle import NONE
import sys
import time
import os
from typing import Union
import messages as msg
import awsiot.greengrasscoreipc
from threading import Timer
import traceback
from datetime import timedelta

from pi_connector_sdk.pi_connection_config import PiConnectionConfig
from pi_connector_sdk.osi_pi_connector import OsiPiConnector
from pi_connector_sdk.enhanced_json_encoder import EnhancedJSONEncoder

from awsiot.greengrasscoreipc.model import (
    QOS,
    SubscribeToIoTCoreRequest,
    GetSecretValueRequest
)

from greengrasssdk.stream_manager import ExportDefinition
from inspect import signature
from pi_connector_sdk.pi_response import PiResponse
from validations.message_validation import MessageValidation
from utils import StreamManagerHelperClient, AWSEndpointClient, InitMessage
from utils.subscription_stream_handler import SubscriptionStreamHandler
from utils.custom_exception import ConnectorException

# payload array containing responses from the OPC DA server
# appended to at each execution of the thread
payload_content = []
control = ""  # connection control variables monitored by the thread
lock = False  # flag used to prevent concurrency
# Measured execution time of the thread
# used to ensure the thread has completed its execution
ttl = 0.2
osi_pi_connector = None
web_ids = []


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
# Log Level Setting
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5G

# Clients and logging
smh_client = StreamManagerHelperClient()
connector_client = AWSEndpointClient()

try:
    print(f"setting log level to: {LOG_LEVEL}")
    logging.basicConfig(stream=sys.stdout, level=LOG_LEVEL)
except Exception as err:
    print("Setting log level failed...using default log level")
    print(err)
    logging.basicConfig(stream=sys.stdout, level="INFO")

logger = logging.getLogger()
logger.info(f"Using Log Level: {LOG_LEVEL}")


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
        raise ConnectorException(msg.ERR_MSG_VALIDATION.format(err))


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


"""Configures Connection from the Device to OSI PI server."""


def create_pi_config(connection_data: dict):

    pi_config = PiConnectionConfig()

    pi_config.server_connection.api_url = connection_data['osiPi']["apiUrl"]
    pi_config.server_connection.verify_ssl = connection_data['osiPi']["verifySSL"]
    pi_config.server_connection.server_name = connection_data['osiPi']["serverName"]
    pi_config.server_connection.auth_mode = connection_data['osiPi']['authMode']

    if connection_data['osiPi']['authMode'] == "BASIC":

        try:

            secret_id = connection_data['osiPi']['credentialSecretArn']
            TIMEOUT = 10
            ipc_client = awsiot.greengrasscoreipc.connect()

            request = GetSecretValueRequest()
            request.secret_id = secret_id
            request.version_stage = 'AWSCURRENT'
            operation = ipc_client.new_get_secret_value()
            operation.activate(request)
            future_response = operation.get_response()
            response = future_response.result(TIMEOUT)
            secret_json = json.loads(response.secret_value.secret_string)
            # Handle secret value.

            pi_config.server_connection.auth_param.username = secret_json['username']
            pi_config.server_connection.auth_param.password = secret_json['password']

        except Exception as e:
            logger.error('Failed to read secret')
            logger.error("Failed Secret..." + str(traceback.format_exc()))

            raise e

    pi_config.query_config.tag_names = connection_data['osiPi']['tags']
    pi_config.query_config.req_frequency_sec = float(
        connection_data['osiPi']['requestFrequency'])
    pi_config.query_config.catchup_req_frequency_sec = float(
        connection_data['osiPi']['catchupFrequency'])
    pi_config.query_config.max_req_duration_sec = float(
        connection_data['osiPi']['maxRequestDuration'])
    pi_config.query_config.query_offset_from_now_sec = float(
        connection_data['osiPi']['queryOffset'])

    return pi_config


def device_connect(connection_data: dict) -> None:

    try:
        global osi_pi_connector, web_ids

        if osi_pi_connector:
            logger.warn("PI Connector exists, disposing it...")
            osi_pi_connector = None
            logger.warn("Pi Connector disposed")

        pi_config = create_pi_config(connection_data)

        logger.info(
            f'Running with the following tags: {json.dumps(pi_config.query_config.tag_names)}')

        osi_pi_connector = OsiPiConnector(pi_config)
        web_ids = osi_pi_connector.get_web_ids_for_tag_names(
            pi_config.query_config.tag_names)

        logger.debug(f'got webIds: {json.dumps(web_ids)}')

    except Exception as err:
        logger.error(f"Connection failed. Error: {err}")
        raise ConnectorException(msg.ERR_MSG_FAIL_TO_CONNECT)


"""
Controls data collection from the OPC DA server.
When the control is `start`, it starts reading the data based on the provided tags.
When the control is `stop`, it stops reading the data.

:param connection_data: The connection data
:param payload_content: The payload content which will be sent to the cloud
:param iteration: The current iteration
:param error_count: The number of error count
"""


def data_collection_control(connection_data: dict, iteration: int = 0, error_count: int = 0) -> None:

    global control, ttl, osi_pi_connector, web_ids

    if control == "start":
        current_iteration = iteration
        osi_pi_config = osi_pi_connector.connection_config

        next_timer_interval = osi_pi_config.query_config.req_frequency_sec

        try:

            current_iteration += 1

            logger.debug(f'loop count: {current_iteration}')

            thread_start_time = time.time()

            query_start_time, query_end_time, is_offset_from_latest_request_query = osi_pi_connector.time_helper.get_calculated_time_range(
                osi_pi_config.query_config.max_req_duration_sec, osi_pi_config.query_config.query_offset_from_now_sec)

            logger.debug(f"""
                Requesting data for time range:
                    startTime: {str(query_start_time)}
                    endTime: {str(query_end_time)}
                    isOffsetFromLatestRequestedQuery: {is_offset_from_latest_request_query}
            """)

            payload_content = osi_pi_connector.get_historical_data_batch(
                web_ids=web_ids, start_time=query_start_time, end_time=query_end_time)

            logger.debug(json.dumps(payload_content, cls=EnhancedJSONEncoder))

            send_osi_pi_data(payload_content=payload_content)

            ttl = time.time() - thread_start_time

            # If we are all caught up, sleep for the request frequency duration,
            # otherwise, we need to loop quickly to catch up with now
            if is_offset_from_latest_request_query:
                next_timer_interval = osi_pi_config.query_config.catchup_req_frequency_sec

            # Update time log with last succesful read time. This is what is used as start time next run
            # Time is incremented by 1ms to prevent a duplicate value at the exact time
            next_start_time = query_end_time + timedelta(milliseconds=1)
            osi_pi_connector.time_helper.write_datetime_to_time_log(
                next_start_time)

            error_count = 0

        except Exception as err:
            logger.error("Failed..." + str(traceback.format_exc()))
            error_count = handle_get_data_error(
                connection_data=connection_data,
                error=err,
                error_count=error_count
            )

        Timer(
            interval=next_timer_interval,
            function=data_collection_control,
            args=[connection_data, current_iteration, error_count]
        ).start()

    elif control == "stop":
        connector_client.stop_client()
        osi_pi_connector = None


def send_osi_pi_data(payload_content: 'list[PiResponse]') -> None:
    """
    Sends the data.

    :param payload_content: The payload content
    :return: None
    """

    formatted_data_group = {}
    got_new_record = False

    for pi_response in payload_content:

        formatted_datas = []

        for record in pi_response.records:

            quality = 'Good'
            if not record['Good']:
                quality = 'Bad'

            formatted_data = {
                'value': record['Value'],
                'quality': quality,
                'timestamp': record['Timestamp']
            }

            formatted_datas.append(formatted_data)

        if len(formatted_datas) > 0:
            got_new_record = True
            formatted_data_group[pi_response.name] = formatted_datas

    if got_new_record:
        post_to_user("data", formatted_data_group)
    else:
        logger.info('No new records found in current interval...')


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
        raise ConnectorException(error_message)


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
        raise ConnectorException(error_message)


def push(connection_data: dict) -> None:
    """Send the list of servers to users through the IoT topic."""

    logger.info("User request: push")

    try:
        config = create_pi_config(connection_data)

        # TODO: Add Query here to make sure server actually is available
        post_to_user("info", msg.INF_MSG_SERVER_NAME.format(
            config.server_connection.server_name))
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
    OSI PI Connector message handler.

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


def handle_get_data_error(connection_data: dict, error: Exception, error_count: int) -> int:
    """
    Handles job execution error.
    When it exceeds the number of retry, `ERROR_RETRY`, retry to connect to OSI PI server.
    When if fails ultimately, the connection is going to be stopped.

    :param connection_data: The connection data
    :param error: The error occurring while getting the data
    :param error_count: The number of error count
    :return: The number of error count
    """
    logger.error(f"Unable to read from server: {error}")
    error_count += 1

    if error_count >= ERROR_RETRY:
        logger.error(f"Query Failed to OSI PI server...{error}")
        global control
        control = "stop"
        post_to_user(
            "error", msg.ERR_MSG_LOST_CONNECTION_STOPPED.format(error))

    return error_count


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
        logger.error(f"An error occurred on the OSI PI connector: {err}")

        if operation:
            operation.close()


if __name__ == "__main__":
    main()
