# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import dateutil.parser as parser

from utils.custom_exception import ValidationException


class Message:

    def __init__(self, value: any, quality: str, timestamp: str) -> None:
        self.value = value
        self.quality = quality
        self.timestamp = timestamp

    def validate(self) -> None:
        if self.value is None or isinstance(self.quality, str) == False or isinstance(self.timestamp, str) == False:
            self._raise_validation_error(
                Exception(f"Attribute(s) invalid - value: {self.value}, quality: {self.quality}, timestamp: {self.timestamp}"))
        self._validate_timestamp()

    def _raise_validation_error(self, e: Exception) -> None:
        raise ValidationException("Could not validate message", e)

    def _validate_timestamp(self) -> None:
        try:
            parser.parse(self.timestamp)
        except Exception as e:
            self._raise_validation_error(e)
