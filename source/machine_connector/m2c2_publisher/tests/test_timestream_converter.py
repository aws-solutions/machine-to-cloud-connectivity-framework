# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from dateutil import parser
from converters.timestream_converter import TimestreamConverter
from utils.custom_exception import ConverterException


class TestTimestreamConverter(unittest.TestCase):
    def setUp(self):
        self.timestream_converter = TimestreamConverter()
        self.hierarchy = {
            "site_name": "site",
            "area": "area",
            "process": "process",
            "machine_name": "machine",
            "tag": "MockTag",
        }
        self.timestamp = "2022-03-14 12:34:56.789000+00:00"

    def test_convert_timestream_format(self):
        payload = {
            "alias": "/site/area/process/machine/MockTag",
            "messages": [
                {
                    "name": "/site/area/process/machine/MockTag",
                    "quality": "Good",
                    "value": "mock",
                    "timestamp": self.timestamp
                }
            ],
            **self.hierarchy
        }
        kinesis_records = self.timestream_converter.convert_timestream_format(
            payload
        )
        self.assertListEqual(kinesis_records, [{
            "site": payload.get("site_name"),
            "area": payload.get("area"),
            "process": payload.get("process"),
            "machine": payload.get("machine_name"),
            "tag": payload.get("tag"),
            "quality": "Good",
            "timestamp": parser.parse(self.timestamp).timestamp() * 1000,
            "value": "mock"
        }])

    def test_convert_timestream_format_error(self):
        with self.assertRaises(ConverterException):
            self.timestream_converter.convert_timestream_format({
                "messages": [{
                    "timestamp": "invalid_timestamp_format"
                }]
            })
