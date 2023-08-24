# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from pymodbus.client.sync import ModbusSerialClient
from pymodbus.device import ModbusDeviceIdentification


from pymodbus.client.sync import ModbusTcpClient
from pymodbus.transaction import (
    ModbusSocketFramer
)

import boilerplate.logging.logger as ConnectorLogging


class PyModbusClient:

    def __init__(self, url: str, port: int):
        self.client = ModbusTcpClient(
            url, port=port, framer=ModbusSocketFramer)

        self.logger = ConnectorLogging.get_logger("pymodbus_client.py")

    def check_connection(self) -> bool:
        return self.client.connect()

    def read_coils(self, address: int, count: int, secondary_address: int):
        self.logger.debug(
            f'Reading coils at {address} {count} {secondary_address}')
        try:
            if count is None:
                return self.client.read_coils(address, secondary=secondary_address)
            else:
                return self.client.read_coils(address, count, secondary=secondary_address)
        except Exception as e:
            self.logger.error(
                f'Error while reading coils for secondary {secondary_address}')
            self.logger.error(e)

    def read_discrete_inputs(self, address: int, count: int, secondary_address: int):
        self.logger.debug(
            f'Reading discrete inputs at {address} {count} {secondary_address}')
        try:
            if count is None:
                return self.client.read_discrete_inputs(address, secondary=secondary_address)
            else:
                return self.client.read_discrete_inputs(address, count, secondary=secondary_address)
        except Exception as e:
            self.logger.error(
                f'Error while reading discrete inputs for secondary {secondary_address}')
            self.logger.error(e)

    def read_holding_registers(self, address: int, count: int, secondary_address: int):
        self.logger.debug(
            f'Reading holding registers at {address} {count} {secondary_address}')
        try:
            if count is None:
                return self.client.read_holding_registers(address, secondary=secondary_address)
            else:
                return self.client.read_holding_registers(address, count, secondary=secondary_address)
        except Exception as e:
            self.logger.error(
                f'Error while reading holding registers for secondary {secondary_address}')
            self.logger.error(e)

    def read_input_registers(self, address: int, count: int, secondary_address: int):
        self.logger.debug(
            f'Reading input registers at {address} {count} {secondary_address}')
        try:
            if count is None:
                return self.client.read_input_registers(address, secondary=secondary_address)
            else:
                return self.client.read_input_registers(address, count, secondary=secondary_address)
        except Exception as e:
            self.logger.error(
                f'Error while reading input registers for secondary {secondary_address}')
            self.logger.error(e)

    def close(self):
        self.client.close()
