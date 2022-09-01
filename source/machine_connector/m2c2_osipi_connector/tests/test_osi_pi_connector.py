# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
from datetime import datetime
import json
import os
from re import M
from unittest import mock, result
import tempfile


from unittest import TestCase
from unittest.mock import call, patch
from m2c2_osipi_connector.pi_connector_sdk.pi_connection_config import PiConnectionConfig
import osisoft.pidevclub.piwebapi.models.pi_point as PiPoint
import osisoft.pidevclub.piwebapi.models.pi_item_point as PiItemPoint
import osisoft.pidevclub.piwebapi.models.pi_items_item_point as PIItemsItemPoint
import osisoft.pidevclub.piwebapi.models.pi_items_point as PIItemsPoint
import osisoft.pidevclub.piwebapi.models.pi_items_stream_values as PIItemsStreamValues
import osisoft.pidevclub.piwebapi.models.pi_timed_value as PITimedValue
import osisoft.pidevclub.piwebapi.models.pi_stream_values as PIStreamValues

import pandas as pd


class TestOsiPiConnectorSDK(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tags = ["Tag1", "Tag2"]

        cls.mock_web_id = "DUMMY"

        cls.connection_config = cls.build_connection_config(cls, cls.tags)

        with patch('osisoft.pidevclub.piwebapi.pi_web_api_client.PIWebApiClient') as mock_pi_web_api_client:

            import m2c2_osipi_connector.pi_connector_sdk.osi_pi_connector as connector
            cls.connector = connector.OsiPiConnector(cls.connection_config)

            cls.mock_pi_web_api_client = mock_pi_web_api_client

            cls.point_values = {
                'name': cls.tags[0],
                'path': f'\\\\{ cls.connection_config.server_connection.server_name}\\{cls.tags[0]}',
                'pointClass': 'VELOCITY',
                'pointType': 'DOUBLE',
                'engineeringUnits': 'ft/s'
            }

            cls.point_values2 = {
                'name': cls.tags[1],
                'path': f'\\\\{ cls.connection_config.server_connection.server_name}\\{cls.tags[1]}',
                'pointClass': 'RPM',
                'pointType': 'RPM',
                'engineeringUnits': 'rpm'
            }

            cls.mock_pi_point = PiPoint.PIPoint(
                web_id=cls.mock_web_id,
                name=cls.point_values['name'],
                path=cls.point_values['path'],
                point_class=cls.point_values['pointClass'],
                point_type=cls.point_values['pointType'],
                engineering_units=cls.point_values['engineeringUnits'])

            cls.mock_pi_point2 = PiPoint.PIPoint(
                web_id=cls.mock_web_id,
                name=cls.point_values2['name'],
                path=cls.point_values2['path'],
                point_class=cls.point_values2['pointClass'],
                point_type=cls.point_values2['pointType'],
                engineering_units=cls.point_values2['engineeringUnits'])

            mock_pi_points_response = [PiItemPoint.PIItemPoint(
                object=cls.mock_pi_point), PiItemPoint.PIItemPoint(object=cls.mock_pi_point2)]

            cls.mock_pi_point_items = PIItemsItemPoint.PIItemsItemPoint(
                items=mock_pi_points_response)

            mock_pi_web_api_client().point.get_by_path.return_value = cls.mock_pi_point
            mock_pi_web_api_client().point.get.return_value = cls.mock_pi_point
            mock_pi_web_api_client().point.get_multiple.return_value = cls.mock_pi_point_items
            mock_pi_web_api_client().dataServer.get_points.return_value = PIItemsPoint.PIItemsPoint(
                items=[cls.mock_pi_point, cls.mock_pi_point2])
            mock_pi_web_api_client().data.get_recorded_values.return_value = cls.generate_mock_data(cls)
            mock_pi_web_api_client(
            ).streamSet.get_recorded_ad_hoc.return_value = cls.generate_mock_batch_date(cls)

    def generate_mock_data(self):

        value = [123]
        timestamp = [123]
        unitsAbbreviation = ['']
        good = [True]
        questionable = [False]

        data = {
            'Value': value,
            'Timestamp': timestamp,
            'UnitsAbbreviation': unitsAbbreviation,
            'Good': good,
            'Questionable': questionable,
        }

        return pd.DataFrame(data)

    def generate_mock_batch_date(self):

        items = []
        items.append(PITimedValue.PITimedValue(timestamp=123, units_abbreviation='',
                     good=True, questionable=False, substituted=False, value=123))

        stream_values = PIStreamValues.PIStreamValues(
            path="test", name="test", items=items)

        return PIItemsStreamValues.PIItemsStreamValues(items=[stream_values])

    def build_connection_config(self, tags):
        pi_config = PiConnectionConfig()

        pi_config.server_connection.api_url = "https://ec2-12-123-12-12.compute-1.amazonaws.com/piwebapi"
        pi_config.server_connection.verify_ssl = True
        pi_config.server_connection.server_name = "EC2AMAZ-MCHNNAME"

        pi_config.server_connection.auth_mode = "BASIC"
        pi_config.server_connection.auth_param.username = "USERNAME"
        pi_config.server_connection.auth_param.password = "PASSWORD"

        pi_config.query_config.tag_names = tags
        pi_config.query_config.req_frequency_sec = 60
        pi_config.query_config.catchup_req_frequency_sec = 0.1
        pi_config.query_config.max_req_duration_sec = 600
        pi_config.query_config.query_offset_from_now_sec = 0

        temp_file = tempfile.NamedTemporaryFile()

        pi_config.time_log_file = temp_file.name

        return pi_config

    def test_get_web_ids_for_tag_names(self):

        tags = self.tags
        web_ids = self.connector.get_web_ids_for_tag_names(tags)

        self.assertEquals(
            web_ids, [self.mock_web_id, self.mock_web_id])

        server_name = self.connection_config.server_connection.server_name

        self.connector.client.point.get_by_path.assert_called()

        self.assertEqual(
            len(tags), self.connector.client.point.get_by_path.call_count)

        calls = []
        for tag in tags:
            calls.append(call(f'\\\\{server_name}\\{tag}'))

        self.connector.client.point.get_by_path.assert_has_calls(calls)

        self.mock_pi_web_api_client.reset_mock()

        try:
            self.mock_pi_web_api_client().point.get_by_path.side_effect = Exception("Failure")
            with self.assertRaises(Exception):
                web_ids = self.connector.get_web_ids_for_tag_names(tags)
        finally:
            self.mock_pi_web_api_client().point.get_by_path.side_effect = None

    def test_get_point_metadata(self):

        pi_point = self.connector.get_point_metadata(
            self.mock_web_id)

        self.connector.client.point.get.assert_called()

        self.assertEquals(pi_point, self.mock_pi_point)

    def test_get_points_metadata(self):

        results = self.connector.get_points_metadata(
            [self.mock_web_id, self.mock_web_id])

        self.connector.client.point.get_multiple.assert_called()

        self.assertEqual(2, len(results))

        self.assertEqual(self.point_values, results[0])

        self.assertEqual(self.point_values2, results[1])

    def test_get_points(self):

        results = self.connector.get_points(data_server="DUMMY_SERVER")

        # To avoid having to create full objects, just check that values are correctly returned for what was provided in mocks
        self.assertDictContainsSubset(self.point_values, results[0])
        self.assertDictContainsSubset(self.point_values2, results[1])

    def test_get_historical_data(self):

        result = self.connector.get_historical_data(
            server_name="DUMMY_SERVER", tag_name=self.point_values['name'])

        self.connector.client.data.get_recorded_values.assert_called()

        self.assertEquals(self.generate_mock_data().to_dict(
            orient='records'), result)

    def test_get_historical_data_batch(self):

        results = self.connector.get_historical_data_batch(
            web_ids=[self.mock_web_id], start_time=0, end_time=1)

        record = results[0].records[0]

        self.connector.client.streamSet.get_recorded_ad_hoc.assert_called()

        self.assertEqual(123, record['Value'])
        self.assertEqual(True, record['Good'])
        self.assertEqual(123, record['Timestamp'])

        try:
            self.mock_pi_web_api_client(
            ).streamSet.get_recorded_ad_hoc.side_effect = Exception("Failure")
            results = self.connector.get_historical_data_batch(
                web_ids=[self.mock_web_id], start_time=0, end_time=1)

            self.assertEqual(None, results)
        finally:
            self.mock_pi_web_api_client().streamSet.get_recorded_ad_hoc.side_effect = None
