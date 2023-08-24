# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json

from unittest import mock, TestCase
from boilerplate.logging.logger import get_logger


class TestLogger(TestCase):

    def test_get_logger(self):
        # Arrange and Act
        logger = get_logger("test-class-name")

        # Assert
        logger.info("test-log")
