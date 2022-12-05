# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import sys
import unittest

from dateutil import parser
from unittest import mock
from utils.custom_exception import ConverterException
from targets import HistorianTarget

gg_mock = mock.MagicMock()
sys.modules["greengrasssdk"] = gg_mock
sys.modules["greengrasssdk.stream_manager"] = gg_mock
sys.modules["dbm"] = mock.MagicMock()


class TestHistorianTarget(unittest.TestCase):
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
        self.historian_data_stream = "test_historian_data_stream"
        self.max_stream_size = 46
        self.opcua_alias = "/AnyCompany/1/Pressure"
        self.timestamp = "2021-06-03 15:14:21.247000+00:00"
        self.collector_id = "test-collector-id"

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

        avail_streams_exists = ["test1stream", self.greengrass_stream]

        expected_payload = [{'sourceId': 'test_connection_name', 'collectorId': 'test-collector-id', 'measurementId': 'Random.Int4',
                             'measureName': 'Random.Int4', 'value': 27652.13, 'measureQuality': 'Good'}]

        historian_target = HistorianTarget(
            self.connection_name,
            "opcda",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.historian_data_stream,
            self.collector_id
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        historian_target.sm_client = mock_sm_client
        historian_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock(
            return_value=avail_streams_exists)
        historian_target.sm_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        historian_target.send_to_kinesis(opcda_payload)
        args = historian_target.sm_client.write_to_stream.call_args.args

        self.assertEqual(args[0], 'test_greengrass_stream')
        self.assertEqual(len(args[1]), 8)
        self.assertEqual(args[1]['sourceId'],
                         expected_payload[0]['sourceId'])
        self.assertEqual(args[1]['collectorId'],
                         expected_payload[0]['collectorId'])
        self.assertEqual(args[1]['measurementId'],
                         expected_payload[0]['measurementId'])
        self.assertEqual(args[1]['measureName'],
                         expected_payload[0]['measureName'])
        self.assertEqual(args[1]['value'], expected_payload[0]['value'])
        self.assertEqual(args[1]['measureQuality'],
                         expected_payload[0]['measureQuality'])
        self.assertTrue('timestamp' in args[1])

    @ mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
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
        expected_payload = [{'sourceId': 'test_connection_name', 'collectorId': 'test-collector-id', 'measurementId': '_AnyCompany_1_Pressure',
                             'measureName': '_AnyCompany_1_Pressure', 'value': 123.12, 'measureQuality': 'GOOD'}]

        avail_streams_exists = ["test1stream"]

        historian_target = HistorianTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.historian_data_stream,
            self.collector_id
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        historian_target.sm_client = mock_sm_client
        historian_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock(
            return_value=avail_streams_exists)
        historian_target.sm_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        historian_target.send_to_kinesis(opcua_payload)
        args = historian_target.sm_client.write_to_stream.call_args.args

        self.assertEqual(args[0], 'test_greengrass_stream')
        self.assertEqual(len(args[1]), 8)
        self.assertEqual(args[1]['sourceId'],
                         expected_payload[0]['sourceId'])
        self.assertEqual(args[1]['collectorId'],
                         expected_payload[0]['collectorId'])
        self.assertEqual(args[1]['measurementId'],
                         expected_payload[0]['measurementId'])
        self.assertEqual(args[1]['measureName'],
                         expected_payload[0]['measureName'])
        self.assertEqual(args[1]['value'], expected_payload[0]['value'])
        self.assertEqual(args[1]['measureQuality'],
                         expected_payload[0]['measureQuality'])
        self.assertTrue('timestamp' in args[1])

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

        historian_target = HistorianTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.historian_data_stream,
            self.collector_id
        )

        with self.assertRaises(ConverterException):
            historian_target.send_to_kinesis(opcua_payload)
            assert not historian_target.sm_client.list_streams.called

    @ mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
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

        historian_target = HistorianTarget(
            self.connection_name,
            "opcua",
            self.hierarchy,
            self.greengrass_stream,
            self.max_stream_size,
            self.historian_data_stream,
            self.collector_id
        )
        mock_sm_client = mock_stream_manager_helper.MagicMock()
        historian_target.sm_client = mock_sm_client
        historian_target.sm_client.list_streams = mock_stream_manager_helper.MagicMock()
        historian_target.sm_client.list_streams.side_effect = Exception(
            "Failure")

        with self.assertRaises(ConnectionError):
            historian_target.send_to_kinesis(opcua_payload)
            assert historian_target.sm_client.list_streams.called
