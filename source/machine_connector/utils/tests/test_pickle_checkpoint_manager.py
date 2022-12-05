# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import datetime
import logging
from unittest import mock, TestCase
from ..pickle_checkpoint_manager import PickleCheckpointManager


class TestPickleCheckpointManager(TestCase):

    # def retrieve_checkpoints(self, stream_name: str):

    # def write_checkpoints(self, stream_name: str, checkpoint: str, value: int) -> None:

    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_init(self, mock_file):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'

        # Act
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Assert
        mock_file.assert_called_with(test_streammanager_filename, 'wb+')

    @mock.patch("os.path.getsize", return_value=1)
    @mock.patch("pickle.load", return_value={})
    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_retrieve_checkpoints_empty(self, mock_file, mock_pickle, mock_os_getsize):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Act
        checkpoints = pcm.retrieve_checkpoints('test-stream-name')

        # Assert
        assert checkpoints == (None, None)
        assert mock_file.call_count == 2

    @mock.patch("os.path.getsize", return_value=0)
    @mock.patch("pickle.load", return_value={})
    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_retrieve_checkpoints_empty_file(self, mock_file, mock_pickle, mock_os_getsize):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Act
        checkpoints = pcm.retrieve_checkpoints('test-stream-name')

        # Assert
        assert checkpoints == (None, None)
        assert mock_file.call_count == 1  # once for constructor

    @mock.patch("os.path.getsize", return_value=1)
    @mock.patch("pickle.load", return_value={'test-stream-name': {'trailing': 1, 'primary': 2}})
    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_retrieve_checkpoints_empty_file(self, mock_file, mock_pickle, mock_os_getsize):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Act
        checkpoints = pcm.retrieve_checkpoints('test-stream-name')

        # Assert
        assert checkpoints == (1, 2)
        assert mock_file.call_count == 2

    @mock.patch("pickle.dump", return_value=None)
    @mock.patch("os.path.getsize", return_value=0)
    @mock.patch("pickle.load", return_value={})
    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_write_checkpoints(self, mock_file, mock_pickle, mock_os_getsize, mock_pickle_dump):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Act
        pcm.write_checkpoints('test-stream-name', 'trailing', 1)

        # Assert
        assert mock_file.call_count == 2
        mock_pickle_dump.assert_called_with(
            {'test-stream-name': {'trailing': 1}}, mock.ANY)

    @mock.patch("pickle.dump", return_value=None)
    @mock.patch("os.path.getsize", return_value=1)
    @mock.patch("pickle.load", return_value={'test-stream-name': {'trailing': 0}})
    @mock.patch("builtins.open", new_callable=mock.mock_open, read_data="data")
    def test_write_checkpoints(self, mock_file, mock_pickle, mock_os_getsize, mock_pickle_dump):
        # Arrange
        test_streammanager_filename = 'test-stream-checkpoints'
        pcm = PickleCheckpointManager(test_streammanager_filename)

        # Act
        pcm.write_checkpoints('test-stream-name', 'trailing', 1)

        # Assert
        assert mock_file.call_count == 3
        mock_pickle_dump.assert_called_with(
            {'test-stream-name': {'trailing': 1}}, mock.ANY)
