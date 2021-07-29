import logging


class IoTTopicConverter:

    def __init__(self, connection_name: str, protocol: str):
        self.connection_name = connection_name
        self.protocol = protocol

        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)

    def topic_converter(self, payload):
        try:
            iot_topic = "m2c2/data/{connection_name}/{machine_name}/{tag}".format(
                connection_name=self.connection_name,
                **payload
            )
            return iot_topic
        except Exception as err:
            error_msg = "There was an error when trying to create the IoT topic: '{}'".format(
                err
            )
            self.logger.error(error_msg)
            raise Exception(error_msg)
