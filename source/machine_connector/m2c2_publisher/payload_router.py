# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import logging
import json

from targets.iot_topic_target import IoTTopicTarget
from targets.kinesis_target import KinesisTarget
from targets.sitewise_target import SiteWiseTarget


class PayloadRouter:
    def __init__(self, protocol: str, connection_name: str, hierarchy: dict, destinations: dict,
                 destination_streams: dict, max_stream_size: int, kinesis_data_stream: str, timestream_kinesis_data_stream: str):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

        self.destinations = destinations
        self.iot_client = IoTTopicTarget(
            connection_name=connection_name,
            protocol=protocol,
            hierarchy=hierarchy
        )
        self.sitewise_client = SiteWiseTarget(
            protocol=protocol,
            sitewise_stream=destination_streams["sitewise_stream"]
        )
        self.kinesis_client = KinesisTarget(
            connection_name=connection_name,
            protocol=protocol,
            hierarchy=hierarchy,
            kinesis_sm_stream=destination_streams["kinesis_sm_stream"],
            max_stream_size=max_stream_size,
            kinesis_data_stream=kinesis_data_stream
        )
        self.timestream_kinesis_client = KinesisTarget(
            connection_name=connection_name,
            protocol=protocol,
            hierarchy=hierarchy,
            kinesis_sm_stream=destination_streams["timestream_kinesis_stream"],
            max_stream_size=max_stream_size,
            kinesis_data_stream=timestream_kinesis_data_stream,
            is_timestream_kinesis=True
        )

    def route_payload(self, message):
        """
        The payload router routes telemetry data based on set destinations in the destinations dictionary
        """
        try:
            payload = json.loads(message.payload)
            message_sequence_number = message.sequence_number

            if self.destinations["send_to_sitewise"]:
                sitewise_payload = copy.deepcopy(payload)
                self.sitewise_client.send_to_sitewise(sitewise_payload)

            if self.destinations["send_to_kinesis_stream"]:
                kinesis_payload = copy.deepcopy(payload)
                self.kinesis_client.send_to_kinesis(kinesis_payload)

            if self.destinations["send_to_iot_topic"]:
                iot_payload = copy.deepcopy(payload)
                self.iot_client.send_to_iot(iot_payload)

            if self.destinations["send_to_timestream"]:
                timestream_payload = copy.deepcopy(payload)
                self.timestream_kinesis_client.send_to_kinesis(
                    timestream_payload
                )

            return message_sequence_number
        except TypeError as err:
            self.logger.error(
                f"There was an error raised when trying to route the data payload: {err}")
            raise
        except Exception as err:
            self.logger.error(f"An error was raised: {err}")
            raise
