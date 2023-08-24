# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from greengrasssdk.stream_manager import (
    ExportDefinition,
    KinesisConfig
)
from boilerplate.logging.logger import get_logger
from converters import common_converter, sitewise_converter, tag_converter
from converters.historian.historian_converter import HistorianConverter
from utils.stream_manager_helper import StreamManagerHelperClient
from utils.custom_exception import ConverterException


class HistorianTarget:
    def __init__(self, connection_name: str, protocol: str, hierarchy: dict,
                 historian_sm_stream: str, max_stream_size: int, historian_data_stream: str,
                 collector_id: str):
        self.connection_name = connection_name
        self.protocol = protocol
        self.hierarchy = hierarchy
        self.historian_sm_stream = historian_sm_stream
        self.max_stream_size = max_stream_size
        self.historian_data_stream = historian_data_stream
        self.tag_client = tag_converter.TagConverter(self.protocol)
        self.converter_client = common_converter.CommonConverter(
            self.hierarchy)
        self.sm_client = StreamManagerHelperClient()
        self.sitewise_converter = sitewise_converter.SiteWiseConverter()
        self.historian_converter = HistorianConverter(
            source_id=connection_name, collector_id=collector_id)

        self.logger = get_logger(self.__class__.__name__)

    def send_to_kinesis(self, payload):
        try:

            if self.protocol == "opcua":
                payload = self.sitewise_converter.convert_sitewise_format(
                    payload
                )

            tag = self.tag_client.retrieve_tag(
                payload
            )
            updated_payload = self.converter_client.add_metadata(
                payload,
                tag
            )

            converted_historian_payload = self.historian_converter.convert_payload(
                updated_payload)

            self.write_to_stream(converted_historian_payload)
        except ConverterException as err:
            raise err
        except Exception as err:
            self.logger.error(
                "Connection failed during historian message writing. Error: %s", str(err))
            raise ConnectionError(err)

    def write_to_stream(self, payload: list, batch_size=1):
        avail_streams = self.sm_client.list_streams()

        if self.historian_sm_stream not in avail_streams:
            self.logger.info(
                f"Creating historian stream: {self.historian_sm_stream}")
            exports = ExportDefinition(
                kinesis=[
                    KinesisConfig(
                        identifier=f"KinesisExport-{self.connection_name}",
                        kinesis_stream_name=self.historian_data_stream,
                        batch_size=batch_size
                    )
                ]
            )
            self.sm_client.create_stream(
                self.historian_sm_stream,
                self.max_stream_size,
                exports
            )

        # Historian doesn't support writing lists yet
        for item in payload:
            self.logger.debug(f"Writing to stream")
            self.sm_client.write_to_stream(
                self.historian_sm_stream, item
            )
