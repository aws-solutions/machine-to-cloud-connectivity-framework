# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from dateutil import parser
from utils.custom_exception import ConverterException


class TimestreamConverter:
    def __init__(self) -> None:
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def convert_timestream_format(self, payload: dict) -> list:
        """
        Converts the below solution format to below Timestream format:
        [
            {
                "areaName": str,
                "machineName": str,
                "process": str,
                "quality": "Good" | "GOOD" | "Bad" | "BAD" | "Uncertain" | "UNCERTAIN",
                "site": str,
                "tag": str,
                "timestamp": Unix epoch time in ms,
                "value": various values
            }
        ]

        :param payload: The payload that the solution sends
        :return: The Kinesis records for the Timestream
        """

        try:
            messages = payload.get("messages")
            metadata = {
                "site": payload.get("site_name"),
                "area": payload.get("area"),
                "process": payload.get("process"),
                "machine": payload.get("machine_name"),
                "tag": payload.get("tag")
            }
            records = []

            for message in messages:
                records.append({
                    **metadata,
                    "quality": message.get("quality"),
                    "timestamp": parser.parse(message.get("timestamp")).timestamp() * 1000,
                    "value": message.get("value"),
                })

            return records
        except Exception as err:
            error_message = f"There was an issue converting the payload to solution format: {err}"
            self.logger.error(error_message)
            raise ConverterException(error_message)
