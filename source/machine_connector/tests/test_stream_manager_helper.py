# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import pytest
import sys
from unittest import mock

gg_mock = mock.MagicMock()

sys.modules['greengrasssdk'] = gg_mock
sys.modules['greengrasssdk.stream_manager'] = gg_mock

def test_list_streams(mocker):
    dbm = mocker.MagicMock()
    gdb = mocker.patch.object(dbm, "gnu")
    from utils import StreamManagerHelperClient
    sm_client = StreamManagerHelperClient()
    expected_streams = ['test_streams']
    sm_client.client.list_streams.return_value = ['test_streams']
    returned_streams = sm_client.list_streams()
    assert returned_streams == expected_streams
    assert sm_client.client.list_streams.called


class ExportDefinition:
    KinesisConfig = mock.MagicMock()
    kinesis = [
        KinesisConfig(
            identifier="KinesisExport",
            kinesis_stream_name="test_kinesis_data_Stream",
            batch_size=1
        )
    ]


def test_create_stream(mocker):
    stream_name = "test_gg_stream"
    max_stream_size = 1234
    StrategyOnFull = mocker.MagicMock()
    mocker.patch.object(StrategyOnFull, "OverwriteOldestData")
    Persistence = mocker.MagicMock()
    mocker.patch.object(Persistence, "File")
    exports = ExportDefinition()
    StreamManagerClient = mocker.MagicMock(autospec=True)
    from utils import StreamManagerHelperClient
    sm_client = StreamManagerHelperClient()
    sm_client.create_stream(stream_name, max_stream_size, exports)
    assert sm_client.client.create_message_stream.called

def test_create_stream_no_export(mocker):
    stream_name = "test_gg_stream"
    max_stream_size = ''
    StrategyOnFull = mocker.MagicMock()
    mocker.patch.object(StrategyOnFull, "OverwriteOldestData")
    Persistence = mocker.MagicMock()
    mocker.patch.object(Persistence, "File")
    from utils import StreamManagerHelperClient
    sm_client = StreamManagerHelperClient()
    with pytest.raises(Exception):
        sm_client.create_stream()


class Message:
   stream_name = "test_gg_stream",
   sequence_number = 12345,
   payload = b'{"test_key_entry": "test_value_entry"}'


def test_read_from_stream(mocker):
    stream_name = "test_gg_stream"
    sequence = 12345
    read_msg_number = 1
    expected_response = Message()
    from utils import StreamManagerHelperClient
    sm_client = StreamManagerHelperClient()
    mock_read = mocker.patch.object(sm_client, "read_from_stream", return_value=Message())
    mock_read_response = mock_read(stream_name, sequence, read_msg_number)
    assert mock_read_response.payload == expected_response.payload
    assert mock_read_response.sequence_number == expected_response.sequence_number
    assert mock_read_response.stream_name == expected_response.stream_name

class NotEnoughMessagesException:
    message = "desired starting sequence number is greater than the last sequence number of the stream"
    pass


def test_read_from_stream_notenoughmessages(mocker):
    stream_name = "test_gg_stream"
    sequence = 12345
    read_msg_number = 1
    expected_response = []
    from utils import StreamManagerHelperClient
    sm_client = StreamManagerHelperClient()
    with mocker.patch.object(sm_client, "read_from_stream", side_effect=NotEnoughMessagesException):
        with pytest.raises(Exception) as excinfo:
            response = sm_client.read_from_stream(stream_name=stream_name, sequence=sequence, read_msg_number=read_msg_number)
            assert response == expected_response
        assert 'NotEnoughMessagesException' in str(excinfo)

def test_write_to_stream(mocker):
    stream_name = "test_gg_stream"
    data = {"test_key": "test-value"}
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    test_sm_client.write_to_stream(stream_name=stream_name, data=data)
    assert test_sm_client.client.append_message.called

def test_bad_data(mocker):
    stream_name = "test_gg_stream"
    data = b''
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    with pytest.raises(Exception):
        test_sm_client.write_to_stream(stream_name=stream_name, data=data)

def test_get_oldest_sequence_number(mocker):
    stream_name = "test_gg_stream"
    data = {"test_key": "test-value"}
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    test_sm_client.get_oldest_sequence_number(stream_name=stream_name)
    assert test_sm_client.client.describe_message_stream.called

def test_get_oldest_sequence_number_no_stream(mocker):
    data = {"test_key": "test-value"}
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    with pytest.raises(Exception):
        test_sm_client.get_oldest_sequence_number()

def test_get_last_sequence_number(mocker):
    stream_name = "test_gg_stream"
    data = {"test_key": "test-value"}
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    test_sm_client.get_latest_sequence_number(stream_name=stream_name)
    assert test_sm_client.client.describe_message_stream.called

def test_get_last_sequence_number_no_stream(mocker):
    data = {"test_key": "test-value"}
    from utils import StreamManagerHelperClient
    test_sm_client = StreamManagerHelperClient()
    with pytest.raises(Exception):
        test_sm_client.get_latest_sequence_number()

