# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import copy

from unittest import TestCase
from unittest.mock import patch
from validations.message_validation import MessageValidation
from utils.custom_exception import ValidationException


class TestMesasgeValidation(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.environ["SITE_NAME"] = "test-site"
        os.environ["AREA"] = "test-area"
        os.environ["PROCESS"] = "test-process"
        os.environ["MACHINE_NAME"] = "test-machine-name"

    def setUp(self) -> None:
        self.topic = "test/topic"
        self.message = {
            "alias": "/test/alias",
            "messages": [
                {
                    "name": "/test/alias",
                    "timestamp": "2022-01-25 00:00:00+00:00",
                    "value": 123,
                    "quality": "Good"
                }
            ]
        }

        with patch("utils.AWSEndpointClient.__init__", return_value=None) as mock_endpoint_client:
            self.message_validation = MessageValidation(self.topic)
            self.message_validation.connector_client = mock_endpoint_client.MagicMock()
            self.message_validation.connector_client.publish_message_to_iot_topic = mock_endpoint_client.MagicMock()

    def test_validate_schema(self) -> None:
        message = ""

        # Message is not dictionary.
        with self.assertRaises(ValidationException):
            self.message_validation.validate_schema(message)

        # Missing key in message, alias and messages are missing.
        with self.assertRaises(ValidationException):
            message = {}
            self.message_validation.validate_schema(message)

        # Missing key in message, alias is missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["alias"]
            self.message_validation.validate_schema(message)

        # Missing key in message, messages are missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["messages"]
            self.message_validation.validate_schema(message)

        # No data in messages.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"] = []
            self.message_validation.validate_schema(message)

        # Missing key in schema, alias is not a string.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["alias"] = 123
            self.message_validation.validate_schema(message)

        # Missing key in schema, messages are not a list.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"] = 123
            self.message_validation.validate_schema(message)

        # Missing key in message, name is missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["messages"][0]["name"]
            self.message_validation.validate_schema(message)

        # Missing key in message, timestamp is missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["messages"][0]["timestamp"]
            self.message_validation.validate_schema(message)

        # Missing key in message, value is missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["messages"][0]["value"]
            self.message_validation.validate_schema(message)

        # Missing key in message, quality is missing.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            del message["messages"][0]["quality"]
            self.message_validation.validate_schema(message)

        # Missing key in schema, name is not a string.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"][0]["name"] = 123
            self.message_validation.validate_schema(message)

        # Missing key in schema, timestamp is not a string.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"][0]["timestamp"] = 123
            self.message_validation.validate_schema(message)

        # Missing key in schema, quality is not an allowed string.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"][0]["quality"] = "Invalid"
            self.message_validation.validate_schema(message)

        # Datestamp is malformed in message.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"][0]["timestamp"] = "Invalid"
            self.message_validation.validate_schema(message)

        # Name does not equal to alias.
        with self.assertRaises(ValidationException):
            message = copy.deepcopy(self.message)
            message["messages"][0]["name"] = "Invalid"
            self.message_validation.validate_schema(message)

        try:
            message = copy.deepcopy(self.message)
            self.message_validation.validate_schema(message)
        except Exception:
            self.fail("The exception shouldn't happen.")

        # It should pass the possibly False values such as boolean False or 0 number.
        try:
            message = copy.deepcopy(self.message)
            message["messages"][0]["value"] = False
            self.message_validation.validate_schema(message)
        except Exception:
            self.fail("The exception shouldn't happen.")
