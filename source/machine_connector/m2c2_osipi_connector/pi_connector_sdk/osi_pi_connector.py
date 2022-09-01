# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from .pi_response import PiResponse
from .pi_connection_config import PiConnectionConfig
from osisoft.pidevclub.piwebapi.models.pi_point import PIPoint
from osisoft.pidevclub.piwebapi.api.data_api import DataApi
from osisoft.pidevclub.piwebapi.pi_web_api_client import PIWebApiClient
from . import constants as Constants
import traceback
import logging
import requests
from .time_helper import TimeHelper

requests.packages.urllib3.disable_warnings()


class OsiPiConnector:
    def __init__(self, pi_config: PiConnectionConfig):

        self.logger = logging.getLogger()

        self.time_helper = TimeHelper(pi_config.time_log_file)

        self.connection_config = pi_config

        self.connection_name = 'osipi'  # TODO: Cleanup

        use_kerberos = False
        if pi_config.server_connection.auth_mode == 'KERBEROS':
            use_kerberos = True

        self.client = PIWebApiClient(
            pi_config.server_connection.api_url,
            useKerberos=use_kerberos,
            username=pi_config.server_connection.auth_param.username,
            password=pi_config.server_connection.auth_param.password,
            verifySsl=pi_config.server_connection.verify_ssl
        )

    def get_web_ids_for_tag_names(self, tag_names):

        web_ids = []

        server_name = self.connection_config.server_connection.server_name

        try:
            for tag_name in tag_names:
                web_ids.append(self.client.point.get_by_path(
                    f"\\\\{server_name}\\{tag_name}").web_id)
        except Exception as err:
            self.logger.error(
                "Failed to derive WebIds for tags..." + str(traceback.format_exc()))

            raise err

        return web_ids

    def get_point_metadata(self, web_id) -> PIPoint:

        data = self.client.point.get(web_id=web_id)

        return data

    def get_points_metadata(self, web_ids) -> 'list[PIPoint]':

        data = self.client.point.get_multiple(web_id=web_ids)

        results = []

        for result in data.items:
            obj = result.object
            point_info = {
                'name': obj.name,
                'path': obj.path,
                'pointClass': obj.point_class,
                'pointType': obj.point_type,
                'engineeringUnits': obj.engineering_units,
            }
            results.append(point_info)

        return results

    def get_points(self, data_server: str, start_index: int = Constants.DEFAULT_POINTS_START_INDEX, max_count: int = Constants.DEFAULT_POINTS_MAX_COUNT) -> 'list[PIPoint]':

        data_server = self.client.dataServer.get_by_name(data_server)

        data = self.client.dataServer.get_points(
            web_id=data_server.web_id, start_index=start_index, max_count=max_count)

        response = []
        for pi_point in data.items:
            point_dict = {
                'id': pi_point.id,
                'name': pi_point.name,
                'descriptor': pi_point.descriptor,
                'path': pi_point.path,
                'pointClass': pi_point.point_class,
                'pointType': pi_point.point_type,
                'engineeringUnits': pi_point.engineering_units,
                'step': pi_point.step,
                'webId': pi_point.web_id
            }
            response.append(point_dict)

        return response

    def get_historical_data(self, server_name, tag_name):

        data = self.client.data.get_recorded_values(
            f"pi:\\\\{server_name}\\{tag_name}", start_time="*-5s", end_time="*")

        data_dict = data.to_dict(orient='records')

        return data_dict

    def get_historical_data_batch(self, web_ids, start_time, end_time) -> 'list[PiResponse]':

        try:
            # TODO: Retry support?
            data = self.client.streamSet.get_recorded_ad_hoc(web_ids, start_time=str(
                start_time), end_time=str(end_time), include_filtered_values=True)

            if data.items is None or len(data.items) == 0:
                self.logger.info("Got empty PI request response body")
                return None

            response = []
            for item in data.items:
                record = PiResponse(path=item.path, name=item.name,
                                    records=convert_batch_response_to_dicts(item.items))
                response.append(record)

        except Exception:
            self.logger.error(
                "Request Error with PI Web API Server..." + str(traceback.format_exc()))
            response = None

        return response


def convert_batch_response_to_dicts(items):

    if items is None or len(items) == 0:
        return []

    data_frame = DataApi.convert_to_df(None, items, None)
    data_dict = data_frame.to_dict(orient='records')

    return data_dict
