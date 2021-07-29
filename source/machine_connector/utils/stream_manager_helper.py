# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
import asyncio
import json
import logging

import backoff

from greengrasssdk.stream_manager import (
    ConnectFailedException,
    ExportDefinition,
    InvalidRequestException,
    MessageStreamDefinition,
    NotEnoughMessagesException,
    Persistence,
    ReadMessagesOptions,
    StrategyOnFull,
    StreamManagerClient,
    StreamManagerException
)


class StreamManagerHelperClient:
    """
    Contains helper functions to create, read, and write from Greengrass Stream Manager
    """
    @backoff.on_exception(backoff.expo,
                          (StreamManagerException,
                           ConnectFailedException,
                           asyncio.TimeoutError),
                          max_tries=10)
    def __init__(self):
        # Logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)
        try:
            self.client = StreamManagerClient()
        except Exception as err:
            self.logger.error("Unable to connect to Stream Manager. Error: %s", str(err))
            self.stream_manager_client = None

    def list_streams(self):
        try:
            existing_streams = self.client.list_streams()
            return(existing_streams)
        except Exception as err:
            self.logger.error("There was an error listing Greengrass streams: %s", str(err))
            raise

    def create_stream(self, stream_name: str, max_stream_size: int, exports: ExportDefinition):
        self.logger.info("Creating stream {}".format(stream_name))
        try:
            self.client.create_message_stream(MessageStreamDefinition(
                name=stream_name,
                max_size=max_stream_size,
                strategy_on_full=StrategyOnFull.OverwriteOldestData,
                persistence=Persistence.File,
                export_definition=exports
                ))
        except InvalidRequestException:
            # One centralized stream manager is going to be used to send data to Kinesis Data Stream,
            # so `InvalidRequestException` will happens when new connection is deployed.
            pass
        except Exception as err:
            self.error_msg = "Unknown error happened, so your Stream Manager might not be working: {}".format(str(err))
            self.logger.error(self.error_msg)
            raise

    @backoff.on_exception(backoff.expo,
                          NotEnoughMessagesException)
    def read_from_stream(self, stream_name: str, sequence: int, read_msg_number: int):
        """
        This gets the values from the stream
        """
        try:
            self.msg = self.client.read_messages(stream_name,
                                                 ReadMessagesOptions(
                                                  desired_start_sequence_number=sequence,
                                                  min_message_count=read_msg_number
                                                 )
                                                 )
            self.logger.info("Message read from stream: {}".format(self.msg))
            return(self.msg)
        except NotEnoughMessagesException as err:
            self.logger.info("Encountered an error when reading from stream {}: {}".format(stream_name, err))
            self.msg = []
            if "greater than the last sequence number" in err.message:
                self.logger.info("Trying to read sequence number {}. Current last sequence number in stream is {}".format(
                    sequence,
                    self.get_latest_sequence_number(stream_name)))
            return(self.msg)
        except Exception as err:
            # TODO: Retry reading
            self.error_msg = "Encountered an error when trying to read from stream {}: {}".format(err, stream_name)
            self.logger.error(self.error_msg)
            raise


    def write_to_stream(self, stream_name: str, data: dict):
        try:
            self.client.append_message(
                stream_name=stream_name,
                data=json.dumps(data).encode('utf-8')
            )
            return
        except Exception as err:
            self.error_msg = "Encountered an error when writing to stream {}: {}".format(stream_name, err)
            self.logger.error(self.error_msg)
            raise Exception(self.error_msg) from err

    def get_oldest_sequence_number(self, stream_name: str):
        try:
            self.oldest_seq_num = self.client.describe_message_stream(stream_name).storage_status.oldest_sequence_number
            return(self.oldest_seq_num)
        except Exception as err:
            self.error_msg = "Encountered an error when reading oldest sequence number from stream {}: {}".format(stream_name, err)
            self.logger.error(self.error_msg)
            raise Exception(self.error_msg) from err

    def get_latest_sequence_number(self, stream_name: str):
        try:
            self.newest_seq_num = self.client.describe_message_stream(stream_name).storage_status.newest_sequence_number
            return(self.newest_seq_num)
        except Exception as err:
            self.error_msg = "Encountered an error when reading newest sequence number from stream {}: {}".format(stream_name, err)
            self.logger.error(self.error_msg)
            raise Exception(self.error_msg) from err

