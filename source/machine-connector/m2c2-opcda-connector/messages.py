## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

# Info messages
INF_MSG_JOB_STARTED = "Job started."
INF_MSG_JOB_STOPPED = "Job stopped."
INF_MSG_JOB_UPDATED = "Job updated."
INF_MSG_SERVER_NAME = "Available server: {}"
INF_MSG_PUBLISH_DATA_TO_TOPIC = "Publishing data to topic %s: %s"

# Error messages
ERR_MSG_FAIL_SERVER_NAME = "Failed to retrieve available server(s): {}"
ERR_MSG_FAIL_TO_CONNECT = "Unable to connect to the server."
ERR_MSG_LOST_COMMS_JOB_STOPPED = "Unable to read server: {}"
ERR_MSG_FAIL_UNKWOWN_CONTROL = "Unknown control request: {}"
ERR_MSG_FAIL_LAST_COMMAND_STOP = "Job '{}' has already been stopped."
ERR_MSG_FAIL_LAST_COMMAND_START = "A version of the requested '{}' is already running. Please stop it before starting it again."
ERR_MSG_NO_JOB_FILE = "Request was not successful. Job '{}' has not been started."