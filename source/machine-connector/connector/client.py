# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import greengrasssdk
import logging
import json
import os
import time

from greengrasssdk.stream_manager import (
    ExportDefinition,
    KinesisConfig,
    MessageStreamDefinition,
    ResourceNotFoundException,
    InvalidRequestException,
    StrategyOnFull,
    StreamManagerClient
)
from datetime import datetime


class ConnectorClient:
    """
    Creates a client for the connector. All parameters are required.

    :param kinesis_stream_name: The Kinesis Stream name to send the Stream Manager messages.
    """

    CONFIGURATION_PATH = "/m2c2/job"

    def __init__(self, kinesis_stream_name: str, connection_retry: int = 10):
        # class general variables
        self.has_started = False
        self.is_running = False
        self.kinesis_stream_name = kinesis_stream_name

        # Logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

        # Stream Manager client and Greegrass IoT data client
        self.stream_name = "m2c2-stream"
        self.iot_client = greengrasssdk.client("iot-data")

        # Connection retry if Stream Manager is not ready
        for i in range(connection_retry):
            try:
                self.stream_manager_client = StreamManagerClient()
                break
            except Exception as err:
                if i == connection_retry - 1:
                    self.logger.error("Unable to connect to Stream Manager. Error: %s", str(err))
                    self.stream_manager_client = None
                    break

                time.sleep(i + 1)

    def set_kinesis_stream_name(self, kinesis_stream_name: str) -> None:
        """
        Sets the Kinesis Stream name.

        :param kinesis_stream_name: The Kinesis Stream name to send the Stream Manager messages.
        """
        self.kinesis_stream_name = kinesis_stream_name

    def start_client(self, job_name: str, job_configuration: dict) -> None:
        """
        Starts the connector client. It sets up the Stream Manager client.
        """
        self.set_stream_manager_client()
        self.write_local_job_configuration_file(
            job_name=job_name, job_configuration=job_configuration
        )
        self.has_started = True
        self.is_running = True

    def stop_client(self) -> None:
        """
        Stops the connector client. It closes the Stream Manager connection.
        """
        self.close_stream_manager_client()
        self.is_running = False

    def set_stream_manager_client(self) -> None:
        """
        Sets the Stream Manager client only when Kinesis Stream name is provided.
        Failure of the Stream Manager client does not block any other actions.

        :param job_name: The job name for the stream.
        :raises: :err:`Exception` when any exception other than `InvalidRequestException` happens.
        """
        if self.kinesis_stream_name:
            if not self.stream_manager_client.connected:
                self.stream_manager_client = StreamManagerClient()

            try:
                exports = ExportDefinition(
                    kinesis=[
                        KinesisConfig(
                            identifier="KinesisExport",
                            kinesis_stream_name=self.kinesis_stream_name,
                            batch_size=1
                        )
                    ]
                )

                self.stream_manager_client.create_message_stream(
                    MessageStreamDefinition(
                        name=self.stream_name,
                        strategy_on_full=StrategyOnFull.OverwriteOldestData,
                        export_definition=exports
                    )
                )
            except InvalidRequestException:
                # One centralized stream manager is going to be used to send data to Kinesis Data Stream,
                # so `InvalidRequestException` will happens when new job is deployed.
                pass
            except Exception as err:
                self.logger.error("Unknown error happened, so your Stream Manager might not be working: %s", str(err))

    def close_stream_manager_client(self) -> None:
        """
        Closes the Stream Manager client.
        """
        try:
            self.stream_manager_client.close()
        except:
            pass

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

    def append_stream_manager_message(self, message: dict) -> None:
        """
        Appends a message to the Stream Manager.

        :param message: The message to append.
        """
        try:
            self.stream_manager_client.append_message(
                stream_name=self.stream_name, data=json.dumps(message).encode("utf-8")
            )
        except Exception as err:
            self.logger.error("Failed to append telemetry data to the Stream Manager. Error: %s", str(err))

    def read_local_job_configuration(self, job_name: str) -> dict:
        """
        Reads the local job configuration file.

        :param job_name: The job name to get the local job configuration.
        :return: The local configuration dictionary for the job. If the file does not exist, return an empty dictionary.
        :raises: :err:`Exception` when any exception happens.
        """
        try:
            file_name = "{path}/{job_name}.json".format(
                path=self.CONFIGURATION_PATH, job_name=job_name
            )

            if os.path.exists(file_name):
                with open(file_name) as file:
                    return json.load(file)
            else:
                return {}
        except Exception as err:
            self.logger.error("Failed to read the file: %s", str(err))
            raise Exception("Failed to read the file: {}".format(err))

    def write_local_job_configuration_file(self, job_name: str, job_configuration: dict) -> None:
        """
        Writes the local job configuration file.

        :param job_name: The job name to write the local job configuration.
        :param job_configuration: The job configuration to write locally.
        :raises: :err:`Exception` when any exception happens.
        """
        try:
            job_configuration["job"]["_last-update-timestamp_"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
            file_name = "{path}/{job_name}.json".format(
                path=self.CONFIGURATION_PATH, job_name=job_name
            )

            with open(file_name, "w+") as file:
                json.dump(job_configuration, file, indent=2)
        except Exception as err:
            self.logger.error("Failed to write to file: %s", str(err))
            raise Exception("Failed to write to file: {}".format(err))
