# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json

from unittest import mock, TestCase
from payload_router import PayloadRouter


class MockMessage:
    sequence_number = 1

    def __init__(self, payload=json.dumps({"mock": "payload"})):
        self.payload = payload


class TestPayloadRouter(TestCase):
    def setUp(self):
        self.protocol = "opcda"
        self.connection_name = "test_connection_name"
        self.hierarchy = {
            "site_name": "test_site",
            "area": "test_area",
            "process": "test_process",
            "machine_name": "test_machine_name"
        }
        self.destinations = {
            "send_to_sitewise": True,
            "send_to_kinesis_stream": True,
            "send_to_iot_topic": True,
            "send_to_timestream": True,
            "send_to_historian": True
        }
        self.destination_streams = {
            "sitewise_stream": "SiteWise_Stream",
            "kinesis_sm_stream": "test_kinesis_greengrass_stream",
            "timestream_kinesis_stream": "test_timestream_greengrass_stream",
            "historian_kinesis_stream": "test_historian_greengrass_stream"
        }
        self.max_stream_size = 50
        self.kinesis_data_stream = "test_kinesis_data_stream"
        self.timestream_kinesis_data_stream = "test_timestream_kinesis_data_stream"
        self.historian_kinesis_data_stream = "test_historian_kinesis_data_stream"
        self.collector_id = "test_collector_id"
        self.message = MockMessage()

    @mock.patch("targets.iot_topic_target.IoTTopicTarget.__init__", return_value=None)
    @mock.patch("targets.kinesis_target.KinesisTarget.__init__", return_value=None)
    @mock.patch("targets.sitewise_target.SiteWiseTarget.__init__", return_value=None)
    @mock.patch("targets.historian_target.HistorianTarget.__init__", return_value=None)
    def test_route_payload(self, mock_historian_target, mock_sitewise_target, mock_kinesis_target, mock_iot_topic_target):
        payload_router = PayloadRouter(
            self.protocol,
            self.connection_name,
            self.hierarchy,
            self.destinations,
            self.destination_streams,
            self.max_stream_size,
            self.kinesis_data_stream,
            self.timestream_kinesis_data_stream,
            self.historian_kinesis_data_stream,
            self.collector_id
        )

        with mock.patch("targets.sitewise_target.SiteWiseTarget.send_to_sitewise") as mock_send_to_sitewise, \
                mock.patch("targets.kinesis_target.KinesisTarget.send_to_kinesis") as mock_send_to_kinesis, \
                mock.patch("targets.historian_target.HistorianTarget.send_to_kinesis") as mock_send_to_historian, \
                mock.patch("targets.iot_topic_target.IoTTopicTarget.send_to_iot") as mock_send_to_iot:
            sequence_number = payload_router.route_payload(self.message)
            self.assertEqual(sequence_number, MockMessage.sequence_number)
            self.assertTrue(mock_send_to_sitewise.called)
            self.assertTrue(mock_send_to_kinesis.called)
            self.assertTrue(mock_send_to_iot.called)
            self.assertTrue(mock_send_to_historian.called)

    @mock.patch("targets.iot_topic_target.IoTTopicTarget.__init__", return_value=None)
    @mock.patch("targets.kinesis_target.KinesisTarget.__init__", return_value=None)
    @mock.patch("targets.sitewise_target.SiteWiseTarget.__init__", return_value=None)
    @mock.patch("targets.historian_target.HistorianTarget.__init__", return_value=None)
    def test_send_to_timestream(self, mock_historian_target, mock_sitewise_target, mock_kinesis_target, mock_iot_topic_target):
        self.destinations = {
            "send_to_sitewise": False,
            "send_to_kinesis_stream": False,
            "send_to_iot_topic": False,
            "send_to_timestream": True,
            "send_to_historian": False
        }
        payload_router = PayloadRouter(
            self.protocol,
            self.connection_name,
            self.hierarchy,
            self.destinations,
            self.destination_streams,
            self.max_stream_size,
            self.kinesis_data_stream,
            self.timestream_kinesis_data_stream,
            self.historian_kinesis_data_stream,
            self.collector_id
        )

        with mock.patch("targets.sitewise_target.SiteWiseTarget.send_to_sitewise") as mock_send_to_sitewise, \
                mock.patch("targets.kinesis_target.KinesisTarget.send_to_kinesis") as mock_send_to_kinesis, \
                mock.patch("targets.historian_target.HistorianTarget.send_to_kinesis") as mock_send_to_historian, \
                mock.patch("targets.iot_topic_target.IoTTopicTarget.send_to_iot") as mock_send_to_iot:
            sequence_number = payload_router.route_payload(self.message)
            self.assertEqual(sequence_number, MockMessage.sequence_number)
            self.assertTrue(mock_send_to_kinesis.called)
            self.assertFalse(mock_send_to_sitewise.called)
            self.assertFalse(mock_send_to_iot.called)
            self.assertFalse(mock_send_to_historian.called)

    @mock.patch("targets.iot_topic_target.IoTTopicTarget.__init__", return_value=None)
    @mock.patch("targets.kinesis_target.KinesisTarget.__init__", return_value=None)
    @mock.patch("targets.sitewise_target.SiteWiseTarget.__init__", return_value=None)
    @mock.patch("targets.historian_target.HistorianTarget.__init__", return_value=None)
    def test_type_error(self, mock_historian_target, mock_sitewise_target, mock_kinesis_target, mock_iot_topic_target):
        payload_router = PayloadRouter(
            self.protocol,
            self.connection_name,
            self.hierarchy,
            self.destinations,
            self.destination_streams,
            self.max_stream_size,
            self.kinesis_data_stream,
            self.timestream_kinesis_data_stream,
            self.historian_kinesis_data_stream,
            self.collector_id
        )

        with self.assertRaises(TypeError):
            payload_router.route_payload(MockMessage(1))

    @mock.patch("targets.iot_topic_target.IoTTopicTarget.__init__", return_value=None)
    @mock.patch("targets.kinesis_target.KinesisTarget.__init__", return_value=None)
    @mock.patch("targets.sitewise_target.SiteWiseTarget.__init__", return_value=None)
    @mock.patch("targets.historian_target.HistorianTarget.__init__", return_value=None)
    def test_exception(self, mock_historian_target, mock_sitewise_target, mock_kinesis_target, mock_iot_topic_target):
        payload_router = PayloadRouter(
            self.protocol,
            self.connection_name,
            self.hierarchy,
            self.destinations,
            self.destination_streams,
            self.max_stream_size,
            self.kinesis_data_stream,
            self.timestream_kinesis_data_stream,
            self.historian_kinesis_data_stream,
            self.collector_id
        )

        with self.assertRaises(Exception):
            payload_router.route_payload(MockMessage("String"))
