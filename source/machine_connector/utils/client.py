# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import json
import os
import awsiot.greengrasscoreipc

from awsiot.greengrasscoreipc.model import (
    PublishToIoTCoreRequest,
    QOS
)
from datetime import datetime
from utils.custom_exception import FileException
from utils.constants import WORK_BASE_DIR


class AWSEndpointClient:
    CONFIG_FILE_NAME = "opc-da-config.json"

    def __init__(self):
        # class general variables
        self.has_started = False
        self.is_running = False

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

        # Greengrass IPC client
        self.ipc_client = awsiot.greengrasscoreipc.connect()

    def start_client(self, connection_name: str, connection_configuration: dict) -> None:
        """
        Starts the connector client.
        """
        self.write_local_connection_configuration_file(
            connection_name=connection_name,
            connection_configuration=connection_configuration
        )
        self.has_started = True
        self.is_running = True

    def stop_client(self) -> None:
        """
        Stops the connector client.
        """
        self.is_running = False

    def publish_message_to_iot_topic(self, topic: str, payload: dict) -> None:
        """
        Publishes a message to the IoT topic.
        For more information, refer to
        https://docs.aws.amazon.com/greengrass/v2/developerguide/ipc-iot-core-mqtt.html#ipc-operation-publishtoiotcore

        :param topic: The IoT topic to publish the payload.
        :param payload: The payload to publish.
        """
        try:
            request = PublishToIoTCoreRequest()
            request.topic_name = topic
            request.payload = bytes(json.dumps(payload), "utf-8")
            request.qos = QOS.AT_MOST_ONCE

            operation = self.ipc_client.new_publish_to_iot_core()
            operation.activate(request)
        except Exception as err:
            self.logger.error(
                f"Failed to publish message to the IoT topic: {topic}. Error: {err}"
            )

    def read_local_connection_configuration(self, connection_name: str) -> dict:
        """
        Reads the local connection configuration file.

        :param connection_name: The connection name to get the local connection configuration.
        :return: The local configuration dictionary for the connection. If the file does not exist, return an empty dictionary.
        :raises: :err:`FileException` when any exception happens.
        """
        try:
            file_name = f"{WORK_BASE_DIR}/m2c2-{connection_name}/{self.CONFIG_FILE_NAME}"

            if os.path.exists(file_name):
                with open(file_name) as file:
                    return json.load(file)
            else:
                return {}
        except Exception as err:
            error_message = f"Failed to read the file: {err}"
            self.logger.error(error_message)
            raise FileException(error_message)

    def write_local_connection_configuration_file(self, connection_name: str, connection_configuration: dict) -> None:
        """
        Writes the local connection configuration file.

        :param connection_name: The connection name to write the local connection configuration.
        :param connection_configuration: The connection configuration to write locally.
        :raises: :err:`FileException` when any exception happens.
        """
        try:
            connection_configuration["_last-update-timestamp_"] = datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S.%f")
            file_name = f"{WORK_BASE_DIR}/m2c2-{connection_name}/{self.CONFIG_FILE_NAME}"

            with open(file_name, "w+") as file:
                json.dump(connection_configuration, file, indent=2)
        except Exception as err:
            error_message = f"Failed to write to file: {err}"
            self.logger.error(error_message)
            raise FileException(error_message)
