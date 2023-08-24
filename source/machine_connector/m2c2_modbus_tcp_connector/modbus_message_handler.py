# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
from inspect import signature
import messages as msg

from utils.custom_exception import ConnectorException
from utils import AWSEndpointClient
from boilerplate.messaging.message_sender import MessageSender
import boilerplate.logging.logger as ConnectorLogging
from modbus_data_collection_controller import ModbusDataCollectionController
from modbus_secondary_config import modbusSecondaryConfig
import config
from modbus_exception import ModbusException


class ModbusMessageHandler:

    def __init__(self):
        self.message_sender = MessageSender()
        self.connector_client = AWSEndpointClient()
        self.data_collection_controller = ModbusDataCollectionController(
            self.message_sender,
            self.connector_client)

        self.CONNECTION_NAME = os.getenv("CONNECTION_NAME")

        self.logger = ConnectorLogging.get_logger("modbus_message_handler.py")

    def control_switch(self) -> dict:
        """Acts like switch/case in the source code for the connection control."""
        return {
            "start": self.start,
            "stop": self.stop,
            "pull": self.pull,
            "push": self.push
        }

    def run_message_handler(self, connection_data: dict) -> None:
        """
        Modbus TCP Connector message handler.

        :param connection_data: The connection data including the connection control and connection information
        """

        try:
            if not config.lock:
                config.lock = True
                connection_control = connection_data["control"].lower()

                if connection_control in self.control_switch().keys():
                    control_action_function = self.control_switch().get(
                        connection_control
                    )

                    # Pass the connection data when action requires the connection data as a parameter: start, update, push
                    # Otherwise, it doesn't pass the connection data as a parameter: push, pull
                    if len(signature(control_action_function).parameters) > 0:
                        control_action_function(connection_data)
                    else:
                        control_action_function()
                else:
                    self.message_sender.post_error_message(msg.ERR_MSG_FAIL_UNKNOWN_CONTROL.format(
                        connection_control))

                config.lock = False
            else:
                self.logger.info("The function is still processing.")
        except Exception as err:
            self.logger.error(
                f"Failed to run the connection on the function: {err}")

            if type(err).__name__ != "KeyError":
                self.message_sender.post_error_message(
                    f"Failed to run the connection: {err}")

            config.lock = False
            self.connector_client.stop_client()

            raise

    def _start_data_collection(self, connection_data: dict) -> None:
        modbus_connection_data = connection_data['modbusTcp']

        if 'host' not in modbus_connection_data:
            raise ModbusException('Must have "host" configured')
        modbus_host = modbus_connection_data['host']

        if 'hostPort' not in modbus_connection_data:
            raise ModbusException('Must have "hostPort" configured')
        try:
            modbus_host_port = int(
                modbus_connection_data['hostPort'])
        except ValueError:
            raise ModbusException(
                f'Could not convert modbus host port to int: {modbus_connection_data["hostPort"]}')

        if 'hostTag' not in modbus_connection_data:
            raise ModbusException('Must have "hostTag" configured')
        modbus_host_tag = modbus_connection_data['hostTag']

        for modbus_secondary_config in modbus_connection_data['modbusSecondariesConfig']:
            secondary_config = modbusSecondaryConfig(
                modbus_secondary_config, modbus_host, modbus_host_port, modbus_host_tag)
            self.data_collection_controller.data_collection_control(
                secondary_config)

    def start(self, connection_data: dict) -> None:
        """Start a connection based on the connection data."""

        try:
            if self.connector_client.is_running:
                self.message_sender.post_info_message(
                    msg.ERR_MSG_FAIL_LAST_COMMAND_START.format(self.CONNECTION_NAME))
            else:
                self.logger.info("User request: start")

                config.control = "start"

                self.connector_client.start_client(
                    connection_name=self.CONNECTION_NAME,
                    connection_configuration=connection_data
                )

                self._start_data_collection(connection_data)
                self.message_sender.post_info_message(
                    msg.INF_MSG_CONNECTION_STARTED)

        except Exception as err:
            error_message = f"Failed to execute the start: {err}"
            self.logger.error(error_message)
            raise ConnectorException(error_message)

    def stop(self) -> None:
        """Stop a connection based on the connection data."""

        try:
            if self.connector_client.is_running:
                self.logger.info("User request: stop")

                config.control = "stop"

                local_connection_data = self.connector_client.read_local_connection_configuration(
                    connection_name=self.CONNECTION_NAME
                )

                if local_connection_data:
                    local_connection_data["control"] = "stop"
                    self.connector_client.write_local_connection_configuration_file(
                        connection_name=self.CONNECTION_NAME,
                        connection_configuration=local_connection_data,
                    )

                    self.message_sender.post_info_message(
                        msg.INF_MSG_CONNECTION_STOPPED)
            else:
                self.message_sender.post_info_message(
                    msg.ERR_MSG_FAIL_LAST_COMMAND_STOP.format(self.CONNECTION_NAME))
        except Exception as err:
            error_message = f"Failed to execute the stop: {err}"
            self.logger.error(error_message)
            raise ConnectorException(error_message)

    def push(self, connection_data: dict) -> None:
        """Send the configuration to the user"""

        self.logger.info("User request: push")

        try:
            self.message_sender.post_info_message(
                msg.INF_MSG_CONFIGURATION.format(connection_data))
        except Exception as err:
            error_message = msg.ERR_MSG_FAIL_SERVER_NAME.format(err)
            self.logger.error(error_message)
            self.message_sender.post_error_message(error_message)

    def pull(self) -> None:
        """Send the local connection data, if exists, to users through the IoT topic."""

        self.logger.info("User request: pull")

        try:
            local_connection_data = self.connector_client.read_local_connection_configuration(
                self.CONNECTION_NAME)

            if local_connection_data:
                self.message_sender.post_info_message(local_connection_data)
            else:
                self.message_sender.post_error_message(
                    msg.ERR_MSG_NO_CONNECTION_FILE.format(self.CONNECTION_NAME))
        except Exception as err:
            error_message = msg.ERR_MSG_FAIL_SERVER_NAME.format(err)
            self.logger.error(error_message)
            self.message_sender.post_error_message(error_message)
