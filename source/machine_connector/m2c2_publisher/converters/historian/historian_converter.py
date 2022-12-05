# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import time
from converters.historian.historian_message import HistorianMessage
from boilerplate.logging.logger import get_logger


class HistorianConverter:

    def __init__(self, source_id: str, collector_id: str):
        self.source_id = source_id
        self.collector_id = collector_id

        self.logger = get_logger(self.__class__.__name__)

    def convert_payload(self, payload: dict) -> list:
        self.logger.info(f"Converting payload for historian: {payload}")

        try:
            historian_messages = []
            for message in payload['messages']:

                measurement_id = payload["tag"]
                # historian expects time in epoch form, not using timestamp coming from source
                timestamp = round(time.time() * 1000)
                quality = message['quality']
                value = message['value']

                historian_message = HistorianMessage(self.source_id, self.collector_id,
                                                     measurement_id, timestamp, value, quality)

                historian_message_dict = historian_message.__dict__
                historian_message_dict['@type'] = 'data'

                historian_messages.append(
                    historian_message_dict
                )

            self.logger.info(
                f"Total length of messages converted for historian: {len(historian_messages)}")

            return historian_messages

        except Exception as e:
            self.logger.error(f"Error converting payload: {e}")
            raise e
