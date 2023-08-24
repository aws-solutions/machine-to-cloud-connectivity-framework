# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import datetime
import logging
from unittest import mock, TestCase

from boilerplate.messaging.message_batch import MessageBatch
from boilerplate.messaging.message import Message
from utils.custom_exception import ValidationException


class TestMessageBatch(TestCase):

    def test_valid_init(self):
        # Arrange
        tag = "test-tag"
        messages = [Message("test-value", "GOOD",
                            str(datetime.datetime.now()))]
        source_id = "test-source-id"

        # Act
        message_batch = MessageBatch(tag, messages, source_id)

        # Assert
        # No error thrown

    def test_invalid_init_tag(self):
        # Arrange
        tag = None
        messages = [Message("test-value", "GOOD",
                            str(datetime.datetime.now()))]
        source_id = "test-source-id"

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)

    def test_invalid_init_messages(self):
        # Arrange
        tag = "test-tag"
        messages = []
        source_id = "test-source-id"

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)

    def test_invalid_init_source_id(self):
        # Arrange
        tag = "test-tag"
        messages = [Message("test-value", "GOOD",
                            str(datetime.datetime.now()))]
        source_id = None

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)

    def test_invalid_init_message_value(self):
        # Arrange
        tag = "test-tag"
        messages = [Message(None, "GOOD", str(datetime.datetime.now()))]
        source_id = "test-source-id"

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)

    def test_invalid_init_message_quality(self):
        # Arrange
        tag = "test-tag"
        messages = [Message("test-value", None, str(datetime.datetime.now()))]
        source_id = "test-source-id"

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)

    def test_invalid_init_datetime(self):
        # Arrange
        tag = "test-tag"
        messages = [Message("test-value", "GOOD", "")]
        source_id = "test-source-id"

        # Act and Assert
        with self.assertRaises(ValidationException) as context:
            message_batch = MessageBatch(tag, messages, source_id)
