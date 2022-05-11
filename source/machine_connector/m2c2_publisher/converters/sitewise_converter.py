# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from datetime import datetime
from dateutil import parser
from utils.custom_exception import ConverterException


class SiteWiseConverter:
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def convert_sitewise_format(self, payload):
        """
        Converts the aws.iot.SiteWiseEdgeCollectorOpcua format to the solution format:
        {
            "alias": str,
            "messages": [
                {
                    "name": alias,
                    "value": various values,
                    "quality": 'Good|GOOD|Bad|BAD|Uncertain|UNCERTAIN',
                    "timestamp": str
                }
            ]
        }

        :param payload: The payload that aws.iot.SiteWiseEdgeCollectorOpcua sends
        :return: The converted payload for the solution
        """

        try:
            alias = payload["propertyAlias"]
            solution_message = {
                "alias": alias,
                "messages": []
            }

            for message in payload["propertyValues"]:
                # Converts IoT SiteWise timestamp to the solution time
                # from "timestamp": { "timeInSeconds": 1641862679, "offsetInNanos":176000000 }
                # to "timestamp": "2022-01-10 16:57:59.176000+00:00"
                timestamp = message["timestamp"]
                time_in_seconds = timestamp["timeInSeconds"]
                offset_in_nanos = timestamp["offsetInNanos"]
                converted_timestamp = datetime.utcfromtimestamp(
                    time_in_seconds + offset_in_nanos / 1000000000
                ).strftime("%Y-%m-%d %H:%M:%S.%f+00:00")

                value = message["value"].popitem()[1]
                solution_message["messages"].append({
                    "name": alias,
                    "value": value,
                    "timestamp": converted_timestamp,
                    "quality": message["quality"]
                })

            return solution_message
        except Exception as err:
            err_msg = f"There was an issue converting the payload to solution format: {err}"
            self.logger.error(err_msg)
            raise ConverterException(err_msg)

    def sw_required_format(self, payload):
        try:
            sitewise_message = {
                "propertyAlias": payload["alias"],
                "propertyValues": []
            }

            for message in payload["messages"]:
                converted_time = parser.parse(message["timestamp"])
                timestamp = {
                    "timeInSeconds": int(converted_time.timestamp()),
                    "offsetInNanos": converted_time.microsecond * 1000
                }
                value = {}
                message_value = message["value"]
                message_value_type = type(message_value)

                if message_value_type == str:
                    value["stringValue"] = message_value
                elif message_value_type == int:
                    value["integerValue"] = message_value
                elif message_value_type == float:
                    value["doubleValue"] = message_value
                elif message_value_type == bool:
                    value["booleanValue"] = message_value
                else:
                    raise ConverterException(
                        f"Unsupported value type: {message_value_type}")

                sitewise_message["propertyValues"].append({
                    "value": value,
                    "timestamp": timestamp,
                    "quality": message["quality"].upper()
                })

            return sitewise_message
        except Exception as err:
            err_msg = f"There was an issue converting the payload to SiteWise format: {err}"
            self.logger.error(err_msg)
            raise ConverterException(err_msg)
