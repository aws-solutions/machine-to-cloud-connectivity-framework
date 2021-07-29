import logging

from converters.sitewise_converter import SiteWiseConverter
from utils.stream_manager_helper import StreamManagerHelperClient


class SiteWiseTarget:

    def __init__(self, protocol: str, sitewise_stream: str):
        self.protocol = protocol
        self.sitewise_stream = sitewise_stream
        self.sitewise_converter = SiteWiseConverter()
        self.sm_helper_client = StreamManagerHelperClient()
        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)

    def send_to_sitewise(self, payload: dict):
        try:
            self.payload = payload
            if self.protocol != 'opcua':
                self.payload = self.sitewise_converter.sw_required_format(self.payload)
            self.sm_helper_client.write_to_stream(self.sitewise_stream, self.payload)
        except Exception as err:
            self.logger.error("Error raised when writing to SiteWise: {}".format(err))
            raise
