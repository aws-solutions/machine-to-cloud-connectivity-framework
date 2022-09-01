# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import messages as msg

from dateutil import parser
from utils import AWSEndpointClient, InitMessage
from utils.custom_exception import ValidationException
from .m2c2_msg_types import OsiPiMsgValidations


class MessageValidation:
    """ensure that the data format is as should be"""
    """ Ex:
    {
        "alias": "{site_name}/{area}/{process}/{machine_name}/{tag}",
        "messages": [{
            "name": alias,
            "timestamp": str, (also validate this is a valid timestamp)
            "quality": 'Good|GOOD|Bad|BAD|Uncertain|UNCERTAIN',
            "value": any
        }]
    }
    """

    def __init__(self, topic: str) -> None:
        self.connector_client = AWSEndpointClient()
        self.vals = OsiPiMsgValidations()
        self.topic = topic

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def valid_val(self, entry: dict, validations: dict) -> bool:
        for k, v in entry.items():
            if not (validations.get(k, lambda x: False)(v)):
                return False
        return True

    def parsable(self, msg: dict) -> bool:
        try:
            parser.parse(msg["timestamp"])
        except parser._parser.ParserError:
            return False
        return True

    def find_missing_keys(self, msg: dict, key_list: list) -> list:
        missing_key = [key for key in key_list if key not in msg.keys()]
        return missing_key

    def add_connection_info(self, message: dict) -> dict:
        self.init_message = InitMessage()
        self.user_message = self.init_message.init_user_message()
        self.user_message["message"] = message
        return self.user_message

    def error_to_iot_and_raise(self, err: str) -> None:
        try:
            self.error_message = self.add_connection_info(err)
            self.connector_client.publish_message_to_iot_topic(
                self.topic, self.error_message
            )
            raise ValueError(err)
        except Exception as err:
            self.logger.error(
                "An unknown error has occurred while sending message validation error: '{}'".format(err))
            raise

    def validate_schema(self, message: dict) -> None:
        try:
            if not isinstance(message, dict):
                self.error_to_iot_and_raise(
                    msg.ERR_MSG_SCHEMA_MESSAGE_NOT_DICT.format(message))

            self.missing_keys = self.find_missing_keys(
                message, self.vals.payload_required_keys())
            if self.missing_keys:
                self.error_to_iot_and_raise(
                    msg.ERR_MISSING_KEYS.format(self.missing_keys))

            if not message["messages"]:
                self.error_to_iot_and_raise(
                    msg.ERR_MSG_SCHEMA_EMPTY_MESSAGES.format(message))

            if not self.valid_val(message, self.vals.payload_validations()):
                self.error_to_iot_and_raise(
                    msg.ERR_MSG_SCHEMA_MISSING_KEY.format(message))

            for entry in message["messages"]:
                self.entry_missing_keys = self.find_missing_keys(
                    entry,
                    self.vals.messages_required_keys()
                )
                if self.entry_missing_keys:
                    self.error_to_iot_and_raise(
                        msg.ERR_MISSING_KEYS.format(self.entry_missing_keys))

                if not self.valid_val(entry, self.vals.msgs_validations()):
                    self.error_to_iot_and_raise(
                        msg.ERR_MSG_SCHEMA_MISSING_KEY.format(entry))

                if not self.parsable(entry):
                    self.error_to_iot_and_raise(
                        msg.ERR_MSG_SCHEMA_DATE_CORRUPTED.format(entry))

                if entry["name"] != message["alias"]:
                    self.error_to_iot_and_raise(
                        msg.ERR_NAME_NOT_ALIAS.format(message))

        except Exception as err:
            self.logger.error("Message validation failed. Error: %s", str(err))
            raise ValidationException(msg.ERR_MSG_VALIDATION.format(err))
