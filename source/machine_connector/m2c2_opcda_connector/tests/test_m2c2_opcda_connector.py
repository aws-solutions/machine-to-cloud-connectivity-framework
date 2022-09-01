# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import os
import messages

from unittest import TestCase
from unittest.mock import MagicMock, patch
from utils.custom_exception import ConnectorException


class TestOpcDaConnector(TestCase):
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
        self.value_tuple = (self.tag, self.value, self.quality, self.timestamp)
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
        self.machine_message = [self.value_tuple]
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
            "opcDa": {
                "serverName": "Test.Server",
                "interval": 0.1,
                "listTags": [],
                "iterations": 1,
                "machineIp": "1.2.3.4",
                "tags": [
                    self.tag
                ]
            }
        }

        with patch("utils.AWSEndpointClient.__init__", return_value=None) as mock_endpoint_client:
            # intentional import to set up OS environment variables first
            import m2c2_opcda_connector.m2c2_opcda_connector as connector

            self.connector = connector
            self.connector.connector_client = mock_endpoint_client.MagicMock()
            self.connector.connector_client.publish_message_to_iot_topic = MagicMock()
            self.connector.connector_client.stop_client = MagicMock()
            self.connector.connector_client.start_client = MagicMock()
            self.connector.connector_client.read_local_connection_configuration = MagicMock()
            self.connector.connector_client.write_local_connection_configuration_file = MagicMock()

    def test_form_map(self):
        self.assertDictEqual(self.connector.form_map(), {
            "name": "test-connection",
            "site_name": "test-site",
            "area": "test-area",
            "process": "test-process",
            "machine_name": "test-machine-name"
        })

    def test_validate_schema(self):
        with patch("validations.message_validation.MessageValidation.__init__") as mock_message_validation:
            self.connector.MessageValidation = mock_message_validation.MagicMock()
            self.connector.MessageValidation.validate_schema = mock_message_validation.MagicMock()

            try:
                self.connector.validate_schema(self.message)
            except Exception:
                self.fail("The exception shouldn't happen.")

            self.connector.MessageValidation.validate_schema.side_effect = Exception(
                "Failure")
            with self.assertRaises(ConnectorException):
                self.connector.validate_schema("")

    def test_m2c2_stream_required_format(self):
        message = copy.deepcopy(self.message)
        del message["messages"][0]["name"]

        self.assertDictEqual(
            self.connector.m2c2_stream_required_format(self.tag, message["messages"]), self.message)

    def test_info_or_error_format(self):
        message = "Mock message."
        post_type = "info"

        topic, user_message = self.connector.info_or_error_format(
            message, post_type)
        self.assertEqual(
            topic, "m2c2/info/{name}".format(name=self.connection_name))
        self.assertDictEqual(user_message, {
            "siteName": os.environ["SITE_NAME"],
            "area": os.environ["AREA"],
            "process": os.environ["PROCESS"],
            "machineName": os.environ["MACHINE_NAME"],
            "message": message
        })

    def test_convert_to_json(self):
        expected_message = {}
        expected_message[self.tag] = [{
            "value": self.value,
            "quality": self.quality,
            "timestamp": self.timestamp
        }]
        self.assertDictEqual(
            self.connector.convert_to_json(self.machine_message), expected_message)

        expected_message[self.tag] = [{
            "value": "Parameters cannot be read from server"
        }]
        self.assertDictEqual(
            self.connector.convert_to_json([(self.tag, "Invalid")]), expected_message)

        expected_message = {
            "error": "Failed to convert the data to JSON: 'bool' object is not iterable"
        }
        self.assertDictEqual(
            self.connector.convert_to_json(True), expected_message)

    def test_post_to_user(self):
        with patch("utils.StreamManagerHelperClient.__init__") as mock_stream_manager_client, \
                patch("validations.message_validation.MessageValidation.__init__") as mock_message_validation:
            self.connector.MessageValidation = mock_message_validation.MagicMock()
            self.connector.MessageValidation.validate_schema = MagicMock()
            self.connector.smh_client = mock_stream_manager_client
            message = self.connector.convert_to_json(self.machine_message)

            # Test sending data when a stream is not available.
            self.connector.smh_client.create_stream = MagicMock()
            self.connector.smh_client.write_to_stream = MagicMock()
            self.connector.smh_client.list_streams = MagicMock(
                return_value=[])

            self.connector.post_to_user("data", message)
            self.connector.smh_client.list_streams.assert_called()
            self.connector.smh_client.create_stream.assert_called()
            self.connector.smh_client.write_to_stream.assert_called()
            self.connector.smh_client.write_to_stream.assert_called_with(
                os.environ["CONNECTION_GG_STREAM_NAME"], self.message)

            # Test sending data when a stream is available.
            self.connector.smh_client.list_streams.reset_mock()
            self.connector.smh_client.create_stream.reset_mock()
            self.connector.smh_client.write_to_stream.reset_mock()
            self.connector.smh_client.list_streams = MagicMock(
                return_value=[os.environ["CONNECTION_GG_STREAM_NAME"]])

            self.connector.post_to_user("data", message)
            self.connector.smh_client.list_streams.assert_called()
            self.connector.smh_client.create_stream.assert_not_called()
            self.connector.smh_client.write_to_stream.assert_called()
            self.connector.smh_client.write_to_stream.assert_called_with(
                os.environ["CONNECTION_GG_STREAM_NAME"], self.message)

            # Test sending other message.
            self.connector.connector_client.publish_message_to_iot_topic.reset_mock()

            self.connector.post_to_user("error", "Failure")
            self.connector.connector_client.publish_message_to_iot_topic.assert_called()
            self.connector.connector_client.publish_message_to_iot_topic.assert_called_with(
                "m2c2/error/{name}".format(name=self.connection_name),  {
                    "siteName": os.environ["SITE_NAME"],
                    "area": os.environ["AREA"],
                    "process": os.environ["PROCESS"],
                    "machineName": os.environ["MACHINE_NAME"],
                    "message": "Failure"
                }
            )

            # Test exception
            self.connector.smh_client.list_streams.reset_mock()
            self.connector.smh_client.list_streams.side_effect = Exception(
                "Failure")

            with self.assertRaises(Exception):
                self.connector.post_to_user("data", message)

    def test_send_opc_da_data(self):
        with patch("utils.StreamManagerHelperClient.__init__") as mock_stream_manager_client, \
                patch("validations.message_validation.MessageValidation.__init__") as mock_message_validation:
            self.connector.MessageValidation = mock_message_validation.MagicMock()
            self.connector.MessageValidation.validate_schema = MagicMock()
            self.connector.smh_client = mock_stream_manager_client
            self.connector.smh_client.create_stream = MagicMock()
            self.connector.smh_client.write_to_stream = MagicMock()
            self.connector.smh_client.list_streams = MagicMock(
                return_value=[])

            self.assertTupleEqual(self.connector.send_opc_da_data(
                self.machine_message, 1, 5), (self.machine_message, 1))
            self.assertTupleEqual(self.connector.send_opc_da_data(
                self.machine_message, 5, 5), ([], 0))

    def test_device_connect(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.OpenOPC") as mock_open_opc, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.time") as mock_time:
            mock_open_opc.open_client = MagicMock()
            mock_time.sleep.return_value = None

            # Connection success
            self.connector.device_connect(self.connection_data)
            mock_open_opc.open_client.assert_called()
            mock_open_opc.open_client.assert_called_with(
                host=self.connection_data["opcDa"]["machineIp"])

            # Connection failure
            mock_open_opc.open_client.side_effect = Exception(
                "Failure")
            with self.assertRaises(ConnectorException):
                self.connector.device_connect(self.connection_data)

    def test_read_opc_da_data(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.connection") as mock_connection:
            mock_connection.read = MagicMock(
                return_value=[self.value_tuple])
            mock_connection.list = MagicMock(
                return_value=[self.tag])

            payload_content = self.connector.read_opc_da_data(
                [self.tag], [self.list_tag], [])
            self.assertEquals(
                payload_content, [self.value_tuple, self.value_tuple])

    def test_handle_get_data_error(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.device_connect") as mock_device_connect, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.post_to_user") as mock_post_to_user:

            # When error count is less then retry count.
            self.connector.control = "start"
            error_count = self.connector.handle_get_data_error(
                {}, Exception("Failure"), 1)
            self.assertEqual(error_count, 2)
            self.assertEqual(self.connector.control, "start")
            mock_device_connect.assert_not_called()
            mock_post_to_user.assert_not_called()

            # When error count is larger then retry count.
            error_count = self.connector.handle_get_data_error(
                {}, Exception("Failure"), 5)
            self.assertEqual(error_count, 6)
            self.assertEqual(self.connector.control, "start")
            mock_device_connect.assert_called()
            mock_post_to_user.assert_not_called()

            # When an error happens.
            mock_device_connect.side_effect = Exception("Failure")
            error_count = self.connector.handle_get_data_error(
                {}, Exception("Failure"), 5)
            self.assertEqual(error_count, 6)
            self.assertEqual(self.connector.control, "stop")
            mock_device_connect.assert_called()
            mock_post_to_user.assert_called()

    def test_data_collection_control(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.read_opc_da_data") as mock_read_opc_da_data, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.send_opc_da_data") as mock_send_opc_da_data, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.handle_get_data_error") as mock_handle_get_data_error, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.post_to_user") as mock_post_to_user, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.connection") as mock_connetion, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.Timer.__init__") as mock_timer:
            def reset_all_mocks():
                mock_read_opc_da_data.reset_mock()
                mock_send_opc_da_data.reset_mock()
                mock_handle_get_data_error.reset_mock()
                mock_post_to_user.reset_mock()
                mock_connetion.reset_mock()
                mock_timer.reset_mock()

            self.connector.control = "start"
            mock_read_opc_da_data.return_value = self.machine_message
            mock_send_opc_da_data.return_value = (self.machine_message, 1)
            self.connector.Timer = mock_timer.MagicMock()

            # Success to collect data
            self.connector.data_collection_control(self.connection_data)
            mock_read_opc_da_data.assert_called()
            mock_read_opc_da_data.assert_called_with(
                tags=self.connection_data["opcDa"]["tags"], list_tags=[], payload_content=[])
            mock_send_opc_da_data.assert_called()
            mock_send_opc_da_data.assert_called_with(
                payload_content=self.machine_message,
                current_iteration=1,
                iterations=self.connection_data["opcDa"]["iterations"]
            )
            self.connector.Timer.assert_called()
            self.connector.Timer.assert_called_with(
                interval=self.connection_data["opcDa"]["interval"],
                function=self.connector.data_collection_control,
                args=[self.connection_data, self.machine_message, 1, 0]
            )

            # When error happens when collecting data
            reset_all_mocks()
            mock_read_opc_da_data.side_effect = Exception("Failure")
            mock_handle_get_data_error.return_value = 1
            self.connector.data_collection_control(self.connection_data)

            mock_read_opc_da_data.assert_called()
            mock_read_opc_da_data.assert_called_with(
                tags=self.connection_data["opcDa"]["tags"], list_tags=[], payload_content=[])
            mock_send_opc_da_data.assert_not_called()
            mock_handle_get_data_error.assert_called()
            self.connector.Timer.assert_called()
            self.connector.Timer.assert_called_with(
                interval=self.connection_data["opcDa"]["interval"],
                function=self.connector.data_collection_control,
                args=[self.connection_data, [], 0, 1]
            )

            # Success to stop the connection
            reset_all_mocks()
            mock_connetion.close = MagicMock()
            self.connector.control = "stop"
            self.connector.data_collection_control(
                self.connection_data, self.machine_message)

            self.connector.Timer.assert_not_called()
            mock_post_to_user.assert_called()
            mock_connetion.close.assert_called()
            self.assertEqual(self.connector.connection, None)

            # Failure to stop the connection
            reset_all_mocks()
            mock_connetion.close = MagicMock()
            mock_connetion.close.side_effect = Exception("Failure")
            self.connector.data_collection_control(
                self.connection_data)

            mock_post_to_user.assert_not_called()

    def test_control_switch(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.post_to_user") as mock_post_to_user, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.device_connect") as mock_device_connect, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.data_collection_control") as mock_data_collection_control, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.OpenOPC") as mock_open_opc, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.time") as mock_time:
            def reset_all_mocks():
                mock_post_to_user.reset_mock()
                mock_device_connect.reset_mock()
                mock_data_collection_control.reset_mock()
                mock_open_opc.reset_mock()

            mock_open_opc.open_client = MagicMock()
            mock_time.sleep.return_value = None

            # Start already running
            self.connector.connector_client.is_running = True
            self.connector.control_switch().get("start")(self.connection_data)

            mock_post_to_user.assert_called()
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

            mock_post_to_user.assert_called()
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
            mock_post_to_user.assert_called()

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
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with("info", self.connection_data)

            # Pull local connection configuration not existing
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.return_value = None
            self.connector.control_switch().get("pull")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                self.connection_name)
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with(
                "error", messages.ERR_MSG_NO_CONNECTION_FILE.format(self.connection_name))

            # Pull failure
            reset_all_mocks()
            self.connector.connector_client.read_local_connection_configuration.side_effect = Exception(
                "Failure")
            self.connector.control_switch().get("pull")()

            self.connector.connector_client.read_local_connection_configuration.assert_called()
            self.connector.connector_client.read_local_connection_configuration.assert_called_with(
                self.connection_name)
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with(
                "error", messages.ERR_MSG_FAIL_SERVER_NAME.format("Failure"))

            # Push success
            reset_all_mocks()
            self.connector.control_switch().get("push")(self.connection_data)

            mock_open_opc.open_client.assert_called()
            mock_open_opc.open_client.assert_called_with(
                host=self.connection_data["opcDa"]["machineIp"])
            mock_post_to_user.assert_called()

            # Push failure
            reset_all_mocks()
            self.connector.OpenOPC.open_client.side_effect = Exception(
                "Failure")
            self.connector.control_switch().get("push")(self.connection_data)

            self.connector.OpenOPC.open_client.assert_called()
            self.connector.OpenOPC.open_client.assert_called_with(
                host=self.connection_data["opcDa"]["machineIp"])
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with(
                "error", messages.ERR_MSG_FAIL_SERVER_NAME.format("Failure"))

    def test_message_handler(self):
        with patch("m2c2_opcda_connector.m2c2_opcda_connector.post_to_user") as mock_post_to_user, \
                patch("m2c2_opcda_connector.m2c2_opcda_connector.control_switch") as mock_control_switch:
            def foo(input):
                print("foo", input)

            def bar():
                print("bar")

            def reset_all_mock():
                mock_post_to_user.reset_mock()
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
            mock_post_to_user.assert_not_called()

            # Success to handle start control
            reset_all_mock()
            self.connector.lock = False
            self.connector.message_handler({"control": "start"})

            mock_control_switch.assert_called()
            mock_post_to_user.assert_not_called()

            # Success to handle stop control
            reset_all_mock()
            self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_to_user.assert_not_called()

            # Success to handle invalid control
            reset_all_mock()
            self.connector.message_handler({"control": "invalid"})

            mock_control_switch.assert_called()
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with(
                "error", messages.ERR_MSG_FAIL_UNKNOWN_CONTROL.format("invalid"))

            # When "KeyError" error occurs
            reset_all_mock()
            mock_control_switch.side_effect = KeyError("Failure")

            with self.assertRaises(KeyError):
                self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_to_user.assert_not_called()
            self.connector.connector_client.stop_client.assert_called()

            # When other error occurs
            reset_all_mock()
            mock_control_switch.side_effect = Exception("Failure")

            with self.assertRaises(Exception):
                self.connector.message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_to_user.assert_called()
            mock_post_to_user.assert_called_with(
                "error", "Failed to run the connection: Failure")
            self.connector.connector_client.stop_client.assert_called()
