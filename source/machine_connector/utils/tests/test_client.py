# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import pytest
import sys
from unittest import mock
import tempfile

awsiot_mock = mock.MagicMock()
sys.modules["awsiot"] = awsiot_mock
sys.modules["awsiot.greengrasscoreipc"] = awsiot_mock
sys.modules["awsiot.greengrasscoreipc.model"] = awsiot_mock

TEMP_TEST_PATH = tempfile.NamedTemporaryFile().name
BUILT_INS_OPEN = "builtins.open"
TEST_KEY_TEST_VALUE = {"test_key1": "test_value1"}
JSON_LOAD = "json.load"
OS_PATH_EXISTS = "os.path.exists"


def test_start_client(mocker):
    connection_name = "test_connection"
    connection_data = {"test_data_key": "test_data_value"}
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.write_local_connection_configuration_file = mocker.MagicMock()
    aws_endpoint_client.start_client(
        connection_name=connection_name, connection_configuration=connection_data)
    assert aws_endpoint_client.write_local_connection_configuration_file.called
    assert aws_endpoint_client.has_started == True
    assert aws_endpoint_client.is_running == True


def test_stop_client():
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.stop_client()
    assert aws_endpoint_client.is_running == False


def test_publish_message_to_iot_topic():
    topic = "test/topic1"
    payload = {"test_payload_key": "test_payload_value"}
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.publish_message_to_iot_topic(
        topic=topic, payload=payload)
    assert aws_endpoint_client.ipc_client.new_publish_to_iot_core.called


def test_publis_message_no_payload():
    topic = "test/topic1"
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    with pytest.raises(Exception):
        aws_endpoint_client.publish_message_to_iot_topic(topic=topic)


def path_exists_site_effect():
    return True


def test_read_local_connection_configuration(mocker):
    connection_name = "test_connection_name"
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.CONFIGURATION_PATH = TEMP_TEST_PATH
    expected_file_name = f"{TEMP_TEST_PATH}/test_connection_name"
    expected_data = TEST_KEY_TEST_VALUE
    with mock.patch(BUILT_INS_OPEN, new_callable=mock.mock_open(read_data=json.dumps(TEST_KEY_TEST_VALUE)), return_value=json.dumps(TEST_KEY_TEST_VALUE)) as m_o:
        with mock.patch(JSON_LOAD, return_value=TEST_KEY_TEST_VALUE) as m_json:
            patcher = mocker.patch(OS_PATH_EXISTS)
            mock_exists = patcher.start()
            mock_exists.side_effect = path_exists_site_effect()
            read_data = aws_endpoint_client.read_local_connection_configuration(
                connection_name=connection_name)
    assert m_o.called
    assert read_data == expected_data
    assert m_json.called_with(expected_file_name)


def path_does_not_exist_site_effect():
    return False


def test_read_local_connection_no_configuration(mocker):
    connection_name = "test_connection_name"
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.CONFIGURATION_PATH = TEMP_TEST_PATH
    expected_data = {}
    with mock.patch(BUILT_INS_OPEN, new_callable=mock.mock_open()):
        with mock.patch(JSON_LOAD, return_value={}):
            patcher = mocker.patch(OS_PATH_EXISTS)
            mock_exists = patcher.start()
            mock_exists.side_effect = path_does_not_exist_site_effect()
            read_data = aws_endpoint_client.read_local_connection_configuration(
                connection_name=connection_name)
    assert read_data == expected_data


def test_read_local_no_connection_name(mocker):
    connection_name = "test_connection_name"
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.CONFIGURATION_PATH = TEMP_TEST_PATH
    with mock.patch(BUILT_INS_OPEN):
        with mock.patch(JSON_LOAD) as m_json:
            patcher = mocker.patch(OS_PATH_EXISTS)
            mock_exists = patcher.start()
            mock_exists.side_effect = path_exists_site_effect()
            m_json.side_effect = Exception
            with pytest.raises(Exception):
                aws_endpoint_client.read_local_connection_configuration(
                    connection_name=connection_name)


def test_write_local_connection_configuration_file():
    connection_name = "test_connection_name"
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.CONFIGURATION_PATH = TEMP_TEST_PATH
    expected_file_name = f"{TEMP_TEST_PATH}/test_connection_name"
    connection_data = {"test_data_key": "test_data_value"}
    with mock.patch(BUILT_INS_OPEN, new_callable=mock.mock_open(read_data=json.dumps(TEST_KEY_TEST_VALUE)), return_value=json.dumps(TEST_KEY_TEST_VALUE)) as m_o:
        with mock.patch('json.dump', return_value=TEST_KEY_TEST_VALUE) as m_json:
            aws_endpoint_client.write_local_connection_configuration_file(
                connection_name=connection_name, connection_configuration=connection_data)
    assert m_o.called
    assert m_json.called
    assert m_json.called_with(connection_data, expected_file_name)


def test_write_local_connection_configuration_file_exception():
    connection_name = "test_connection_name"
    connection_data = None
    from client import AWSEndpointClient
    aws_endpoint_client = AWSEndpointClient()
    aws_endpoint_client.CONFIGURATION_PATH = TEMP_TEST_PATH
    with pytest.raises(Exception):
        aws_endpoint_client.write_local_connection_configuration_file(connection_name=connection_name,
                                                                      connection_configuration=connection_data)
