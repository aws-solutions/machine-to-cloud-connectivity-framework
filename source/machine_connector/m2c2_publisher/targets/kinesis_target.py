# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from greengrasssdk.stream_manager import (
    ExportDefinition,
    KinesisConfig
)

from converters import common_converter, sitewise_converter, tag_converter, timestream_converter
from utils.stream_manager_helper import StreamManagerHelperClient
from utils.custom_exception import ConverterException


class KinesisTarget:
    def __init__(self, connection_name: str, protocol: str, hierarchy: dict, kinesis_sm_stream: str, max_stream_size: int, kinesis_data_stream: str, is_timestream_kinesis: bool = False):
        self.connection_name = connection_name
        self.protocol = protocol
        self.hierarchy = hierarchy
        self.kinesis_sm_stream = kinesis_sm_stream
        self.max_stream_size = max_stream_size
        self.kinesis_data_stream = kinesis_data_stream
        self.tag_client = tag_converter.TagConverter(self.protocol)
        self.converter_client = common_converter.CommonConverter(
            self.hierarchy)
        self.sm_client = StreamManagerHelperClient()
        self.sitewise_converter = sitewise_converter.SiteWiseConverter()
        self.timestream_converter = timestream_converter.TimestreamConverter()
        self.is_timestream_kinesis = is_timestream_kinesis

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def send_to_kinesis(self, payload):
        try:
            self.payload = payload

            if self.protocol == "opcua":
                self.payload = self.sitewise_converter.convert_sitewise_format(
                    payload
                )

            self.tag = self.tag_client.retrieve_tag(
                self.payload
            )
            self.updated_payload = self.converter_client.add_metadata(
                self.payload,
                self.tag
            )

            if self.is_timestream_kinesis:
                kinesis_records = self.timestream_converter.convert_timestream_format(
                    self.updated_payload
                )

                for record in kinesis_records:
                    self.write_to_stream(record, 10)
            else:
                self.write_to_stream(self.updated_payload)
        except ConverterException as err:
            raise err
        except Exception as err:
            self.logger.error("Connection failed. Error: %s", str(err))
            raise ConnectionError(err)

    def write_to_stream(self, payload: dict, batch_size=1):
        avail_streams = self.sm_client.list_streams()

        if self.kinesis_sm_stream not in avail_streams:
            exports = ExportDefinition(
                kinesis=[
                    KinesisConfig(
                        identifier="KinesisExport",
                        kinesis_stream_name=self.kinesis_data_stream,
                        batch_size=batch_size
                    )
                ]
            )
            self.sm_client.create_stream(
                self.kinesis_sm_stream,
                self.max_stream_size,
                exports
            )

        self.sm_client.write_to_stream(
            self.kinesis_sm_stream, payload
        )
