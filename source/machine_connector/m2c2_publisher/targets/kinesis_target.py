import logging

from greengrasssdk.stream_manager import (
    ExportDefinition,
    KinesisConfig
)

from converters import common_converter, tag_converter
from utils.stream_manager_helper import StreamManagerHelperClient


class KinesisTarget:

    def __init__(self, connection_name: str, protocol: str, hierarchy: dict, kinesis_sm_stream: str, max_stream_size: str, kinesis_data_stream: str):
        self.connection_name = connection_name
        self.protocol = protocol
        self.hierarchy = hierarchy
        self.kinesis_sm_stream = kinesis_sm_stream
        self.max_stream_size = max_stream_size
        self.kinesis_data_stream = kinesis_data_stream
        self.tag_client = tag_converter.TagConverter(self.protocol)
        self.converter_client = common_converter.CommonConverter(self.hierarchy)
        self.sm_client = StreamManagerHelperClient()
        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)

    def send_to_kinesis(self, payload):
        try:
            self.payload = payload
            self.tag = self.tag_client.retrieve_tag(
                self.payload
            )
            self.updated_payload = self.converter_client.add_metadata(
                self.payload,
                self.tag
            )

            self.avail_streams = self.sm_client.list_streams()
            if self.kinesis_sm_stream not in self.avail_streams:
                self.exports = ExportDefinition(
                    kinesis=[
                        KinesisConfig(
                            identifier="KinesisExport",
                            kinesis_stream_name=self.kinesis_data_stream,
                            batch_size=1
                        )
                    ]
                )
                self.sm_client.create_stream(
                    self.kinesis_sm_stream,
                    self.max_stream_size,
                    self.exports
                )
            self.sm_client.write_to_stream(self.kinesis_sm_stream, self.updated_payload)

        except Exception as err:
            self.logger.error("Connection failed. Error: %s", str(err))
            raise ConnectionError(err)
