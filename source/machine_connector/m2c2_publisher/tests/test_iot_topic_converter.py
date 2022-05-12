# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from converters.iot_topic_converter import IoTTopicConverter


class TestTopicConverter(unittest.TestCase):
    def setUp(self):
        self.connection_name = "test_job"
        self.protocol = "opcda"
        self.site_name = "test_site"
        self.area = "test_area"
        self.process = "test_process"
        self.machine_name = "test_machine_name"
        self.tag = "test_tag"
        self.payload = {
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name,
            "tag": self.tag
        }
        self.client = IoTTopicConverter(self.connection_name, self.protocol)

    def test_topic_converter(self):
        self.topic = self.client.topic_converter(self.payload)
        self.assertEqual(
            self.topic, f"m2c2/data/{self.connection_name}/{self.machine_name}/{self.tag}")

    def test_incomplete_payload(self):
        self.payload = {
            "site_name": self.site_name,
            "area": self.area
        }
        with self.assertRaises(Exception):
            self.client.topic_converter(self.payload)
