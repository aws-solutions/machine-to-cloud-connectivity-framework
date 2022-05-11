# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import sys
import unittest

from unittest import mock
from utils.custom_exception import ConverterException
from targets import IoTTopicTarget

awsiot_mock = mock.MagicMock()
sys.modules["awsiot"] = awsiot_mock
sys.modules["awsiot.greengrasscoreipc"] = awsiot_mock
sys.modules["awsiot.greengrasscoreipc.model"] = awsiot_mock
sys.modules["dbm"] = mock.MagicMock()


@mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
class TestIoTTopicTarget(unittest.TestCase):
    def setUp(self):
        self.connection_name = "test_connection_name"
        self.site_name = "test_site"
        self.area = "test_area"
        self.process = "test_process"
        self.machine_name = "test_machine_name"
        self.hierarchy = {
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name
        }
        self.timestamp = "2021-06-03 15:14:21.247000+00:00"

    def test_opc_da(self, mock_endpoint_client):
        tag = "Random.Int4"
        alias = f"{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{tag}"
        opcda_payload = {
            "alias": alias,
            "messages": [
                {
                    "name": alias,
                    "value": 27652.13,
                    "quality": "Good",
                    "timestamp": self.timestamp
                }
            ]
        }
        expected_payload = copy.deepcopy(opcda_payload)
        expected_payload["site_name"] = self.site_name
        expected_payload["area"] = self.area
        expected_payload["process"] = self.process
        expected_payload["machine_name"] = self.machine_name
        expected_payload["tag"] = tag
        iot_topic = f"m2c2/data/{self.connection_name}/{self.machine_name}/{tag}"

        iot_target = IoTTopicTarget(
            self.connection_name, "opcda", self.hierarchy)
        mock_connector_client = mock_endpoint_client.MagicMock()
        iot_target.connector_client = mock_connector_client
        iot_target.connector_client.publish_message_to_iot_topic = mock_endpoint_client.MagicMock()

        iot_target.send_to_iot(opcda_payload)
        self.assertDictEqual(expected_payload, iot_target.payload)
        assert iot_target.connector_client.publish_message_to_iot_topic.called
        assert iot_target.connector_client.publish_message_to_iot_topic.called_with(
            iot_topic, expected_payload)

    def test_opc_da_missing_alias(self, mock_endpoint_client):
        tag = "Random.Int4"
        alias = f"{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{tag}"
        opcda_payload = {
            "messages": [
                {
                    "name": alias,
                    "value": 27652.13,
                    "quality": "Good",
                    "timestamp": self.timestamp
                }
            ]
        }

        iot_target = IoTTopicTarget(
            self.connection_name, "opcda", self.hierarchy)

        with self.assertRaises(Exception):
            iot_target.send_to_iot(opcda_payload)

    def test_opc_ua_error(self, mock_endpoint_client):
        opcua_payload = {
            "alias": "/AnyCompany/1/Pressure",
            "messages": [
                {
                    "name": "/AnyCompany/1/Pressure",
                    "value": 123.12,
                    "quality": "GOOD",
                    "timestamp": self.timestamp
                }
            ]
        }

        iot_target = IoTTopicTarget(
            self.connection_name, "opcua", self.hierarchy)

        with self.assertRaises(ConverterException):
            iot_target.send_to_iot(opcua_payload)
