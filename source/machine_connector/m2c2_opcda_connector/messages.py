## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

# Info messages
INF_MSG_CONNECTION_STARTED = "Connection started."
INF_MSG_CONNECTION_STOPPED = "Connection stopped."
INF_MSG_CONNECTION_UPDATED = "Connection updated."
INF_MSG_SERVER_NAME = "Available server: {}"
INF_MSG_PUBLISH_DATA_TO_TOPIC = "Publishing data to topic %s: %s"

# Error messages
ERR_MSG_FAIL_SERVER_NAME = "Failed to retrieve available server(s): {}"
ERR_MSG_FAIL_TO_CONNECT = "Unable to connect to the server."
ERR_MSG_LOST_COMMS_CONNECTION_STOPPED = "Unable to read server: {}"
ERR_MSG_FAIL_UNKWOWN_CONTROL = "Unknown control request: {}"
ERR_MSG_FAIL_LAST_COMMAND_STOP = "Connection '{}' has already been stopped."
ERR_MSG_FAIL_LAST_COMMAND_START = "A version of the requested '{}' is already running. Please stop it before starting it again."
ERR_MSG_NO_CONNECTION_FILE = "Request was not successful. Connection '{}' has not been started."
ERR_MSG_SCHEMA_MESSAGE_NOT_DICT = "Message validation error. Message is not dictionary: '{}'"
ERR_MSG_SCHEMA_EMPTY_MESSAGES = "Message validation error. No data in messages: '{}'"
ERR_MSG_SCHEMA_MISSING_KEY = "Message validation error. Missing key in message '{}'"
ERR_MSG_SCHEMA_DATE_CORRUPTED = "Message validation error. Datestamp is malformed in message '{}'"
ERR_NAME_NOT_ALIAS = "Message validation error. The `name` value within each data point message must be the same string as `alias`: '{}'"
ERR_MISSING_KEYS = "Message validation error. The following keys are missing from the message: '{}'"
ERR_MSG_VALIDATION = "An error occurred validating message data: '{}'"
