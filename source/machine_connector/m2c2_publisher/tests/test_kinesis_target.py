# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
import sys
import pytest
from unittest import mock

gg_mock = mock.MagicMock()

sys.modules['greengrasssdk'] = gg_mock
sys.modules['greengrasssdk.stream_manager'] = gg_mock
sys.modules['dbm'] = mock.MagicMock()


def test_kinesis_target_opcda_stream_exists(mocker):
    job_name = 'test_job_name'
    site_name = 'test_site'
    area = 'test_area'
    process = 'test_process'
    machine_name = 'test_machine_name'
    kinesis_sm_stream = 'test_kinesis_greengrass_stream'
    max_stream_size = 46
    kinesis_data_stream = 'test_kinesis_data_stream'
    hierarchy = {
        'site_name': site_name,
        'area': area,
        'process': process,
        'machine_name': machine_name
    }
    opcda_protocol = 'opcda'
    opcda_data_tag = 'Random.Int4'
    opcda_value = 27652.0
    opcda_timestamp = "2021-06-03 15:14:21.247000+00:00"
    orig_opcda_payload = {
        'alias': f'{site_name}/{area}/{process}/{machine_name}/{opcda_data_tag}',
        'messages': [
            {
                'name': f'{site_name}/{area}/{process}/{machine_name}/{opcda_data_tag}',
                'value': opcda_value,
                'quality': 'Good',
                'timestamp': opcda_timestamp
            }
        ]
    }
    opcda_payload = {
        'site_name': site_name,
        'area': area,
        'process': process,
        'machine_name': machine_name,
        'alias': f'{site_name}/{area}/{process}/{machine_name}/{opcda_data_tag}',
        'messages': [
            {
                'name': f'{site_name}/{area}/{process}/{machine_name}/{opcda_data_tag}',
                'value': opcda_value,
                'quality': 'Good',
                'timestamp': opcda_timestamp
            }
        ]
    }
    avail_streams_exists = ['test1stream', kinesis_sm_stream]
    from targets.kinesis_target import KinesisTarget
    client_mock = mocker.MagicMock()
    k_client = KinesisTarget(
        job_name,
        opcda_protocol,
        hierarchy,
        kinesis_sm_stream,
        max_stream_size,
        kinesis_data_stream
    )
    k_client.sm_client = client_mock
    k_client.sm_client.list_streams = mocker.MagicMock(return_value=avail_streams_exists)
    k_client.send_to_kinesis(orig_opcda_payload)
    assert not k_client.sm_client.create_stream.called
    assert k_client.sm_client.write_to_stream.called


def test_kinesis_target_opcua_stream_not_exists(mocker):
    avail_streams_not_exists = ['test1stream']
    job_name = 'test_job_name'
    opcua_protocol = 'opcua'
    site_name = 'test_site'
    area = 'test_area'
    process = 'test_process'
    machine_name = 'test_machine_name'
    opcua_data_tag = '/Realtimedata/TestTag'
    opcua_value = 123.456
    opcua_timestamp = 1622733261247
    hierarchy = {
        'site_name': site_name,
        'area': area,
        'process': process,
        'machine_name': machine_name
    }
    kinesis_sm_stream = 'test_kinesis_greengrass_stream'
    max_stream_size = 46
    kinesis_data_stream = 'test_kinesis_data_stream'
    opcua_payload = {
        'alias': f'{opcua_data_tag}',
        'messages': [
            {
                'name': f'{opcua_data_tag}',
                'value': opcua_value,
                'quality': 'GOOD',
                'timestamp': opcua_timestamp
            }
        ]
    }
    from targets.kinesis_target import KinesisTarget
    k_client = KinesisTarget(
        job_name,
        opcua_protocol,
        hierarchy,
        kinesis_sm_stream,
        max_stream_size,
        kinesis_data_stream
    )
    client_mock = mocker.MagicMock()
    k_client.sm_client = client_mock
    k_client.sm_client.list_streams.return_value = avail_streams_not_exists
    k_client.send_to_kinesis(opcua_payload)
    assert k_client.sm_client.create_stream.called
    assert k_client.sm_client.write_to_stream.called


