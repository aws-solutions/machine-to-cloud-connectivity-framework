# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from utils.custom_exception import ConverterException


class IoTTopicConverter:

    def __init__(self, connection_name: str, protocol: str):
        self.connection_name = connection_name
        self.protocol = protocol

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def topic_converter(self, payload):
        try:
            iot_topic = "m2c2/data/{connection_name}/{machine_name}/{tag}".format(
                connection_name=self.connection_name,
                **payload
            )
            return iot_topic
        except Exception as err:
            error_msg = "There was an error when trying to create the IoT topic: '{}'".format(
                err
            )
            self.logger.error(error_msg)
            raise ConverterException(error_msg)
