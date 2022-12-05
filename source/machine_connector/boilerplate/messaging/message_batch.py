# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os

from boilerplate.messaging.message import Message
from utils.custom_exception import ValidationException

# Site name from component environment variables
SITE_NAME = os.getenv("SITE_NAME")
# Area from component environment variables
AREA = os.getenv("AREA")
# Process from component environment variables
PROCESS = os.getenv("PROCESS")
# Machine name from component environment variables
MACHINE_NAME = os.getenv("MACHINE_NAME")


class MessageBatch:

    def __init__(self, tag: str, messages: 'list[Message]', source_id: str) -> None:
        self.alias = f"{SITE_NAME}/{AREA}/{PROCESS}/{MACHINE_NAME}/{tag}"
        self.messages = self._get_messages_as_dict(messages)
        self.sourceId = source_id
        self.validate(tag, messages)

    def validate(self, tag: str, messages: 'list[Message]') -> None:
        if (isinstance(self.alias, str) == False
            or isinstance(tag, str) == False
                or len(messages) == 0
                or isinstance(self.sourceId, str) == False):
            self._raise_validation_error()

        for message in messages:
            message.validate()

    def _get_messages_as_dict(self, messages: 'list[Message]'):
        messages_as_dict = []
        for message in messages:
            message_dict = message.__dict__
            message_dict['name'] = self.alias
            messages_as_dict.append(message_dict)
        return messages_as_dict

    def _raise_validation_error(self) -> None:
        raise ValidationException("Could not validate message batch")
