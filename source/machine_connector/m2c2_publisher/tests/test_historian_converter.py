# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from converters.historian.historian_converter import HistorianConverter


class TestHistorianConverter(unittest.TestCase):
    def setUp(self):
        pass

    def test_convert_payload(self):
        # Arrange
        historian_converter = HistorianConverter(
            "test-source-id", "test-collector-id")
        payload = {
            "tag": "test-tag",
            "messages": [
                {
                    "quality": "GOOD",
                    "value": 100
                }
            ]
        }

        # Act
        converted_payload = historian_converter.convert_payload(payload)

        # Assert
        self.assertEqual(len(converted_payload), 1)
        self.assertEqual(converted_payload[0]['measurementId'], "test-tag")
        self.assertEqual(converted_payload[0]['sourceId'], "test-source-id")
        self.assertEqual(converted_payload[0]
                         ['collectorId'], "test-collector-id")
        self.assertEqual(converted_payload[0]['value'], 100)
        self.assertEqual(converted_payload[0]['measureQuality'], "GOOD")
        self.assertEqual(converted_payload[0]['measureName'], "test-tag")
