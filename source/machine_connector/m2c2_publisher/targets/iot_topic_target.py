# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from converters import common_converter, sitewise_converter, tag_converter, iot_topic_converter
from utils.custom_exception import ConverterException
from utils import AWSEndpointClient


class IoTTopicTarget:
    def __init__(self, connection_name: str, protocol: str, hierarchy: dict):
        self.connection_name = connection_name
        self.protocol = protocol
        self.hierarchy = hierarchy
        self.tag_client = tag_converter.TagConverter(self.protocol)
        self.converter_client = common_converter.CommonConverter(
            self.hierarchy)
        self.sitewise_converter = sitewise_converter.SiteWiseConverter()
        self.topic_client = iot_topic_converter.IoTTopicConverter(
            self.connection_name, self.protocol)
        self.connector_client = AWSEndpointClient()

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def send_to_iot(self, payload: dict):
        try:
            self.payload = payload

            if self.protocol == "opcua":
                self.payload = self.sitewise_converter.convert_sitewise_format(
                    payload
                )

            self.tag = self.tag_client.retrieve_tag(
                self.payload
            )
            self.payload = self.converter_client.add_metadata(
                self.payload,
                self.tag
            )
            self.topic = self.topic_client.topic_converter(self.payload)
            self.connector_client.publish_message_to_iot_topic(
                self.topic,
                self.payload
            )
        except ConverterException as err:
            raise err
        except Exception as err:
            self.logger.error(
                f"Failed to publish telemetry data to the IoT topic. Error: {err}")
            raise err
