# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
import sys
import unittest
from unittest import mock
import pytest


class TestSiteWiseTarget(unittest.TestCase):

    def setUp(self):
        self.opcua_protocol = "opcua"
        self.opcda_protocol = "opcda"
        self.sitewise_stream = "Test_SiteWise_Stream"
        self.opcua_payload = {
            "alias": "/Realtimedata/Tag17",
            "messages": [
                {
                    "name": "/Realtimedata/Tag17",
                    "value": -6.163894400344661e-30,
                    "timestamp": 1623431146832,
                    "quality": "GOOD"
                }
            ]
        }
        self.opcda_payload = {
            'alias': 'London/floor 1/packaging/messabout 2/Random-UInt4',
            'messages': [
                {
                    'value': 2479.0,
                    'quality': 'Good',
                    'timestamp': '2021-06-03 15:14:21.247000+00:00',
                    'name': 'London/floor 1/packaging/messabout 2/Random-UInt4'
                }
               ]
            }


    @mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch('converters.sitewise_converter.SiteWiseConverter.__init__', return_value=None)
    def test_send_opcda_data(self, mock_swconverter, mock_stream_manager):
        from targets.sitewise_target import SiteWiseTarget
        self.opcda_client = SiteWiseTarget(self.opcda_protocol, self.sitewise_stream)
        with mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.write_to_stream') as mock_write:
            with mock.patch('converters.sitewise_converter.SiteWiseConverter.sw_required_format') as mock_converter:
                self.opcda_client.send_to_sitewise(self.opcda_payload)
                self.assertTrue(mock_write.called)
                self.assertTrue(mock_converter.called)

    @mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.__init__', return_value=None)
    @mock.patch('converters.sitewise_converter.SiteWiseConverter.__init__', return_value=None)
    def test_send_opcua_data(self, mock_swconverter, mock_stream_manager):
        from targets.sitewise_target import SiteWiseTarget
        self.opcda_client = SiteWiseTarget(self.opcua_protocol, self.sitewise_stream)
        with mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.write_to_stream') as mock_write:
            with mock.patch('converters.sitewise_converter.SiteWiseConverter.sw_required_format') as mock_converter:
                self.opcda_client.send_to_sitewise(self.opcua_payload)
                self.assertTrue(mock_write.called)
                self.assertFalse(mock_converter.called)
    
    @mock.patch('utils.stream_manager_helper.StreamManagerHelperClient.__init__', return_value=None)
    def test_no_payload_exception(self, mock_stream_manager):
        from targets.sitewise_target import SiteWiseTarget
        self.opcda_client = SiteWiseTarget(self.opcda_protocol, self.sitewise_stream)
        with pytest.raises(Exception):
            self.opcda_client.send_to_sitewise()
