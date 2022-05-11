# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import logging
import awsiot.greengrasscoreipc.client as client

from typing import Callable
from awsiot.greengrasscoreipc.model import IoTCoreMessage


class SubscriptionStreamHandler(client.SubscribeToIoTCoreStreamHandler):
    """
    IoT Core stream handler class. This handles message from the MQTT topic from the cloud.

    For more information, refer to
    https://docs.aws.amazon.com/greengrass/v2/developerguide/ipc-iot-core-mqtt.html#ipc-operation-subscribetoiotcore
    """

    def __init__(self, message_handler_callback: Callable[[dict], None]):
        """
        :param message_handler_callback: The callback method when a message comes to the MQTT topic
        """

        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)
        self.message_handler_callback = message_handler_callback

    def on_stream_event(self, event: IoTCoreMessage) -> None:
        """
        Handles the message. Since the message is going to be `bytes`, it converts the message to dict.
        After that, it calls the message callback method with the dict.

        :param event: The event message from the cloud
        """

        message = json.loads(str(event.message.payload, "utf-8"))
        self.message_handler_callback(message)

    def on_stream_error(self, error: Exception) -> bool:
        """
        Handles the stream error.
        Return True to close stream, False to keep the stream open.

        :param error: The error
        """

        self.logger.error(
            f"Error occurred on the subscription stream: {error}"
        )
        return True

    def on_stream_closed(self) -> None:
        """
        Handles close the stream. Basically, it does nothing by default.
        """
        pass
