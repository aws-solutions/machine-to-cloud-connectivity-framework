# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import logging
import json

from targets.iot_topic_target import IoTTopicTarget
from targets.kinesis_target import KinesisTarget
from targets.sitewise_target import SiteWiseTarget

# Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class PayloadRouter:

    def __init__(self, protocol: str, connection_name: str, hierarchy: dict, destinations: dict,
                 destination_streams: dict, max_stream_size: int, kinesis_data_stream: str):
        # Setting local values for protocol, metadata, destinations, destination streams
        self.protocol = protocol
        self.connection_name = connection_name
        self.hierarchy = hierarchy
        self.destinations = destinations
        self.destination_streams = destination_streams
        self.max_stream_size = max_stream_size
        self.kinesis_data_stream = kinesis_data_stream


    def route_payload(self, message):
        """
        The payload router routes telemetry data based on set destinations in the destinations dictionary
        """
        try:
            self.payload = json.loads(message.payload)
            self.message_sequence_number = message.sequence_number
            if self.destinations['send_to_sitewise']:
                self.sw_payload = copy.deepcopy(self.payload)
                self.sw_client = SiteWiseTarget(
                    self.protocol,
                    self.destination_streams['sitewise_stream']
                )
                self.sw_client.send_to_sitewise(self.sw_payload)
            if self.destinations['send_to_kinesis_stream']:
                self.k_payload = copy.deepcopy(self.payload)
                self.k_client = KinesisTarget(
                    self.connection_name,
                    self.protocol,
                    self.hierarchy,
                    self.destination_streams['kinesis_sm_stream'],
                    self.max_stream_size,
                    self.kinesis_data_stream
                )
                self.k_client.send_to_kinesis(
                    self.k_payload
                )
            if self.destinations['send_to_iot_topic']:
                self.iot_payload = copy.deepcopy(self.payload)
                self.iot_client = IoTTopicTarget(self.connection_name, self.protocol, self.hierarchy)
                self.iot_client.send_to_iot(self.iot_payload)
            return self.message_sequence_number
        except TypeError as err:
            logger.error("There was an error raised when trying to route the data payload: %s", str(err))
            raise
        except Exception as err:
            logger.error("An error was raised: %s", str(err))
            raise

