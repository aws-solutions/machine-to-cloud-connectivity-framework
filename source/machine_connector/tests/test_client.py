# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import pytest
import sys
from unittest import mock

gg_mock = mock.MagicMock()

sys.modules['greengrasssdk'] = gg_mock
sys.modules['greengrasssdk.stream_manager'] = gg_mock

def test_start_client(mocker):
    connection_name = "test_connection"
    connection_data = {"test_data_key": "test_data_value"}
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.write_local_connection_configuration_file = mocker.MagicMock()
    awse_client.start_client(connection_name=connection_name, connection_configuration=connection_data)
    assert awse_client.write_local_connection_configuration_file.called
    assert awse_client.has_started == True
    assert awse_client.is_running == True

def test_stop_client():
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.stop_client()
    assert awse_client.is_running == False

def test_publish_message_to_iot_topic():
    topic = "test/topic1"
    payload = {"test_payload_key": "test_payload_value"}
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.publish_message_to_iot_topic(topic=topic, payload=payload)
    assert awse_client.iot_client.publish.called
    assert awse_client.iot_client.publish.called_with(topic=topic, qos=1, payload=json.dumps(payload))

def test_publis_message_no_payload():
    topic = "test/topic1"
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    with pytest.raises(Exception):
        awse_client.publish_message_to_iot_topic(topic=topic)

def path_exists_site_effect():
    return True

def test_read_local_connection_configuration(mocker):
    connection_name = "test_connection_name"
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.CONFIGURATION_PATH = "/tmp/test/path"
    expected_file_name = "/tmp/test/path/test_connection_name"
    expected_data = {"test_key1": "test_value1"}
    with mock.patch("builtins.open", new_callable=mock.mock_open(read_data='{"test_key1": "test_value1"}'), return_value='{"test_key1": "test_value1"}') as m_o:
        with mock.patch('json.load', return_value={"test_key1": "test_value1"}) as m_json:
            patcher = mocker.patch('os.path.exists')
            mock_exists = patcher.start()
            mock_exists.side_effect = path_exists_site_effect()
            read_data = awse_client.read_local_connection_configuration(connection_name=connection_name)
    assert m_o.called
    assert read_data == expected_data
    assert m_json.called_with(expected_file_name)

def path_doesnt_exist_site_effect():
    return False

def test_read_local_connection_no_configuration(mocker):
    connection_name = "test_connection_name"
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.CONFIGURATION_PATH = "/tmp/test/path"
    expected_file_name = "/tmp/test/path/test_connection_name"
    expected_data = {}
    with mock.patch("builtins.open", new_callable=mock.mock_open()) as m_o:
        with mock.patch('json.load', return_value={}) as m_json:
            patcher = mocker.patch('os.path.exists')
            mock_exists = patcher.start()
            mock_exists.side_effect = path_doesnt_exist_site_effect()
            read_data = awse_client.read_local_connection_configuration(connection_name=connection_name)
    assert read_data == expected_data

def test_read_local_no_connection_name(mocker):
    connection_name = "test_connection_name"
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.CONFIGURATION_PATH = "/tmp/test/path"
    with mock.patch("builtins.open") as m_o:
        with mock.patch('json.load') as m_json:
            patcher = mocker.patch('os.path.exists')
            mock_exists = patcher.start()
            mock_exists.side_effect = path_exists_site_effect()
            m_json.side_effect = Exception
            with pytest.raises(Exception):
                awse_client.read_local_connection_configuration(connection_name=connection_name)

def test_write_local_connection_configuration_file(mocker):
    connection_name = "test_connection_name"
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.CONFIGURATION_PATH = "/tmp/test/path"
    expected_file_name = "/tmp/test/path/test_connection_name"
    connection_data = {"test_data_key": "test_data_value"}
    with mock.patch("builtins.open", new_callable=mock.mock_open(read_data='{"test_key1": "test_value1"}'), return_value='{"test_key1": "test_value1"}') as m_o:
        with mock.patch('json.dump', return_value={"test_key1": "test_value1"}) as m_json:
            awse_client.write_local_connection_configuration_file(connection_name=connection_name, connection_configuration=connection_data)
    assert m_o.called
    assert m_json.called
    assert m_json.called_with(connection_data, expected_file_name)

def test_write_local_connection_configuration_file_exception(mocker):
    connection_name = "test_connection_name"
    connection_data = None
    from utils.client import AWSEndpointClient
    awse_client = AWSEndpointClient()
    awse_client.CONFIGURATION_PATH = "/tmp/test/path"
    with pytest.raises(Exception):
        awse_client.write_local_connection_configuration_file(connection_name=connection_name,
                                                              connection_configuration=connection_data)