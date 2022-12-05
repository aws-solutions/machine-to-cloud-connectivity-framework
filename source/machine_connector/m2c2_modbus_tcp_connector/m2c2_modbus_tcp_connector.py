# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import time
import os
import awsiot.greengrasscoreipc
import traceback

from awsiot.greengrasscoreipc.model import (
    QOS,
    SubscribeToIoTCoreRequest
)
from utils import StreamManagerHelperClient, AWSEndpointClient
from utils.subscription_stream_handler import SubscriptionStreamHandler
import boilerplate.logging.logger as ConnectorLogging
from modbus_message_handler import ModbusMessageHandler


# payload array containing responses from the OPC DA server
# appended to at each execution of the thread
payload_content = []
# Measured execution time of the thread
# used to ensure the thread has completed its execution

# Constant variables
# Connection name from component environment variables
CONNECTION_NAME = os.getenv("CONNECTION_NAME")

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5G

TIMEOUT_IN_SECONDS = 10
KEEP_ALIVE_SLEEP_IN_SECONDS = 10

# Clients and logging
smh_client = StreamManagerHelperClient()
connector_client = AWSEndpointClient()
logger = ConnectorLogging.get_logger("m2c2_modbus_tcp_connector.py")

modbus_message_handler = ModbusMessageHandler()


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
            modbus_message_handler.run_message_handler(existing_configuration)

        request = SubscribeToIoTCoreRequest()
        request.topic_name = topic
        request.qos = qos

        handler = SubscriptionStreamHandler(
            message_handler_callback=modbus_message_handler.run_message_handler
        )
        ipc_client = awsiot.greengrasscoreipc.connect()
        operation = ipc_client.new_subscribe_to_iot_core(handler)
        future = operation.activate(request)
        future.result(TIMEOUT_IN_SECONDS)

        # Keep the main thread alive
        while True:
            time.sleep(KEEP_ALIVE_SLEEP_IN_SECONDS)
    except Exception as err:
        logger.error(f"An error occurred on the Modbus TCP connector: {err}")
        tb1 = traceback.TracebackException.from_exception(err)
        logger.error(''.join(tb1.format()))

        if operation:
            operation.close()


if __name__ == "__main__":
    main()
