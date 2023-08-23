# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
from datetime import datetime
import json
import os
from re import M
from unittest import mock

import m2c2_osipi_connector.messages as messages

import awsiot

from unittest import TestCase
from unittest.mock import MagicMock, patch
from m2c2_osipi_connector.pi_connector_sdk.pi_response import PiResponse

from utils.custom_exception import ConnectorException

from awsiot.greengrasscoreipc.model import GetSecretValueResponse, SecretValue


class TestOsiPiConnector(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.environ["SITE_NAME"] = "test-site"
        os.environ["AREA"] = "test-area"
        os.environ["PROCESS"] = "test-process"
        os.environ["MACHINE_NAME"] = "test-machine-name"
        os.environ["CONNECTION_GG_STREAM_NAME"] = "test-stream"
        os.environ["CONNECTION_NAME"] = "test-connection"

    def setUp(self):
        self.connection_name = os.environ["CONNECTION_NAME"]
        self.hierarchy = {
            "siteName": os.environ["SITE_NAME"],
            "area": os.environ["AREA"],
            "process": os.environ["PROCESS"],
            "machineName": os.environ["MACHINE_NAME"]
        }
        self.topic = "test/topic"
        self.tag = "Random-Tag"
        self.list_tag = "Random-*"
        self.value = 123
        self.quality = "Good"
        self.timestamp = "2022-01-25 00:00:00+00:00"
        # self.value_tuple = (self.tag, self.value, self.quality, self.timestamp)
        self.alias = "/".join([self.hierarchy["siteName"], self.hierarchy["area"],
                              self.hierarchy["process"], self.hierarchy["machineName"], self.tag])
        self.message = {
            "alias": self.alias,
            "messages": [
                {
                    "name": self.alias,
                    "timestamp": self.timestamp,
                    "value": self.value,
                    "quality": self.quality
                }
            ]
        }
        self.machine_message = {
            "Random-Tag": [{
                "value": self.value,
                "quality": self.quality,
                "timestamp": self.timestamp
            }]
        }
        self.osi_pi_response_message = [
            PiResponse(path=self.alias, name=self.alias, records=[{
                'Good': True,
                'Value': self.value,
                'Timestamp': self.timestamp
            }])
        ]
        self.connection_data = {
            "connectionName": self.connection_name,
            "control": "start",
            "protocol": "opcda",
            "area": self.hierarchy["area"],
            "machineName": self.hierarchy["machineName"],
            "process": self.hierarchy["process"],
            "sendDataToIoTSiteWise": True,
            "sendDataToIoTTopic": True,
            "sendDataToKinesisDataStreams": True,
            "siteName": self.hierarchy["siteName"],
            "osiPi": {
                "apiUrl": "https://ec2-12-123-12-12.compute-1.amazonaws.com/piwebapi",
                "serverName": "EC2AMAZ-MCHNNAME",
                "authMode": "BASIC",
                "verifySSL": True,
                "tags": [
                    self.tag
                ],
                "requestFrequency": 60,
                "catchupFrequency": 0.1,
                "maxRequestDuration": 600,
                "queryOffset": 0,
                "credentialSecretArn": "arn:aws:secretsmanager:us-east-1:111122223333:secret:m2c2-osipi-ABCDE"
            }
        }

        with patch("utils.AWSEndpointClient.__init__", return_value=None) as mock_endpoint_client:
            # intentional import to set up OS environment variables first
            import m2c2_osipi_connector.m2c2_osipi_connector as connector

            self.connector = connector
            self.connector.connector_client = mock_endpoint_client.MagicMock()
            self.connector.connector_client.publish_message_to_iot_topic = MagicMock()
            self.connector.connector_client.stop_client = MagicMock()
            self.connector.connector_client.start_client = MagicMock()
            self.connector.connector_client.read_local_connection_configuration = MagicMock()
            self.connector.connector_client.write_local_connection_configuration_file = MagicMock()

        self.username = 'USERNAME'
        self.password = 'PASSWORD'

        secret_value_response = GetSecretValueResponse(secret_value=SecretValue(secret_string=json.dumps({
            'username': self.username,
            'password': self.password
        })))

        mock_awsiot_client = awsiot.greengrasscoreipc.connect = MagicMock()
        mock_get_secret_value = mock_awsiot_client.return_value.new_get_secret_value = MagicMock()
        mock_secret_get_response = mock_get_secret_value.return_value.get_response = MagicMock()
        mock_secret_get_result = mock_secret_get_response.return_value = MagicMock()

        mock_secret_get_result.result.return_value = secret_value_response

    def test_basic_auth(self):

        # Test: Should read username/password from GG IOT Secret Reader
        pi_config = self.connector.create_pi_config(self.connection_data)

        self.assertEqual(
            self.username, pi_config.server_connection.auth_param.username)
        self.assertEqual(
            self.password, pi_config.server_connection.auth_param.password)

        # Test: Should throw exception if secret JSON is missing data
        with patch('awsiot.greengrasscoreipc.connect') as mock_gg_iot_client:

            secret_value_response = GetSecretValueResponse(secret_value=SecretValue(secret_string=json.dumps({
                'username': self.username,
            })))

            mock_get_secret_value = mock_gg_iot_client.return_value.new_get_secret_value = MagicMock()
            mock_secret_get_response = mock_get_secret_value.return_value.get_response = MagicMock()
            mock_secret_get_result = mock_secret_get_response.return_value = MagicMock()

            mock_secret_get_result.result.return_value = secret_value_response

            self.assertRaises(
                KeyError, lambda: self.connector.create_pi_config(self.connection_data))

    def test_send_osipi_data(self):
        with patch("boilerplate.messaging.message_sender.MessageSender.post_message_batch") as mock_post_message_batch:

            self.connector.send_osi_pi_data(self.osi_pi_response_message)

            mock_post_message_batch.assert_called()

    def test_device_connect(self):
        # with patch("pi_connector_sdk.osi_pi_connector.OsiPiConnector.__init__") as mock_osipi:
        with patch("m2c2_osipi_connector.m2c2_osipi_connector.OsiPiConnector") as mock_osipi:

            mock_osipi().get_web_ids_for_tag_names.return_value = [
                "asdf", "asdf2"]

            # Connection success
            pi_config = self.connector.create_pi_config(self.connection_data)
            self.connector.device_connect(self.connection_data)

            self.connector.osi_pi_connector.get_web_ids_for_tag_names.assert_called()
            self.connector.osi_pi_connector.get_web_ids_for_tag_names.assert_called_with(
                pi_config.query_config.tag_names)

            # Calling Connect a second time should work
            self.connector.osi_pi_connector.get_web_ids_for_tag_names.reset_mock()

            self.connector.device_connect(self.connection_data)

            self.connector.osi_pi_connector.get_web_ids_for_tag_names.assert_called()
            self.connector.osi_pi_connector.get_web_ids_for_tag_names.assert_called_with(
                pi_config.query_config.tag_names)

        with patch("m2c2_osipi_connector.m2c2_osipi_connector.OsiPiConnector") as mock_osipi_bad:
            self.assertRaises(
                ConnectorException, lambda: self.connector.device_connect(self.connection_data))

    # def test_read_opc_da_data(self):
    #     with patch("m2c2_opcda_connector.m2c2_opcda_connector.connection") as mock_connection:
    #         mock_connection.read = MagicMock(
    #             return_value=[self.value_tuple])
    #         mock_connection.list = MagicMock(
    #             return_value=[self.tag])

    #         payload_content = self.connector.read_opc_da_data(
    #             [self.tag], [self.list_tag], [])
    #         self.assertEquals(
    #             payload_content, [self.value_tuple, self.value_tuple])

    def test_handle_get_data_error(self):
        with patch("m2c2_osipi_connector.m2c2_osipi_connector.device_connect") as mock_device_connect, \
                patch("boilerplate.messaging.message_sender.MessageSender.post_error_message") as mock_post_error_message:

            # When error count is less then retry count.
            self.connector.control = "start"
            error_count = self.connector.handle_get_data_error(
                Exception("Failure"), 1)
            self.assertEqual(error_count, 2)
            self.assertEqual(self.connector.control, "start")
            mock_device_connect.assert_not_called()
            mock_post_error_message.assert_not_called()

            # When error count is equal to the retry count.
            error_count = self.connector.handle_get_data_error(
                Exception("Failure"), 5)
            self.assertEqual(error_count, 6)
            self.assertEqual(self.connector.control, "stop")
            mock_device_connect.assert_not_called()
            mock_post_error_message.assert_called()

    def test_data_collection_control(self):
        with patch("m2c2_osipi_connector.m2c2_osipi_connector.OsiPiConnector") as mock_osipi, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.osi_pi_connector") as mock_osipi_connector, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.send_osi_pi_data") as mock_send_osi_pi_data, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.handle_get_data_error") as mock_handle_get_data_error, \
                patch("boilerplate.messaging.message_sender.MessageSender.post_message_batch") as mock_post_message_batch, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.Timer.__init__") as mock_timer:

            mock_get_historical_data_batch = mock_osipi_connector.get_historical_data_batch

            mock_osipi_connector.connection_config = self.connector.create_pi_config(
                self.connection_data)

            start_time = datetime.fromisoformat(
                '2022-06-10 10:00:00.000000+00:00')
            end_time = datetime.fromisoformat(
                '2022-06-10 10:01:00.000000+00:00')

            mock_osipi_connector.time_helper.get_calculated_time_range.return_value = \
                start_time, \
                end_time, \
                False

            web_ids = ["asdf", "asdf2"]
            self.connector.web_ids = web_ids
            mock_osipi_connector.get_web_ids_for_tag_names.return_value = web_ids

            def reset_all_mocks():
                mock_get_historical_data_batch.reset_mock()
                mock_send_osi_pi_data.reset_mock()
                mock_handle_get_data_error.reset_mock()
                mock_post_message_batch.reset_mock()
                mock_timer.reset_mock()

            self.connector.control = "start"
            mock_get_historical_data_batch.return_value = self.machine_message
            mock_send_osi_pi_data.return_value = (self.machine_message, 1)
            self.connector.Timer = mock_timer.MagicMock()

            # Success to collect data
            self.connector.data_collection_control(self.connection_data)
            mock_get_historical_data_batch.assert_called()
            mock_get_historical_data_batch.assert_called_with(
                web_ids=web_ids, start_time=start_time, end_time=end_time)
            mock_send_osi_pi_data.assert_called()
            mock_send_osi_pi_data.assert_called_with(
                payload_content=self.machine_message
            )
            self.connector.Timer.assert_called()
            self.connector.Timer.assert_called_with(
                interval=self.connector.osi_pi_connector.connection_config.query_config.req_frequency_sec,
                function=self.connector.data_collection_control,
                args=[self.connection_data, 1, 0]
            )

            # When error happens when collecting data
            reset_all_mocks()
            mock_get_historical_data_batch.side_effect = Exception("Failure")
            mock_handle_get_data_error.return_value = 1
            self.connector.data_collection_control(self.connection_data)

            mock_get_historical_data_batch.assert_called()
            mock_get_historical_data_batch.assert_called_with(
                web_ids=web_ids, start_time=start_time, end_time=end_time)
            mock_send_osi_pi_data.assert_not_called()
            mock_handle_get_data_error.assert_called()
            self.connector.Timer.assert_called()
            self.connector.Timer.assert_called_with(
                interval=self.connector.osi_pi_connector.connection_config.query_config.req_frequency_sec,
                function=self.connector.data_collection_control,
                args=[self.connection_data, 1, 1]
            )

            # Success to stop the connection
            reset_all_mocks()
            self.connector.control = "stop"
            self.connector.data_collection_control(
                self.connection_data, self.machine_message)

            self.connector.Timer.assert_not_called()
            self.assertEqual(self.connector.osi_pi_connector, None)

    def test_control_switch(self):

        with patch("m2c2_osipi_connector.m2c2_osipi_connector.OsiPiConnector") as mock_osipi, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.osi_pi_connector") as mock_osipi_connector, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.send_osi_pi_data") as mock_send_osi_pi_data, \
                patch("utils.AWSEndpointClient.publish_message_to_iot_topic") as mock_aws_endpoint_client, \
                patch("boilerplate.messaging.message_sender.MessageSender.post_info_message") as mock_post_info_message, \
                patch("boilerplate.messaging.message_sender.MessageSender.post_error_message") as mock_post_error_message, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.device_connect") as mock_device_connect, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.data_collection_control") as mock_data_collection_control, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.time") as mock_time:

            def reset_all_mocks():
                mock_post_info_message.reset_mock()
                mock_device_connect.reset_mock()
                mock_data_collection_control.reset_mock()

            mock_time.sleep.return_value = None

            # Start already running
            self.connector.connector_client.is_running = True
            self.connector.control_switch().get("start")(self.connection_data)

            mock_post_info_message.assert_called()
            self.connector.connector_client.start_client.assert_not_called()
            mock_device_connect.assert_not_called()
            mock_data_collection_control.assert_not_called()

            # Start success
            reset_all_mocks()
            self.connector.connector_client.is_running = False
            self.connector.control_switch().get("start")(self.connection_data)

            self.connector.connector_client.start_client.assert_called()
            self.connector.connector_client.start_client.assert_called_with(
                connection_name=self.connection_name, connection_configuration=self.connection_data)
            mock_device_connect.assert_called()
            mock_device_connect.assert_called_with(self.connection_data)
            mock_data_collection_control.assert_called()
            mock_data_collection_control.assert_called_with(
                connection_data=self.connection_data)

            # Start failure
            reset_all_mocks()
            self.connector.connector_client.start_client.side_effect = Exception(
                "Failure")
            with self.assertRaises(ConnectorException):
                self.connector.control_switch().get("start")(self.connection_data)

            # Stop already stopped
            reset_all_mocks()
            self.connector.control_switch().get("stop")()

            mock_post_info_message.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_not_called()
            self.connector.connector_client.write_local_connection_configuration_file.assert_not_called()

            # Stop success
            reset_all_mocks()
            self.connector.connector_client.is_running = True
            self.connector.connector_client.read_local_connection_configuration.return_value = self.connection_data
            self.connector.control_switch().get("stop")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                connection_name=self.connection_name)
            self.connector.connector_client.write_local_connection_configuration_file.assert_called()
            self.connector.connector_client.write_local_connection_configuration_file.assert_called_with(
                connection_name=self.connection_name, connection_configuration=self.connection_data)
            mock_post_info_message.assert_called()

            # Stop failure
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.side_effect = Exception(
                "Failure")
            with self.assertRaises(ConnectorException):
                self.connector.control_switch().get("stop")()

            # Pull success
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.side_effect = None
            self.connector.connector_client.read_local_connection_configuration.return_value = self.connection_data
            self.connector.control_switch().get("pull")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                self.connection_name)
            mock_post_info_message.assert_called()
            mock_post_info_message.assert_called_with(self.connection_data)

            # Pull local connection configuration not existing
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.return_value = None
            self.connector.control_switch().get("pull")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                self.connection_name)
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                messages.ERR_MSG_NO_CONNECTION_FILE.format(self.connection_name))

            # Pull failure
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.side_effect = Exception(
                "Failure")
            self.connector.control_switch().get("pull")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                self.connection_name)
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                messages.ERR_MSG_FAIL_SERVER_NAME.format("Failure"))

            # Push success
            reset_all_mocks()
            self.connector.control_switch().get("push")(self.connection_data)

            mock_post_info_message.assert_called()

            # Push failure
            reset_all_mocks()

            with patch("m2c2_osipi_connector.m2c2_osipi_connector.create_pi_config") as mock_create_pi_config:

                mock_create_pi_config.side_effect = Exception(
                    "Failure")
                self.connector.control_switch().get("push")(self.connection_data)

            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                messages.ERR_MSG_FAIL_SERVER_NAME.format("Failure"))

    def test_message_handler(self):
        with patch("boilerplate.messaging.message_sender.MessageSender.post_error_message") as mock_post_error_message, \
                patch("m2c2_osipi_connector.m2c2_osipi_connector.control_switch") as mock_control_switch:
            def foo(input):
                print("foo", input)

            def bar():
                print("bar")

            def reset_all_mock():
                mock_post_error_message.reset_mock()
                mock_control_switch.reset_mock()

            mock_control_switch.return_value = {
                "start": foo,
                "stop": bar
            }

            # When it's locked
            self.connector.lock = True
            self.connector.message_handler(self.connection_data)
            self.assertTrue(self.connector.lock)

            mock_control_switch.assert_not_called()
            mock_post_error_message.assert_not_called()

            # Success to handle start control
            reset_all_mock()
            self.connector.lock = False
            self.connector.message_handler({"control": "start"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()

            # Success to handle stop control
            reset_all_mock()
            self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()

            # Success to handle invalid control
            reset_all_mock()
            self.connector.message_handler({"control": "invalid"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                messages.ERR_MSG_FAIL_UNKNOWN_CONTROL.format("invalid"))

            # When "KeyError" error occurs
            reset_all_mock()
            mock_control_switch.side_effect = KeyError("Failure")

            with self.assertRaises(KeyError):
                self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()
            self.connector.connector_client.stop_client.assert_called()

            # When other error occurs
            reset_all_mock()
            mock_control_switch.side_effect = Exception("Failure")

            with self.assertRaises(Exception):
                self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                "Failed to run the connection: Failure")
            self.connector.connector_client.stop_client.assert_called()
