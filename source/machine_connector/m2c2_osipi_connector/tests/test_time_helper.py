

from datetime import datetime, timedelta, timezone
from unittest import TestCase
from unittest import mock
from unittest.mock import patch, mock_open
from m2c2_osipi_connector.pi_connector_sdk.time_helper import TimeHelper


class TestTimeHelper(TestCase):

    @classmethod
    def setUpClass(cls):
        pass

    def setUp(self):
        self.time_helper = TimeHelper('dummy_file')
        self.sample_time = datetime.now(tz=timezone.utc)

    @mock.patch('m2c2_osipi_connector.pi_connector_sdk.time_helper.makedirs')
    @mock.patch('m2c2_osipi_connector.pi_connector_sdk.time_helper.exists')
    def test_write_datetime_to_time_log(self, mock_exists, mock_makedirs):
        with patch("builtins.open", mock_open(read_data="")) as mock_file_open:

            mock_exists.return_value = True
            self.time_helper.write_datetime_to_time_log(self.sample_time)

            mock_exists.assert_called()
            mock_makedirs.assert_not_called()
            mock_file_open.assert_called()

            mock_exists.reset_mock()
            mock_makedirs.reset_mock()
            mock_file_open.reset_mock()

            mock_exists.return_value = False
            self.time_helper.write_datetime_to_time_log(self.sample_time)

            mock_exists.assert_called()
            mock_makedirs.assert_called()
            mock_file_open.assert_called()

    @patch.object(TimeHelper, 'write_datetime_to_time_log', return_value=None)
    @mock.patch('m2c2_osipi_connector.pi_connector_sdk.time_helper._get_current_utc_datetime')
    @mock.patch('m2c2_osipi_connector.pi_connector_sdk.time_helper.exists', return_value=True)
    def test_get_calculated_time_range(self, mock_exists, mock_get_current_utc_datetime, write_datetime_to_time_log):

        max_req_duration_sec = 60
        query_offset_from_now_sec = 0

        # Test 30 second request with no offset from now()
        set_end_time = datetime.now(tz=timezone.utc)
        set_start_time = set_end_time - timedelta(seconds=30)

        with patch("builtins.open", mock_open(read_data=str(set_start_time))) as mock_file_open:

            mock_get_current_utc_datetime.return_value = set_end_time

            start_time, end_time, is_offset = self.time_helper.get_calculated_time_range(
                max_req_duration_sec,
                query_offset_from_now_sec)

            self.assertEquals(set_start_time, start_time)
            self.assertEquals(set_end_time, end_time)
            self.assertEquals(False, is_offset)

        # Test 70 second request with no offset from now()
        set_end_time = datetime.now(tz=timezone.utc)
        set_start_time = set_end_time - timedelta(seconds=70)

        with patch("builtins.open", mock_open(read_data=str(set_start_time))) as mock_file_open:

            mock_get_current_utc_datetime.return_value = set_end_time

            start_time, end_time, is_offset = self.time_helper.get_calculated_time_range(
                max_req_duration_sec,
                query_offset_from_now_sec)

            self.assertEquals(set_start_time, start_time)
            self.assertEquals(
                start_time + timedelta(seconds=max_req_duration_sec), end_time)
            self.assertEquals(True, is_offset)

        # Test handle no start time
        set_end_time = datetime.now(tz=timezone.utc)

        with patch("builtins.open", mock_open(read_data='')) as mock_file_open:

            mock_get_current_utc_datetime.return_value = set_end_time

            start_time, end_time, is_offset = self.time_helper.get_calculated_time_range(
                max_req_duration_sec,
                query_offset_from_now_sec)

            self.assertEquals(set_end_time - timedelta(seconds=1), start_time)
            self.assertEquals(set_end_time, end_time)
            self.assertEquals(False, is_offset)

        # Test handle change in offset from now
        set_end_time = datetime.now(tz=timezone.utc)
        set_start_time = set_end_time - timedelta(seconds=30)
        query_offset_from_now_sec = 100

        with patch("builtins.open", mock_open(read_data=str(set_start_time))) as mock_file_open:

            mock_get_current_utc_datetime.return_value = set_end_time

            start_time, end_time, is_offset = self.time_helper.get_calculated_time_range(
                max_req_duration_sec,
                query_offset_from_now_sec)

            self.assertEquals(end_time - timedelta(seconds=1), start_time)
            self.assertEquals(
                set_end_time - timedelta(seconds=query_offset_from_now_sec), end_time)
            self.assertEquals(False, is_offset)

    def test_get_time_from_time_log(self):

        with patch('m2c2_osipi_connector.pi_connector_sdk.time_helper.exists') as mock_exists:
            mock_exists.return_value = True

            with patch("builtins.open", mock_open(read_data=str(self.sample_time))) as mock_file_open:

                result = self.time_helper._get_time_from_time_log()

                self.assertEquals(self.sample_time, result)

            with patch("builtins.open", mock_open(read_data=str("INVALID"))) as mock_file_open:

                result = self.time_helper._get_time_from_time_log()

                self.assertEquals(None, result)

        with patch('m2c2_osipi_connector.pi_connector_sdk.time_helper.exists') as mock_exists:
            mock_exists.return_value = False

            result = self.time_helper._get_time_from_time_log()

            self.assertEquals(None, result)
