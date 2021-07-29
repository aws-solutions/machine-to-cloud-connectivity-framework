# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
from dbm import gnu as gdb
import json
import logging


class CheckpointManager:
    def __init__(self, checkpoint_db):
        self.checkpoint_db = checkpoint_db

        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)

    def read_checkpoint_db(self, stream_name: str) -> dict:
        try:
            with gdb.open(self.checkpoint_db, 'c') as db:
                self.checkpoint_entry = json.loads(db[stream_name])
            return self.checkpoint_entry
        except KeyError:
            self.logger.info("Checkpoints for stream {} don't exist".format(stream_name))
            self.checkpoint_entry = {}
            return self.checkpoint_entry
        except Exception as err:
            self.logger.error("Unable to access the checkpoint entry, {}".format(err))
            raise

    def write_checkpoint_db(self, stream_name: str, checkpoint_type: str, sequence: int) -> None:
        try:
            with gdb.open(self.checkpoint_db, 'c') as db:
                try:
                    self.checkpoint_entry = json.loads(db[stream_name])
                except KeyError:
                    self.checkpoint_entry = {}
                finally:
                    self.checkpoint_entry[checkpoint_type] = sequence
                    self.b_entry = json.dumps(self.checkpoint_entry).encode('utf-8')
                    db[stream_name] = self.b_entry
        except Exception as err:
            self.logger.error("Unable to write {0} to {1}".format(err, self.checkpoint_db))
            raise

    def retrieve_checkpoints(self, stream_name: str):
        # Gets the latest checkpoints from the on-disk data store
        # If this is a new connection, there will be no checkpoints, return None
        try:
            self.checkpoints = self.read_checkpoint_db(stream_name)
            self.trailing_cp = self.checkpoints.get("trailing")
            self.primary_cp = self.checkpoints.get("primary")
            return self.trailing_cp, self.primary_cp
        except Exception as err:
            self.logger.error("There was an issue retrieving checkpoints for stream {}: {}".format(stream_name, err))
            raise

    def write_checkpoints(self, stream_name: str, checkpoint: str, value: int) -> None:
        try:
            self.write_checkpoint_db(stream_name, checkpoint, value)
        except Exception as err:
            self.logger.error("There was an issue writing the checkpoint {} of value {} for stream {}: {}".format(checkpoint, value, stream_name, err))
            raise
