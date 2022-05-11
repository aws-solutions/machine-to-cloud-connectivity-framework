# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from converters.common_converter import CommonConverter
from utils.custom_exception import ConverterException


class TestCommonConverter(unittest.TestCase):
    def setUp(self):
        self.site_name = "London"
        self.area = "floor 1"
        self.process = "packaging"
        self.machine_name = "2opcda bot1"
        self.opcda_tag = "Random-UInt4",
        self.opcua_tag = "_RealTime_Tag15"
        self.opcda_alias = f"{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{self.opcda_tag}"
        self.opcua_alias = "/Realtimedata/Tag15"
        self.hierarchy = {
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name
        }
        self.opcda_payload = {
            "alias": self.opcda_alias,
            "messages": [
                {
                    "value": 27825.0,
                    "quality": "GOOD",
                    "timestamp": 1623416516374,
                    "name": self.opcda_alias
                }
            ]
        }
        self.opcda_new_payload = {
            "alias": self.opcda_alias,
            "messages": [
                {
                    "value": 27825.0,
                    "quality": "GOOD",
                    "timestamp": 1623416516374,
                    "name": self.opcda_alias
                }
            ],
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name,
            "tag": self.opcda_tag
        }
        self.opcua_payload = {
            "alias": self.opcua_alias,
            "messages": [
                {
                    "name": self.opcua_alias,
                    "value": 3338916605,
                    "timestamp": 1623416468224,
                    "quality": "GOOD"
                }
            ]
        }
        self.opcua_new_payload = {
            "alias": self.opcua_alias,
            "messages": [
                {
                    "name": self.opcua_alias,
                    "value": 3338916605,
                    "timestamp": 1623416468224,
                    "quality": "GOOD"
                }
            ],
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name,
            "tag": self.opcua_tag
        }
        self.client = CommonConverter(self.hierarchy)

    def test_add_metadata_opcda(self):
        self.new_payload = self.client.add_metadata(
            self.opcda_payload, self.opcda_tag)
        assert self.new_payload == self.opcda_new_payload

    def test_add_metadata_opcua(self):
        self.new_payload = self.client.add_metadata(
            self.opcua_payload, self.opcua_tag)
        assert self.new_payload == self.opcua_new_payload

    def test_raise_exception(self):
        with self.assertRaises(ConverterException):
            self.client.add_metadata(self.opcua_tag, self.opcda_payload)
