from dateutil import parser
import logging


class SiteWiseConverter:

    def __int__(self):
        # Logging
        self.logger = logging.getLogger()
        self.logger.setLevel(logging.INFO)

    def sw_required_format(self, payload):
        try:
            for message in payload['messages']:
                self.dt_obj = parser.parse(message['timestamp'])
                message['timestamp'] = round(self.dt_obj.timestamp() * 1000)
                message['quality'] = str(message['quality']).upper()
            return(payload)
        except Exception as err:
            err_msg = "There was an issue converting the payload to SiteWise format: {}".format(err)
            self.logger.error(err_msg)
            raise Exception(err_msg)
