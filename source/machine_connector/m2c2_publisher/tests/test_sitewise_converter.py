# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from converters.sitewise_converter import SiteWiseConverter


class TestSiteWiseConverter(unittest.TestCase):

    def setUp(self):
        self.timestamp = "2021-06-03 15:14:21.247000+00:00"
        self.quality = "Good"
        self.name = "test_message_name"
        self.value = "test_value"
        self.payload = {
            "messages": [
                {
                    "name": self.name,
                    "timestamp": self.timestamp,
                    "value": self.value,
                    "quality": self.quality
                }
            ]
        }
        self.client = SiteWiseConverter()
    
    def test_sw_required_format(self):
        self.converted_payload = self.client.sw_required_format(self.payload)
        self.new_timestamp = self.converted_payload["messages"][0]["timestamp"]
        self.new_quality = self.converted_payload["messages"][0]["quality"]
        self.assertEqual(self.new_timestamp, 1622733261247)
        self.assertEqual(self.new_quality, "GOOD")

    def test_sw_timestamp_exception(self):
        self.bad_time = "2021-06-03 15B:C14:D21.247000+00:00"
        self.payload["messages"][0]["timestamp"] = self.bad_time
        with self.assertRaises(Exception):
            self.client.sw_required_format(self.payload)
