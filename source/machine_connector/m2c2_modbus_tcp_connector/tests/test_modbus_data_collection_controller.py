# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import datetime
from unittest import mock, TestCase


from m2c2_modbus_tcp_connector.modbus_secondary_config import modbusSecondaryConfig


from utils import AWSEndpointClient
import config


class TestModbusDataCollectionController(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.environ["CONNECTION_GG_STREAM_NAME"] = "test-gg-stream"
        os.environ["SITE_NAME"] = "test-site"
        os.environ["AREA"] = "test-area"
        os.environ["PROCESS"] = "test-process"
        os.environ["MACHINE_NAME"] = "test-machine-name"
        os.environ["CONNECTION_NAME"] = "test-connection"
        os.environ["LOG_LEVEL"] = 'DEBUG'

    @mock.patch('threading.Timer.start', return_value=None)
    @mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('boilerplate.messaging.message_sender.MessageSender.post_message_batch', return_value=None)
    @mock.patch('pymodbus_client.PyModbusClient.__init__', return_value=None)
    @mock.patch('pymodbus_client.PyModbusClient.read_coils')
    @mock.patch('pymodbus_client.PyModbusClient.check_connection')
    @mock.patch('pymodbus_client.PyModbusClient.read_discrete_inputs')
    @mock.patch('pymodbus_client.PyModbusClient.read_holding_registers')
    @mock.patch('pymodbus_client.PyModbusClient.read_input_registers')
    def test_data_collection_control(self,
                                     pymodbus_read_input_registers_mock,
                                     pymodbus_read_holding_registers_mock,
                                     pymodbus_read_discrete_inputs_mock,
                                     pymodbus_check_connection_mock,
                                     pymodbus_read_coils_mock,
                                     pymodbus_constructor_mock,
                                     message_sender_mock,
                                     mock_endpoint_client,
                                     mock_smh_init,
                                     timer_mock):

        # arrange
        # importing here because os environment vars need to be set previous
        from m2c2_modbus_tcp_connector.modbus_data_collection_controller import ModbusDataCollectionController
        from boilerplate.messaging.message_sender import MessageSender

        class MockReadCoilsResponse:
            def __init__(self):
                self.bits = [True]

        class MockReadDiscreteInputsResponse:
            def __init__(self):
                self.bits = [True]

        class MockReadHoldingRegistersResponse:
            def __init__(self):
                self.registers = [17]

        class MockReadInputRegistersResponse:
            def __init__(self):
                self.registers = [17]

        pymodbus_read_coils_mock.return_value = MockReadCoilsResponse()
        pymodbus_read_discrete_inputs_mock.return_value = MockReadDiscreteInputsResponse()
        pymodbus_read_holding_registers_mock.return_value = MockReadHoldingRegistersResponse()
        pymodbus_read_input_registers_mock.return_value = MockReadInputRegistersResponse()
        pymodbus_check_connection_mock.return_value = True

        message_sender = MessageSender()
        connector_client = AWSEndpointClient()
        controller = ModbusDataCollectionController(
            message_sender, connector_client)

        secondary_config_dict = {
            'secondaryAddress': 1,
            'frequencyInSeconds': 5,
            'commandConfig': {
                'readCoils': {
                    'address': 1,
                    'count': 1
                },
                'readDiscreteInputs': {
                    'address': 1,
                    'count': 1
                },
                'readHoldingRegisters': {
                    'address': 1,
                    'count': 1
                },
                'readInputRegisters': {
                    'address': 1,
                    'count': 1
                }
            }
        }
        modbus_secondary_config = modbusSecondaryConfig(
            secondary_config_dict, 'mock-host', 5020, 'mock-tag')

        # act
        config.control = 'start'
        controller.data_collection_control(modbus_secondary_config)

        # assert
        pymodbus_read_coils_mock.assert_called_with(1, 1, 1)
        pymodbus_read_discrete_inputs_mock.assert_called_with(1, 1, 1)
        pymodbus_read_holding_registers_mock.assert_called_with(1, 1, 1)
        pymodbus_read_input_registers_mock.assert_called_with(1, 1, 1)

        read_coils_message_batch_result = message_sender_mock.call_args_list[0][0][0]
        assert read_coils_message_batch_result.alias == 'None/None/None/None/mock-tag_readCoils_1'
        assert read_coils_message_batch_result.sourceId == 'test-connection'
        assert len(read_coils_message_batch_result.messages) == 1
        assert read_coils_message_batch_result.messages[0]['quality'] == 'GOOD'
        assert read_coils_message_batch_result.messages[0][
            'name'] == 'None/None/None/None/mock-tag_readCoils_1'
        assert read_coils_message_batch_result.messages[0]['timestamp'] is not None

        read_discrete_inputs_message_batch_result = message_sender_mock.call_args_list[
            1][0][0]
        assert read_discrete_inputs_message_batch_result.alias == 'None/None/None/None/mock-tag_readDiscreteInputs_1'
        assert read_discrete_inputs_message_batch_result.sourceId == 'test-connection'
        assert len(read_discrete_inputs_message_batch_result.messages) == 1
        assert read_discrete_inputs_message_batch_result.messages[0]['quality'] == 'GOOD'
        assert read_discrete_inputs_message_batch_result.messages[0][
            'name'] == 'None/None/None/None/mock-tag_readDiscreteInputs_1'
        assert read_discrete_inputs_message_batch_result.messages[0]['timestamp'] is not None

        read_holding_registers_message_batch_result = message_sender_mock.call_args_list[
            2][0][0]
        assert read_holding_registers_message_batch_result.alias == 'None/None/None/None/mock-tag_readHoldingRegisters_1'
        assert read_holding_registers_message_batch_result.sourceId == 'test-connection'
        assert len(read_holding_registers_message_batch_result.messages) == 1
        assert read_holding_registers_message_batch_result.messages[0]['quality'] == 'GOOD'
        assert read_holding_registers_message_batch_result.messages[0][
            'name'] == 'None/None/None/None/mock-tag_readHoldingRegisters_1'
        assert read_holding_registers_message_batch_result.messages[0]['timestamp'] is not None

        read_holding_registers_message_batch_result = message_sender_mock.call_args_list[
            3][0][0]
        assert read_holding_registers_message_batch_result.alias == 'None/None/None/None/mock-tag_readInputRegisters_1'
        assert read_holding_registers_message_batch_result.sourceId == 'test-connection'
        assert len(read_holding_registers_message_batch_result.messages) == 1
        assert read_holding_registers_message_batch_result.messages[0]['quality'] == 'GOOD'
        assert read_holding_registers_message_batch_result.messages[0][
            'name'] == 'None/None/None/None/mock-tag_readInputRegisters_1'
        assert read_holding_registers_message_batch_result.messages[0]['timestamp'] is not None

    @mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch("utils.AWSEndpointClient.__init__", return_value=None)
    @mock.patch('boilerplate.messaging.message_sender.MessageSender.post_error_message', return_value=None)
    def test_handle_error_message(self, post_error_mock, endpoint_mock, smh_mock):
        from m2c2_modbus_tcp_connector.modbus_data_collection_controller import ModbusDataCollectionController
        from boilerplate.messaging.message_sender import MessageSender

        message_sender = MessageSender()
        connector_client = AWSEndpointClient()
        controller = ModbusDataCollectionController(
            message_sender, connector_client)

        secondary_config_dict = {
            'secondaryAddress': 1,
            'frequencyInSeconds': 5,
            'commandConfig': {
                'readCoils': {
                    'address': 1,
                    'count': 1
                },
                'readDiscreteInputs': {
                    'address': 1,
                    'count': 1
                },
                'readHoldingRegisters': {
                    'address': 1,
                    'count': 1
                },
                'readInputRegisters': {
                    'address': 1,
                    'count': 1
                }
            }
        }
        modbus_secondary_config = modbusSecondaryConfig(
            secondary_config_dict, 'mock-host', 5020, 'mock-tag')

        # act
        config.control = 'start'
        controller._handle_get_data_error(
            modbus_secondary_config, Exception('mock-error'), 1)

        # assert
        post_error_mock.assert_not_called()

        # act again
        config.control = 'start'
        controller._handle_get_data_error(
            modbus_secondary_config, Exception('mock-error'), 5)

        # assert again
        post_error_mock.assert_called()
