# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import sys
import unittest

from dateutil import parser
from unittest import mock
from utils.custom_exception import ConverterException
from targets import KinesisTarget

gg_mock = mock.MagicMock()
sys.modules["greengrasssdk"] = gg_mock
sys.modules["greengrasssdk.stream_manager"] = gg_mock
sys.modules["dbm"] = mock.MagicMock()


class TestKinesisTarget(unittest.TestCase):
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
        self.greengrass_stream = "test_greengrass_stream"
        self.kinesis_data_stream = "test_kinesis_data_stream"
        self.max_stream_size = 46
        self.opcua_alias = "/AnyCompany/1/Pressure"
        self.timestamp = "2021-06-03 15:14:21.247000+00:00"

    @mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
    def test_opcda(self, mock_stream_manager_helper):
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
        avail_streams_exists = ["test1stream", self.greengrass_stream]

        kinesis_target = KinesisTarget(
            self.connection_name,
            "opcda",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.kinesis_data_stream
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client = mock_sm_client
        kinesis_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock(
            return_value=avail_streams_exists)
        kinesis_target.sm_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        kinesis_target.send_to_kinesis(opcda_payload)
        self.assertDictEqual(expected_payload, kinesis_target.payload)

    @mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
    def test_opcua(self, mock_stream_manager_helper):
        opcua_payload = {
            "propertyAlias": self.opcua_alias,
            "propertyValues": [
                {
                    "value": {"doubleValue": 123.12},
                    "quality": "GOOD",
                    "timestamp": {
                        "timeInSeconds": 1622733261,
                        "offsetInNanos": 247000000
                    }
                }
            ]
        }
        expected_payload = {
            "alias": self.opcua_alias,
            "messages": [
                {
                    "name": self.opcua_alias,
                    "value": 123.12,
                    "quality": "GOOD",
                    "timestamp": self.timestamp
                }
            ],
            "site_name": self.site_name,
            "area": self.area,
            "process": self.process,
            "machine_name": self.machine_name,
            "tag": self.opcua_alias.replace("/", "_")
        }
        avail_streams_exists = ["test1stream"]

        kinesis_target = KinesisTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.kinesis_data_stream
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client = mock_sm_client
        kinesis_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock(
            return_value=avail_streams_exists)
        kinesis_target.sm_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        kinesis_target.send_to_kinesis(opcua_payload)
        self.assertDictEqual(expected_payload, kinesis_target.payload)

    @mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
    def test_timestream(self, mock_stream_manager_helper):
        tag = "Random.Int4"
        value = 27652.13
        quality = "Good"
        alias = f"{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{tag}"
        opcda_payload = {
            "alias": alias,
            "messages": [
                {
                    "name": alias,
                    "value": value,
                    "quality": quality,
                    "timestamp": self.timestamp
                }
            ]
        }
        avail_streams_exists = ["test1stream", self.greengrass_stream]

        kinesis_target = KinesisTarget(
            self.connection_name,
            "opcda",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.kinesis_data_stream,
            True
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client = mock_sm_client
        kinesis_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock(
            return_value=avail_streams_exists)
        kinesis_target.sm_client.write_to_stream = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client.write_to_stream.reset_mock()

        kinesis_target.send_to_kinesis(opcda_payload)
        kinesis_target.sm_client.write_to_stream.assert_called_with(
            self.greengrass_stream,
            {
                "site": self.site_name,
                "area": self.area,
                "process": self.process,
                "machine": self.machine_name,
                "tag": tag,
                "quality": quality,
                "timestamp": parser.parse(self.timestamp).timestamp() * 1000,
                "value": value
            }
        )

    def test_opcua_converter_error(self):
        opcua_payload = {
            "alias": self.opcua_alias,
            "messages": [
                {
                    "name": self.opcua_alias,
                    "value": 123.12,
                    "quality": "GOOD",
                    "timestamp": self.timestamp
                }
            ]
        }

        kinesis_target = KinesisTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.kinesis_data_stream
        )

        with self.assertRaises(ConverterException):
            kinesis_target.send_to_kinesis(opcua_payload)
            assert not kinesis_target.sm_client.list_streams.called

    @mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
    def test_kinesis_stream_not_exists(self, mock_stream_manager_helper):
        opcua_payload = {
            "propertyAlias": self.opcua_alias,
            "propertyValues": [
                {
                    "value": {"doubleValue": 123.12},
                    "quality": "GOOD",
                    "timestamp": {
                        "timeInSeconds": 1622733261,
                        "offsetInNanos": 247000000
                    }
                }
            ]
        }

        kinesis_target = KinesisTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.kinesis_data_stream
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client = mock_sm_client
        kinesis_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock()
        kinesis_target.sm_client.list_streams.side_effect = Exception(
            "Failure")

        with self.assertRaises(ConnectionError):
            kinesis_target.send_to_kinesis(opcua_payload)
            assert kinesis_target.sm_client.list_streams.called
