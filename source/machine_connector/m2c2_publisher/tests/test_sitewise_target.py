# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest

from unittest import mock
from targets.sitewise_target import SiteWiseTarget


@mock.patch("utils.stream_manager_helper.StreamManagerHelperClient.__init__", return_value=None)
class TestSiteWiseTarget(unittest.TestCase):
    def setUp(self):
        self.sitewise_stream = "SiteWise_Stream"
        self.alias = "London/floor 1/packaging/messabout 2/Random-UInt4"
        self.value = 123
        self.sitewise_payload = {
            "propertyAlias": self.alias,
            "propertyValues": [
                {
                    "value": {"integerValue": self.value},
                    "timestamp": {
                        "timeInSeconds": 1622733261,
                        "offsetInNanos": 247000000
                    },
                    "quality": "GOOD"
                }
            ]
        }
        self.opcda_payload = {
            "alias": self.alias,
            "messages": [
                {
                    "value": self.value,
                    "quality": "Good",
                    "timestamp": "2021-06-03 15:14:21.247000+00:00",
                    "name": self.alias
                }
            ]
        }

    def test_send_opcda_data(self, mock_stream_manager_helper):
        sitewise_target = SiteWiseTarget("opcda", self.sitewise_stream)
        mock_sm_helper_client = mock_stream_manager_helper.MagicMock()
        sitewise_target.sm_helper_client = mock_sm_helper_client
        sitewise_target.sm_helper_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        sitewise_target.send_to_sitewise(self.opcda_payload)
        self.assertDictEqual(sitewise_target.payload, self.sitewise_payload)

    def test_send_opcua_data(self, mock_stream_manager_helper):
        sitewise_target = SiteWiseTarget("opcua", self.sitewise_stream)
        mock_sm_helper_client = mock_stream_manager_helper.MagicMock()
        sitewise_target.sm_helper_client = mock_sm_helper_client
        sitewise_target.sm_helper_client.write_to_stream = mock_stream_manager_helper.MagicMock()

        sitewise_target.send_to_sitewise(self.sitewise_payload)
        self.assertDictEqual(sitewise_target.payload, self.sitewise_payload)

    def test_wrong_opcda_payload(self, mock_stream_manager_helper):
        sitewise_target = SiteWiseTarget("opcda", self.sitewise_stream)

        with self.assertRaises(Exception):
            sitewise_target.send_to_sitewise({})
