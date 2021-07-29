import logging
from converters import common_converter, tag_converter, iot_topic_converter
from utils import AWSEndpointClient


class IoTTopicTarget:

    def __init__(self, connection_name: str, protocol: str, hierarchy: dict):
        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)
        self.connection_name = connection_name
        self.protocol = protocol
        self.hierarchy = hierarchy
        self.tag_client = tag_converter.TagConverter(self.protocol)
        self.converter_client = common_converter.CommonConverter(self.hierarchy)
        self.topic_client = iot_topic_converter.IoTTopicConverter(self.connection_name, self.protocol)

    def send_to_iot(self, payload: dict):
        try:
            self.tag = self.tag_client.retrieve_tag(
                payload
            )
            self.updated_payload = self.converter_client.add_metadata(
                payload,
                self.tag
            )
            self.topic = self.topic_client.topic_converter(self.updated_payload)
            self.connector_client = AWSEndpointClient()
            self.connector_client.publish_message_to_iot_topic(
                self.topic,
                self.updated_payload
            )

        except Exception as err:
            self.logger.error(
                "Failed to publish telemetry data to the IoT topic. Error: %s",
                str(err)
            )
