# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from unittest import mock, TestCase

from m2c2_modbus_tcp_connector.modbus_message_handler import ModbusMessageHandler
import config
import messages


class TestModbusMessageHandler(TestCase):

    def test_message_handler(self):
        with mock.patch("boilerplate.messaging.message_sender.MessageSender.post_error_message") as mock_post_error_message, \
                mock.patch("m2c2_modbus_tcp_connector.modbus_message_handler.ModbusMessageHandler.control_switch") as mock_control_switch, \
                mock.patch("utils.AWSEndpointClient.__init__", return_value=None) as mock_endpoint_client:
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

            message_handler = ModbusMessageHandler()

            message_handler.connector_client = mock.MagicMock()

            connection_data = {
                "connectionName": "test-connection",
                "control": "start",
                "protocol": "opcda",
                "area": "test-area",
                "machineName": "test-machine-name",
                "process": "test-process",
                "sendDataToIoTSiteWise": True,
                "sendDataToIoTTopic": True,
                "sendDataToKinesisDataStreams": True,
                "siteName": "test-site-name",
                "modbusTcp": {
                    "host": "10.2.0.140",
                    "hostPort": 0,
                    "hostTag": "my-modbus",
                    "modbusSecondariesConfig": [
                        {
                            "secondaryAddress": "1",
                            "frequencyInSeconds": 30,
                            "commandConfig": {
                                "readCoils": {
                                    "address": "1"
                                },
                                "readDiscreteInputs": {
                                    "address": "1"
                                },
                                "readHoldingRegisters": {
                                    "address": "1"
                                },
                                "readInputRegisters": {
                                    "address": "1"
                                }
                            }
                        }
                    ]
                }
            }

            # When it's locked
            config.lock = True
            message_handler.run_message_handler(connection_data)
            assert config.lock

            mock_control_switch.assert_not_called()
            mock_post_error_message.assert_not_called()

            # Success to handle start control
            reset_all_mock()
            config.lock = False
            message_handler.run_message_handler({"control": "start"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()

            # Success to handle stop control
            reset_all_mock()
            message_handler.run_message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()

            # Success to handle invalid control
            reset_all_mock()
            message_handler.run_message_handler({"control": "invalid"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                messages.ERR_MSG_FAIL_UNKNOWN_CONTROL.format("invalid"))

            # When "KeyError" error occurs
            reset_all_mock()
            mock_control_switch.side_effect = KeyError("Failure")

            with self.assertRaises(KeyError):
                message_handler.run_message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_not_called()
            message_handler.connector_client.stop_client.assert_called()

            # When other error occurs
            reset_all_mock()
            mock_control_switch.side_effect = Exception("Failure")

            with self.assertRaises(Exception):
                message_handler.run_message_handler({"control": "stop"})

            mock_control_switch.assert_called()
            mock_post_error_message.assert_called()
            mock_post_error_message.assert_called_with(
                "Failed to run the connection: Failure")
            message_handler.connector_client.stop_client.assert_called()
