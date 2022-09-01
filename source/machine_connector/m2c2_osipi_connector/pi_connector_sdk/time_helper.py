# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from datetime import datetime, timedelta, timezone
from os import makedirs
from os.path import exists, abspath
from pathlib import Path
from typing import Union


class TimeHelper:
    def __init__(self, time_log_file: str):
        self.time_log_file = time_log_file

    def write_datetime_to_time_log(self, d_time) -> None:

        if not exists(self.time_log_file):
            log_dir = Path(self.time_log_file).parent
            makedirs(log_dir, exist_ok=True)

        with open(self.time_log_file, "w+") as f:
            timestamp = str(d_time)
            f.write(timestamp)

    def _get_time_from_time_log(self) -> Union[datetime, None]:

        if exists(self.time_log_file):
            with open(self.time_log_file, "r") as file:
                last_accessed_time_str = file.read()
        else:
            return None

        try:
            return datetime.fromisoformat(last_accessed_time_str)
        except Exception:
            # If file is empty or time invalid, return none so that parent function can take action
            return None

    def get_calculated_time_range(self, max_req_duration_sec: float, query_offset_from_now_sec: float = 0):

        start_time = self._get_time_from_time_log()

        if start_time is None:
            start_time = _get_current_utc_datetime(
            ) - timedelta(seconds=query_offset_from_now_sec + 1)
            self.write_datetime_to_time_log(start_time)

        end_time = _get_current_utc_datetime() - timedelta(seconds=query_offset_from_now_sec)

        time_diff = end_time - start_time
        time_diff_sec = time_diff.total_seconds()

        # Note: This can occur if the queryOffsetFromNow has changed. Need to handle getting times back in sync
        if (time_diff_sec < 0):
            start_time = end_time - timedelta(seconds=1)
            time_diff = end_time - start_time
            time_diff_sec = time_diff.total_seconds()

        is_offset_from_latest_request_query = False

        if time_diff_sec > max_req_duration_sec:
            end_time = start_time + timedelta(seconds=max_req_duration_sec)
            is_offset_from_latest_request_query = True

        return start_time, end_time, is_offset_from_latest_request_query


def _get_current_utc_datetime():
    return datetime.now(tz=timezone.utc)
