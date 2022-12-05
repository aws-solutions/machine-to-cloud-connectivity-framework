# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
from unittest import mock


@mock.patch.dict(os.environ, {"SITE_NAME": "test_site", "AREA": "test_area", "PROCESS": "test_process", "MACHINE_NAME": "test_machine_name"})
def test_init_user_message_init(mocker):
    mocker.patch("pickle_checkpoint_manager.PickleCheckpointManager")
    from init_msg_metadata import InitMessage
    msg_metadata_client = InitMessage()
    assert msg_metadata_client.SITE_NAME == "test_site"
    assert msg_metadata_client.AREA == "test_area"
    assert msg_metadata_client.PROCESS == "test_process"
    assert msg_metadata_client.MACHINE_NAME == "test_machine_name"


@mock.patch.dict(os.environ, {"SITE_NAME": "test_site", "AREA": "test_area", "PROCESS": "test_process", "MACHINE_NAME": "test_machine_name"})
def test_init_user_message_usrmsg(mocker):
    mocker.patch("pickle_checkpoint_manager.PickleCheckpointManager")
    from init_msg_metadata import InitMessage
    msg_metadata_client = InitMessage()
    test_user_message = msg_metadata_client.init_user_message()
    expected_user_message = {
        "siteName": "test_site",
        "area": "test_area",
        "process": "test_process",
        "machineName": "test_machine_name"
    }
    assert "siteName" in test_user_message
    assert "area" in test_user_message
    assert "process" in test_user_message
    assert "machineName" in test_user_message
    assert test_user_message == expected_user_message
    assert test_user_message["siteName"] == expected_user_message["siteName"]
    assert test_user_message["area"] == expected_user_message["area"]
    assert test_user_message["process"] == expected_user_message["process"]
    assert test_user_message["machineName"] == expected_user_message["machineName"]
