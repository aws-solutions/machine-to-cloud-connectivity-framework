# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from converters.sitewise_converter import SiteWiseConverter
from utils.custom_exception import ConverterException


class TestSiteWiseConverter(unittest.TestCase):
    def setUp(self):
        self.timestamp = "2021-06-03 15:14:21.247000+00:00"
        self.sitewise_timestamp = {
            "timeInSeconds": 1622733261, "offsetInNanos": 247000000
        }
        self.name = "test_message_name"
        self.quality = "Good"
        self.client = SiteWiseConverter()

    def build_payload(self, value):
        return {
            "alias": self.name,
            "messages": [
                {
                    "name": self.name,
                    "timestamp": self.timestamp,
                    "value": value,
                    "quality": self.quality
                }
            ]
        }

    def test_convert_sitewise_format(self):
        # For quality, SiteWise always sends upper case letters, and the below is only for testing.
        payload = {
            "propertyAlias": self.name,
            "propertyValues": [
                {
                    "timestamp": self.sitewise_timestamp,
                    "value": {"stringValue": "test"},
                    "quality": "Good"
                }
            ]
        }
        converted_payload = self.client.convert_sitewise_format(payload)
        self.assertDictEqual(converted_payload, self.build_payload("test"))

    def test_convert_sitewise_format_error(self):
        with self.assertRaises(ConverterException):
            self.client.convert_sitewise_format({})

    def test_sw_required_format_string_value(self):
        value = "string"
        payload = self.build_payload(value)
        converted_payload = self.client.sw_required_format(payload)

        self.assertIn("propertyAlias", converted_payload)
        self.assertIn("propertyValues", converted_payload)

        property_values = converted_payload["propertyValues"]
        self.assertEqual(len(property_values), len(payload["messages"]))
        self.assertDictEqual(
            property_values[0]["timestamp"],
            self.sitewise_timestamp
        )
        self.assertEqual(property_values[0]["quality"], "GOOD")
        self.assertDictEqual(
            property_values[0]["value"],
            {"stringValue": value}
        )

    def test_sw_required_format_integer_value(self):
        value = 123
        payload = self.build_payload(value)
        converted_payload = self.client.sw_required_format(payload)

        self.assertIn("propertyAlias", converted_payload)
        self.assertIn("propertyValues", converted_payload)

        property_values = converted_payload["propertyValues"]
        self.assertEqual(len(property_values), len(payload["messages"]))
        self.assertDictEqual(
            property_values[0]["timestamp"],
            self.sitewise_timestamp
        )
        self.assertEqual(property_values[0]["quality"], "GOOD")
        self.assertDictEqual(
            property_values[0]["value"],
            {"integerValue": value}
        )

    def test_sw_required_format_double_value(self):
        value = 123.31
        payload = self.build_payload(value)
        converted_payload = self.client.sw_required_format(payload)

        self.assertIn("propertyAlias", converted_payload)
        self.assertIn("propertyValues", converted_payload)

        property_values = converted_payload["propertyValues"]
        self.assertEqual(len(property_values), len(payload["messages"]))
        self.assertDictEqual(
            property_values[0]["timestamp"],
            self.sitewise_timestamp
        )
        self.assertEqual(property_values[0]["quality"], "GOOD")
        self.assertDictEqual(
            property_values[0]["value"],
            {"doubleValue": value}
        )

    def test_sw_required_format_bool_value(self):
        value = True
        payload = self.build_payload(value)
        converted_payload = self.client.sw_required_format(payload)

        self.assertIn("propertyAlias", converted_payload)
        self.assertIn("propertyValues", converted_payload)

        property_values = converted_payload["propertyValues"]
        self.assertEqual(len(property_values), len(payload["messages"]))
        self.assertDictEqual(
            property_values[0]["timestamp"],
            self.sitewise_timestamp
        )
        self.assertEqual(property_values[0]["quality"], "GOOD")
        self.assertDictEqual(
            property_values[0]["value"],
            {"booleanValue": value}
        )

    def test_sw_invalid_value_type(self):
        value = {"invalid": "type"}
        payload = self.build_payload(value)

        with self.assertRaises(ConverterException):
            self.client.sw_required_format(payload)

    def test_sw_timestamp_exception(self):
        value = "string"
        payload = self.build_payload(value)
        payload["messages"][0]["timestamp"] = "2021-06-03 15B:C14:D21.247000+00:00"

        with self.assertRaises(ConverterException):
            self.client.sw_required_format(payload)
