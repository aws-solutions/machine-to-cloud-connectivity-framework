# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import datetime
from unittest import mock, TestCase

from m2c2_modbus_tcp_connector.pymodbus_client import PyModbusClient

from utils import AWSEndpointClient
import config


class TestPyModbusClient(TestCase):

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.connect', return_value=True)
    def test_check_connection(self, mock_connect):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        connection = pymodbus_client.check_connection()

        # assert
        assert connection

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.close', return_value=True)
    def test_check_connection(self, mock_close):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.close()

        # assert
        mock_close.assert_called()

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_coils', return_value=None)
    def test_read_coils(self, read_coils_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_coils(1, None, 1)

        # assert
        read_coils_mock.assert_called_with(1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_coils', return_value=None)
    def test_read_coils_with_count(self, read_coils_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_coils(1, 1, 1)

        # assert
        read_coils_mock.assert_called_with(1, 1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_coils', return_value=None)
    def test_read_coils_error(self, read_coils_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)
        read_coils_mock.side_effect = Exception('wow something bad happened')

        # act
        pymodbus_client.read_coils(1, 1, 1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_discrete_inputs', return_value=None)
    def test_read_discrete_inputs(self, read_discrete_inputs_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_discrete_inputs(1, None, 1)

        # assert
        read_discrete_inputs_mock.assert_called_with(1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_discrete_inputs', return_value=None)
    def test_read_discrete_inputs_with_count(self, read_discrete_inputs_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_discrete_inputs(1, 1, 1)

        # assert
        read_discrete_inputs_mock.assert_called_with(1, 1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_discrete_inputs', return_value=None)
    def test_read_discrete_inputs_error(self, read_discrete_inputs_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)
        read_discrete_inputs_mock.side_effect = Exception(
            'wow something bad happened')

        # act
        pymodbus_client.read_discrete_inputs(1, 1, 1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_holding_registers', return_value=None)
    def test_read_holding_registers(self, read_holding_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_holding_registers(1, None, 1)

        # assert
        read_holding_registers_mock.assert_called_with(1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_holding_registers', return_value=None)
    def test_read_holding_registers_with_count(self, read_holding_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_holding_registers(1, 1, 1)

        # assert
        read_holding_registers_mock.assert_called_with(1, 1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_holding_registers', return_value=None)
    def test_read_holding_registers_error(self, read_holding_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)
        read_holding_registers_mock.side_effect = Exception(
            'wow something bad happened')

        # act
        pymodbus_client.read_holding_registers(1, 1, 1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_input_registers', return_value=None)
    def test_read_input_registers(self, read_input_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_input_registers(1, None, 1)

        # assert
        read_input_registers_mock.assert_called_with(1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_input_registers', return_value=None)
    def test_read_input_registers_with_count(self, read_input_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)

        # act
        pymodbus_client.read_input_registers(1, 1, 1)

        # assert
        read_input_registers_mock.assert_called_with(1, 1, secondary=1)

    @mock.patch('pymodbus.client.sync.ModbusTcpClient.read_input_registers', return_value=None)
    def test_read_input_registers_error(self, read_input_registers_mock):
        # arrange
        pymodbus_client = PyModbusClient('mock-url', 1)
        read_input_registers_mock.side_effect = Exception(
            'wow something bad happened')

        # act
        pymodbus_client.read_input_registers(1, 1, 1)
