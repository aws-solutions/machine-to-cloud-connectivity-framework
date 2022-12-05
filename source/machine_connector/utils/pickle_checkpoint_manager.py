# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import os
import pickle

"""
    This is a version of the checkpoint manager that is platform agnostic. It stores the sequence number of the
    respective Greengrass streams for pickup in case of restart or fall behind. Sequence numbers are
    stored like so:
    {
        "stream_name": {
            "checkpoint_type": sequence(1)
        }
    }

    Returns:
        _type_: _description_
"""


class PickleCheckpointManager:
    def __init__(self, checkpoint_file):
        self.checkpoint_file = checkpoint_file
        self._init_checkpoint_file()

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def _init_checkpoint_file(self):
        if not os.path.isfile(self.checkpoint_file):
            open(self.checkpoint_file, 'wb+').close()

    def _read_checkpoints(self) -> dict:
        all_checkpoints = {}
        if os.path.getsize(self.checkpoint_file) > 0:
            with open(self.checkpoint_file, 'rb') as file:
                all_checkpoints = pickle.load(file)  # nosec B301
        else:
            self.logger.warn('No checkpoints found during read')
        return all_checkpoints

    def read_checkpoint_db(self, stream_name: str) -> dict:
        try:
            all_checkpoints = self._read_checkpoints()
            return all_checkpoints[stream_name]
        except KeyError:
            self.logger.info(
                "Checkpoints for stream {} don't exist".format(stream_name))
            return {}
        except Exception as err:
            self.logger.error(
                "Unable to access the checkpoint entry, {}".format(err))
            raise

    def write_checkpoint_db(self, stream_name: str, checkpoint_type: str, sequence: int) -> None:
        try:
            all_checkpoints = self._read_checkpoints()
            if stream_name in all_checkpoints:
                if checkpoint_type in all_checkpoints[stream_name]:
                    all_checkpoints[stream_name][checkpoint_type] = sequence
                else:
                    all_checkpoints[stream_name] = {
                        checkpoint_type: sequence
                    }
            else:
                all_checkpoints[stream_name] = {
                    checkpoint_type: sequence
                }
            with open(self.checkpoint_file, 'wb') as write_file:
                pickle.dump(all_checkpoints, write_file)
        except Exception as err:
            self.logger.error("Unable to write {0} to {1}".format(
                err, self.checkpoint_file))
            raise

    def retrieve_checkpoints(self, stream_name: str):
        # Gets the latest checkpoints from the on-disk data store
        # If this is a new connection, there will be no checkpoints, return None
        try:
            checkpoints = self.read_checkpoint_db(stream_name)
            trailing_cp = checkpoints.get("trailing")
            primary_cp = checkpoints.get("primary")
            return trailing_cp, primary_cp
        except Exception as err:
            self.logger.error(
                "There was an issue retrieving checkpoints for stream {}: {}".format(stream_name, err))
            raise

    def write_checkpoints(self, stream_name: str, checkpoint: str, value: int) -> None:
        try:
            self.write_checkpoint_db(stream_name, checkpoint, value)
        except Exception as err:
            self.logger.error("There was an issue writing the checkpoint {} of value {} for stream {}: {}".format(
                checkpoint, value, stream_name, err))
            raise
