# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from modbus_exception import ModbusException


class ModbusSlaveConfig:
    def __init__(self, modbus_slave_config: dict, modbus_host: str, modbus_host_port: int, modbus_host_tag: str):
        self.modbus_slave_config = modbus_slave_config

        self._validate()

        self.modbus_host_url = modbus_host
        self.modbus_host_port = modbus_host_port
        self.modbus_host_tag = modbus_host_tag

        self.do_read_coils = False
        self.do_read_discrete_inputs = False
        self.do_read_holding_registers = False
        self.do_read_input_registers = False

        self._check_slave_address()
        self._check_frequency_in_seconds()
        self._check_read_coils()
        self._check_read_discrete_inputs()
        self._check_read_holding_registers()
        self._check_read_input_registers()

    def _check_slave_address(self):
        try:
            self.slave_address = int(self.modbus_slave_config['slaveAddress'])
        except ValueError as e:
            print(e)
            raise ModbusException(
                f'Slave address must be an int: {self.modbus_slave_config["slaveAddress"]}')

    def _check_frequency_in_seconds(self):
        self.frequency_in_seconds = self.modbus_slave_config['frequencyInSeconds']

    def _check_read_coils(self):
        if 'readCoils' in self.modbus_slave_config['commandConfig']:
            self.do_read_coils = True
            try:
                self.read_coils_address = int(
                    self.modbus_slave_config['commandConfig']['readCoils']['address'])
            except ValueError:
                raise ModbusException(
                    f'Read coils address misconfigured')
            self.read_coils_count = None
            if 'count' in self.modbus_slave_config['commandConfig']['readCoils']:
                try:
                    self.read_coils_count = int(
                        self.modbus_slave_config['commandConfig']['readCoils']['count'])
                except ValueError:
                    raise ModbusException(f'Read coils count misconfigured')

    def _check_read_discrete_inputs(self):
        if 'readDiscreteInputs' in self.modbus_slave_config['commandConfig']:
            self.do_read_discrete_inputs = True
            try:
                self.read_discrete_inputs_address = int(self.modbus_slave_config[
                    'commandConfig']['readDiscreteInputs']['address'])
            except ValueError:
                raise ModbusException(
                    f'Read discrete inputs address misconfigured')
            self.read_discrete_inputs_count = None
            if 'count' in self.modbus_slave_config['commandConfig']['readDiscreteInputs']:
                try:
                    self.read_discrete_inputs_count = int(
                        self.modbus_slave_config['commandConfig']['readDiscreteInputs']['count'])
                except ValueError:
                    raise ModbusException(
                        f'Read discrete inputs count misconfigured')

    def _check_read_holding_registers(self):
        if 'readHoldingRegisters' in self.modbus_slave_config['commandConfig']:
            self.do_read_holding_registers = True
            try:
                self.read_holding_registers_address = int(self.modbus_slave_config[
                    'commandConfig']['readHoldingRegisters']['address'])
            except ValueError:
                raise ModbusException(
                    f'Read holding registers address misconfigured')
            self.read_holding_registers_count = None
            if 'count' in self.modbus_slave_config['commandConfig']['readHoldingRegisters']:
                try:
                    self.read_holding_registers_count = int(
                        self.modbus_slave_config['commandConfig']['readHoldingRegisters']['count'])
                except ValueError:
                    raise ModbusException(
                        f'Read holding registers count misconfigured')

    def _check_read_input_registers(self):
        if 'readInputRegisters' in self.modbus_slave_config['commandConfig']:
            self.do_read_input_registers = True
            try:
                self.read_input_registers_address = int(self.modbus_slave_config[
                    'commandConfig']['readInputRegisters']['address'])
            except ValueError:
                raise ModbusException(
                    f'Read input registers count misconfigured')
            self.read_input_registers_count = None
            if 'count' in self.modbus_slave_config['commandConfig']['readInputRegisters']:
                try:
                    self.read_input_registers_count = int(
                        self.modbus_slave_config['commandConfig']['readInputRegisters']['count'])
                except ValueError:
                    raise ModbusException(
                        f'Read input registers count misconfigured')

    def _validate(self) -> None:
        if 'slaveAddress' not in self.modbus_slave_config or 'frequencyInSeconds' not in self.modbus_slave_config or 'commandConfig' not in self.modbus_slave_config:
            raise ModbusException(
                'Slave config missing slaveAddress or frequencyInSeconds or commandConfig')

        if len(self.modbus_slave_config['commandConfig']) == 0:
            raise ModbusException(
                'Slave command config cannot be an empty list')

        for key, val in self.modbus_slave_config['commandConfig'].items():
            if key not in ['readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters']:
                raise ModbusException('Invalid command config name')
            if type(val) != dict:
                raise ModbusException('Invalid command config, must be dict')
            if 'address' not in self.modbus_slave_config['commandConfig'][key]:
                raise ModbusException(
                    'address must be in slave command config')
