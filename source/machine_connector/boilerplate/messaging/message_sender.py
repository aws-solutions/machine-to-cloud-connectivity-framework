# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from inspect import trace
import os
import traceback
from greengrasssdk.stream_manager import ExportDefinition

from utils import StreamManagerHelperClient, AWSEndpointClient, InitMessage
from boilerplate.messaging.message_batch import MessageBatch
import boilerplate.messaging.announcements as announcements
import boilerplate.logging.logger as ConnectorLogging


class MessageSender:

    def __init__(self):
        self._smh_client = StreamManagerHelperClient()
        self._connector_client = AWSEndpointClient()
        self.logger = ConnectorLogging.get_logger(self.__class__.__name__)

        self.MAX_STREAM_SIZE = 5368706371  # 5G
        self.CONNECTION_GG_STREAM_NAME = os.getenv("CONNECTION_GG_STREAM_NAME")

        self.CONNECTION_NAME = os.getenv("CONNECTION_NAME")
        # Site name from component environment variables
        self.SITE_NAME = os.getenv("SITE_NAME")
        # Area from component environment variables
        self.AREA = os.getenv("AREA")
        # Process from component environment variables
        self.PROCESS = os.getenv("PROCESS")
        # Machine name from component environment variables
        self.MACHINE_NAME = os.getenv("MACHINE_NAME")

    def post_message_batch(self, message_batch: MessageBatch) -> None:
        try:
            avail_streams = self._smh_client.list_streams()

            if self.CONNECTION_GG_STREAM_NAME not in avail_streams:
                self.logger.info(
                    f"Stream {self.CONNECTION_GG_STREAM_NAME} not found, attempting to create it."
                )
                gg_exports = ExportDefinition()
                self._smh_client.create_stream(
                    self.CONNECTION_GG_STREAM_NAME, self.MAX_STREAM_SIZE, gg_exports
                )

            self._smh_client.write_to_stream(
                self.CONNECTION_GG_STREAM_NAME, message_batch.__dict__)

        except Exception as err:
            self.logger.error(traceback.format_exc())
            self.logger.error(
                f"Failed to publish message to Stream Manager. Error: {err}"
            )

    def post_info_message(self, message: str) -> None:
        try:
            post_type = "info"
            format_map = self._form_map()
            topic = "m2c2/{post_type}/{name}".format(
                **format_map, post_type=post_type
            )
            user_message = self._generate_non_data_message(message)
            self._connector_client.publish_message_to_iot_topic(
                topic, user_message)
        except Exception as err:
            self.logger.error(
                f"Failed to publish message to IoT topic. Error: {err}"
            )
            raise err

    def post_error_message(self, message: str) -> None:
        try:
            post_type = "error"
            format_map = self._form_map()
            topic = "m2c2/{post_type}/{name}".format(
                **format_map, post_type=post_type
            )
            user_message = self._generate_non_data_message(message)
            self._connector_client.publish_message_to_iot_topic(
                topic, user_message)
        except Exception as err:
            self.logger.error(
                f"Failed to publish message to IoT topic. Error: {err}"
            )
            raise err

    def _form_map(self) -> dict:
        return {
            "name": self.CONNECTION_NAME,
            "site_name": self.SITE_NAME,
            "area": self.AREA,
            "process": self.PROCESS,
            "machine_name": self.MACHINE_NAME
        }

    def _generate_non_data_message(self, message: str) -> dict:
        init_message = InitMessage()
        user_message = init_message.init_user_message()
        user_message["message"] = message
        return user_message
