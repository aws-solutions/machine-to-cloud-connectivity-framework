# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import greengrasssdk
import logging
import json
import os

from datetime import datetime


class AWSEndpointClient:
    """
    Creates a client for the connector. All parameters are required.
    """

    CONFIGURATION_PATH = "/m2c2/job"

    def __init__(self):
        # class general variables
        self.has_started = False
        self.is_running = False

        # Logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

        # Greegrass IoT data client
        self.iot_client = greengrasssdk.client("iot-data")

    def start_client(self, connection_name: str, connection_configuration: dict) -> None:
        """
        Starts the connector client.
        """
        self.write_local_connection_configuration_file(
            connection_name=connection_name, connection_configuration=connection_configuration
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

        :param topic: The IoT topic to publish the payload.
        :param payload: The payload to publish.
        """
        try:
            self.iot_client.publish(topic=topic, qos=1, payload=json.dumps(payload))
        except Exception as err:
            self.logger.error("Failed to publish telemetry data to the IoT topic. Error: %s", str(err))

    def read_local_connection_configuration(self, connection_name: str) -> dict:
        """
        Reads the local connection configuration file.

        :param connection_name: The connection name to get the local connection configuration.
        :return: The local configuration dictionary for the connection. If the file does not exist, return an empty dictionary.
        :raises: :err:`Exception` when any exception happens.
        """
        try:
            file_name = "{path}/{connection_name}.json".format(
                path=self.CONFIGURATION_PATH, connection_name=connection_name
            )

            if os.path.exists(file_name):
                with open(file_name) as file:
                    return json.load(file)
            else:
                return {}
        except Exception as err:
            self.logger.error("Failed to read the file: %s", str(err))
            raise Exception("Failed to read the file: {}".format(err))

    def write_local_connection_configuration_file(self, connection_name: str, connection_configuration: dict) -> None:
        """
        Writes the local connection configuration file.

        :param connection_name: The connection name to write the local connection configuration.
        :param connection_configuration: The connection configuration to write locally.
        :raises: :err:`Exception` when any exception happens.
        """
        try:
            connection_configuration["_last-update-timestamp_"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
            file_name = "{path}/{connection_name}.json".format(
                path=self.CONFIGURATION_PATH, connection_name=connection_name
            )

            with open(file_name, "w+") as file:
                json.dump(connection_configuration, file, indent=2)
        except Exception as err:
            self.logger.error("Failed to write to file: %s", str(err))
            raise Exception("Failed to write to file: {}".format(err))
