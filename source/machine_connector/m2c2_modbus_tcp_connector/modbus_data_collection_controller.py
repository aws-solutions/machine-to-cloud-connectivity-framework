# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
from threading import Timer
import datetime

from boilerplate.messaging.message import Message
from boilerplate.messaging.message_sender import MessageSender
from boilerplate.messaging.message_batch import MessageBatch
import boilerplate.logging.logger as ConnectorLogging
from utils import AWSEndpointClient
from pymodbus_client import PyModbusClient
from modbus_secondary_config import modbusSecondaryConfig
from modbus_exception import ModbusException
import config
import messages as msg

CONNECTION_NAME = os.getenv("CONNECTION_NAME")

ERROR_RETRY = 5


class ModbusDataCollectionController:

    def __init__(self, message_sender: MessageSender, connector_client: AWSEndpointClient):
        self.logger = ConnectorLogging.get_logger(
            "modbus_data_collection_control.py")
        self.message_sender = message_sender
        self.connector_client = connector_client
        self.pymodbus_client = None

    def _add_message_to_batches(self, tag: str, message_batches: dict, message: Message):
        if tag not in message_batches:
            message_batches[tag] = MessageBatch(
                tag, [message], CONNECTION_NAME)
        else:
            message_batches[tag].messages.append(message)
        return message_batches

    def _read_coils(self, message_batches: dict, address: int, count: int, secondary_address: int, modbus_host_tag: str) -> dict:
        # example read coils response:
        # {'transaction_id': 19, 'protocol_id': 0, 'unit_id': 0, 'skip_encode': False, 'check': 0, 'bits': [True, False, False, False, False, False, False, False], 'byte_count': 1}
        read_coils_response = self.pymodbus_client.read_coils(
            address, count, secondary_address)
        if read_coils_response is not None:
            message = Message(
                read_coils_response.bits,
                'GOOD',
                str(datetime.datetime.now())
            )
            tag = f'{modbus_host_tag}_readCoils_{secondary_address}'
            message_batches = self._add_message_to_batches(
                tag, message_batches, message)
        else:
            self.logger.warning(
                f'Did not get a response for reading coils for secondary: {secondary_address}')
        return message_batches

    def _read_discrete_inputs(self, message_batches: dict, address: int, count: int, secondary_address: int, modbus_host_tag: str) -> dict:
        # example read discrete inputs response:
        # {'transaction_id': 20, 'protocol_id': 0, 'unit_id': 0, 'skip_encode': False, 'check': 0, 'bits': [True, False, False, False, False, False, False, False], 'byte_count': 1}
        read_descrete_inputs_response = self.pymodbus_client.read_discrete_inputs(
            address, count, secondary_address)
        if read_descrete_inputs_response is not None:
            message = Message(
                read_descrete_inputs_response.bits,
                'GOOD',
                str(datetime.datetime.now())
            )
            tag = f'{modbus_host_tag}_readDiscreteInputs_{secondary_address}'
            message_batches = self._add_message_to_batches(
                tag, message_batches, message)
        else:
            self.logger.warning(
                f'Did not get a response for reading discrete inputs for secondary: {secondary_address}')
        return message_batches

    def _read_holding_registers(self, message_batches: dict, address: int, count: int, secondary_address: int, modbus_host_tag: str) -> dict:
        # example read holding registers response:
        # {'transaction_id': 22, 'protocol_id': 0, 'unit_id': 0, 'skip_encode': False, 'check': 0, 'registers': [17, 17]}
        read_holding_registers_response = self.pymodbus_client.read_holding_registers(
            address, count, secondary_address)
        if read_holding_registers_response is not None:
            message = Message(
                read_holding_registers_response.registers,
                'GOOD',
                str(datetime.datetime.now())
            )
            tag = f'{modbus_host_tag}_readHoldingRegisters_{secondary_address}'
            message_batches = self._add_message_to_batches(
                tag, message_batches, message)
        else:
            self.logger.warning(
                f'Did not get a response for reading holding registers for secondary: {secondary_address}')
        return message_batches

    def _read_input_registers(self, message_batches: dict, address: int, count: int, secondary_address: int, modbus_host_tag: str) -> dict:
        # example read input registers response:
        # {'transaction_id': 22, 'protocol_id': 0, 'unit_id': 0, 'skip_encode': False, 'check': 0, 'registers': [17, 17]}
        read_input_registers_response = self.pymodbus_client.read_input_registers(
            address, count, secondary_address)
        if read_input_registers_response is not None:
            message = Message(
                read_input_registers_response.registers,
                'GOOD',
                str(datetime.datetime.now())
            )
            tag = f'{modbus_host_tag}_readInputRegisters_{secondary_address}'
            message_batches = self._add_message_to_batches(
                tag, message_batches, message)
        else:
            self.logger.warning(
                f'Did not get a response for reading input registers for secondary: {secondary_address}')
        return message_batches

    def _get_modbus_data(self, modbus_secondary_config: modbusSecondaryConfig, message_batches={}) -> dict:
        if modbus_secondary_config.do_read_coils:
            message_batches = self._read_coils(message_batches, modbus_secondary_config.read_coils_address, modbus_secondary_config.read_coils_count,
                                               modbus_secondary_config.secondary_address, modbus_secondary_config.modbus_host_tag)

        if modbus_secondary_config.do_read_discrete_inputs:
            message_batches = self._read_discrete_inputs(message_batches, modbus_secondary_config.read_discrete_inputs_address,
                                                         modbus_secondary_config.read_discrete_inputs_count, modbus_secondary_config.secondary_address, modbus_secondary_config.modbus_host_tag)

        if modbus_secondary_config.do_read_holding_registers:
            message_batches = self._read_holding_registers(message_batches, modbus_secondary_config.read_holding_registers_address,
                                                           modbus_secondary_config.read_holding_registers_count, modbus_secondary_config.secondary_address, modbus_secondary_config.modbus_host_tag)

        if modbus_secondary_config.do_read_input_registers:
            message_batches = self._read_input_registers(message_batches, modbus_secondary_config.read_input_registers_address,
                                                         modbus_secondary_config.read_input_registers_count, modbus_secondary_config.secondary_address, modbus_secondary_config.modbus_host_tag)
        return message_batches

    def _send_modbus_data(self, modbus_message_batches: dict) -> dict:
        try:
            for tag, message_batch in modbus_message_batches.items():
                self.logger.debug(f'Sending message batch with tag {tag}...')
                print("sending")
                self.message_sender.post_message_batch(message_batch)
                modbus_message_batches = {}
        except Exception as e:
            self.logger.error(
                f'Received error while sending modbus message batches: {e}')
        return modbus_message_batches

    def _execute_data_retrieval(self, modbus_secondary_config: modbusSecondaryConfig, message_batches: dict = {}) -> dict:
        modbus_message_batches = self._get_modbus_data(
            modbus_secondary_config, message_batches)

        modbus_message_batches = self._send_modbus_data(modbus_message_batches)
        return modbus_message_batches

    def _stop(self, message_batches):
        if len(message_batches) > 0:
            self.send_modbus_data(message_batches)
            message_batches = {}

        self.connector_client.stop_client()

    def _init_client(self, url: str, port: int):
        self.logger.debug(f'Initing client with url and port: {url}, {port}')
        if self.pymodbus_client is None:
            self.pymodbus_client = PyModbusClient(url, port)
            if self.pymodbus_client.check_connection() == False:
                raise ModbusException('Could not connect')

    def data_collection_control(self, modbus_secondary_config: modbusSecondaryConfig, message_batches: dict = {}, iteration: int = 0, error_count: int = 0) -> None:
        """
        Controls data collection from the OPC DA server.
        When the control is `start`, it starts reading the data based on the provided tags.
        When the control is `stop`, it stops reading the data.

        :param connection_data: The connection data
        :param payload_content: The payload content which will be sent to the cloud
        :param iteration: The current iteration
        :param error_count: The number of error count
        """
        current_error_count = error_count
        current_iteration = iteration

        self.logger.debug(f'Control is {config.control}')

        if config.control == 'stop':
            self.logger.debug('Stopping data collection')
            self._stop(message_batches)
        elif config.control == 'start':
            self.logger.debug('Starting data collection')
            try:
                self._init_client(modbus_secondary_config.modbus_host_url,
                                  modbus_secondary_config.modbus_host_port)
                message_batches = self._execute_data_retrieval(
                    modbus_secondary_config, message_batches)
            except Exception as err:
                current_error_count = self._handle_get_data_error(
                    modbus_secondary_config,
                    error=err,
                    error_count=current_error_count
                )

            Timer(
                interval=modbus_secondary_config.frequency_in_seconds,
                function=self.data_collection_control,
                args=[modbus_secondary_config, message_batches,
                      current_iteration, current_error_count]
            ).start()

    def _handle_get_data_error(self, modbus_secondary_config: dict, error: Exception, error_count: int) -> int:
        """
        Handles job execution error.
        When it exceeds the number of retry, `ERROR_RETRY`, retry to connect to OPC DA server.
        When if fails ultimately, the connection is going to be stopped.

        :param connection_data: The connection data
        :param error: The error occurring while getting the data
        :param error_count: The number of error count
        :return: The number of error count
        """
        self.logger.error(f"Unable to read from modbus secondary: {error}")
        self.logger.exception(error)
        error_count += 1

        if error_count >= ERROR_RETRY:
            config.control = "stop"

            error_message = msg.ERR_MSG_LOST_CONNECTION_STOPPED.format(
                modbus_secondary_config)
            self.logger.error(error_message)
            self.message_sender.post_error_message(error_message)

        return error_count
