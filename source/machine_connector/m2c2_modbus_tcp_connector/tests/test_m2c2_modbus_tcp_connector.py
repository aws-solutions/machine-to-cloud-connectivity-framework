# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from unittest import mock, TestCase


class TestM2C2ModbusTCPConnector(TestCase):

    def test_main(self):
        # arrange
        with mock.patch("utils.AWSEndpointClient.__init__", return_value=None) as mock_endpoint_client:
            import m2c2_modbus_tcp_connector.m2c2_modbus_tcp_connector as connector
            self.connector = connector
            self.connector.connector_client = mock_endpoint_client.MagicMock()
            self.connector.connector_client.publish_message_to_iot_topic = mock.MagicMock()
            self.connector.connector_client.stop_client = mock.MagicMock()
            self.connector.connector_client.start_client = mock.MagicMock()
            self.connector.connector_client.read_local_connection_configuration = mock.MagicMock()
            self.connector.connector_client.write_local_connection_configuration_file = mock.MagicMock()

            # act
            connector.main()

            # assert
            self.connector.connector_client.read_local_connection_configuration.assert_called()
