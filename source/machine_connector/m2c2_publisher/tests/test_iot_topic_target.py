# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
import sys
import unittest
from unittest import mock
import pytest

gg_mock = mock.MagicMock()

sys.modules['greengrasssdk'] = gg_mock
sys.modules['greengrasssdk.stream_manager'] = gg_mock
sys.modules['dbm'] = mock.MagicMock()



@mock.patch('converters.common_converter.CommonConverter')
@mock.patch('converters.iot_topic_converter.IoTTopicConverter')
@mock.patch('converters.tag_converter.TagConverter')
@mock.patch('utils.AWSEndpointClient')
class TestIoTTopicTarget(unittest.TestCase):

    def setUp(self):
        self.job_name = 'test_job_name'
        self.opcda_protocol = 'opcda'
        self.site_name = 'test_site'
        self.area = 'test_area'
        self.process = 'test_process'
        self.machine_name = 'test_machine_name'
        self.opcda_data_tag = 'test_opcda_tag'
        self.opcda_timestamp = '2021-06-03 15:14:21.247000+00:00'
        self.value = 4
        self.hierarchy = {
            'site_name': self.site_name,
            'area': self.area,
            'process': self.process,
            'machine_name': self.machine_name
        }
        self.opcda_payload = {
            'site_name': self.site_name,
            'area': self.area,
            'process': self.process,
            'machine_name': self.machine_name,
            'alias': f'{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{self.opcda_data_tag}',
            'messages': [
                {
                    'name': f'{self.site_name}/{self.area}/{self.process}/{self.machine_name}/{self.opcda_data_tag}',
                    'value': self.value,
                    'quality': 'Good',
                    'timestamp': self.opcda_timestamp
                }
            ]
        }
        self.iot_topic = f'm2c2/{self.job_name}/{self.opcda_data_tag}'

    def test_wrong_params_init_exception(self, mock_endpoint_client, mock_tag_conv, mock_iot_conv, mock_common_conv):
        from targets import IoTTopicTarget
        with self.assertRaises(Exception):
            self.iot_target = IoTTopicTarget(self.job_name, self.opcda_protocol)
    
    def test_no_payload_exception(self, mock_endpoint_client, mock_tag_conv, mock_iot_conv, mock_common_conv):
        from targets import IoTTopicTarget
        self.iot_target = IoTTopicTarget(self.job_name, self.opcda_protocol, self.hierarchy)
        with self.assertRaises(Exception):
            self.iot_target.send_to_iot()
    
    def test_called(self, mock_endpoint_client, mock_tag_conv, mock_iot_conv, mock_common_conv):
        from targets import IoTTopicTarget
        iot_target = IoTTopicTarget(self.job_name, self.opcda_protocol, self.hierarchy)
        assert mock_tag_conv.called
        assert mock_iot_conv.called
        assert mock_common_conv.called
        iot_target.send_to_iot(self.opcda_payload)
        assert iot_target.tag_client.retrieve_tag.called
        assert iot_target.tag_client.retrieve_tag.called_with(self.opcda_payload)
        assert iot_target.converter_client.add_metadata.called
        assert iot_target.topic_client.topic_converter.called
        assert mock_endpoint_client.called
        assert iot_target.connector_client.publish_message_to_iot_topic.called

