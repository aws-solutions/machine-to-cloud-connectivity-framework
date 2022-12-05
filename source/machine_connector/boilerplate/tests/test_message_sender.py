# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import datetime
from unittest import mock, TestCase

from boilerplate.messaging.message_sender import MessageSender
from boilerplate.messaging.message import Message
from boilerplate.messaging.message_batch import MessageBatch
from utils.custom_exception import ValidationException
from utils import StreamManagerHelperClient, AWSEndpointClient, InitMessage


class TestMessageSender(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.environ["CONNECTION_GG_STREAM_NAME"] = "test-gg-stream"
        os.environ["SITE_NAME"] = "test-site"
        os.environ["AREA"] = "test-area"
        os.environ["PROCESS"] = "test-process"
        os.environ["MACHINE_NAME"] = "test-machine-name"
        os.environ["CONNECTION_NAME"] = "test-connection"

    def setUp(self):
        tag = "test-tag"
        messages = [Message("test-value", "GOOD",
                            str(datetime.datetime.now()))]
        source_id = "test-source-id"
        self.message_batch = MessageBatch(tag, messages, source_id)

    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.list_streams', return_value=[])
    @mock.patch('utils.StreamManagerHelperClient.create_stream')
    def test_post_message_batch(self, smh_create_mock, smh_list_mock, smh_mock, endpoint_client_init_mock):
        # Arrange
        message_sender = MessageSender()

        # Act
        message_sender.post_message_batch(self.message_batch)

        # Assert
        self.assertTrue(smh_create_mock.called)

    # @mock.patch('utils.StreamManagerHelperClient.__del__', return_value=None)
    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.list_streams', return_value=['test-gg-stream'])
    @mock.patch('utils.StreamManagerHelperClient.create_stream')
    def test_post_message_batch_post_call(self, smh_create_mock, smh_list_mock, smh_mock, endpoint_client_init_mock):
        # Arrange
        message_sender = MessageSender()

        # Act
        message_sender.post_message_batch(self.message_batch)

        # Assert
        self.assertFalse(smh_create_mock.called)

    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch("utils.AWSEndpointClient.publish_message_to_iot_topic", return_value=None)
    def test_post_info_message(self, publish_mock, smh_mock, endpoint_client_init_mock):
        # Arrange
        message_sender = MessageSender()

        # Act
        message_sender.post_info_message("test-message")

        # Assert
        publish_mock.assert_called_with('m2c2/info/test-connection', {'siteName': 'test-site', 'area': 'test-area',
                                        'process': 'test-process', 'machineName': 'test-machine-name', 'message': 'test-message'})

    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch("utils.AWSEndpointClient.publish_message_to_iot_topic", return_value=None)
    def test_post_error_message(self, publish_mock, smh_mock, endpoint_client_init_mock):
        # Arrange
        message_sender = MessageSender()

        # Act
        message_sender.post_error_message("test-message")

        # Assert
        publish_mock.assert_called_with('m2c2/error/test-connection', {
                                        'siteName': 'test-site', 'area': 'test-area', 'process': 'test-process', 'machineName': 'test-machine-name', 'message': 'test-message'})

    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('utils.StreamManagerHelperClient.__init__', return_value=None)
    def test_form_map(self, smh_mock, endpoint_client_init_mock):
        # Arrange
        message_sender = MessageSender()

        # Act and Assert
        self.assertDictEqual(message_sender._form_map(), {
            "name": "test-connection",
            "site_name": "test-site",
            "area": "test-area",
            "process": "test-process",
            "machine_name": "test-machine-name"
        })
