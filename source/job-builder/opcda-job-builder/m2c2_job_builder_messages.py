## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0


ERR_MSG_JSON_KEY_CONTROL = "Unable to execute: control not found. Check JSON structure."
ERR_MSG_JSON_KEY_PROPERTIES = "Unable to execute: properties not found. Check JSON structure."
ERR_MSG_JSON_KEY_PULL = "Unable to execute PULL control. Check missing JSON parameters."
ERR_MSG_JSON_KEY_PUSH = "Unable to execute PUSH control. Check missing JSON parameters."
ERR_MSG_JSON_KEY_START_STOP = "Unable to execute START/STOP control. Check missing JSON parameters."
ERR_MSG_JSON_KEY_DEPLOY_UPDATE_PROPERTIES = "Unable to execute DEPLOY/UPDATE control. Check missing JSON parameters."
ERR_MSG_JSON_KEY_CONNECTIVITY = "Unable to execute: Check missing JSON parameters in 'connectivity-parameters'"
ERR_MSG_JSON_KEY_DATA = "Unable to execute: Check missing JSON parameters in 'data-parameters'."
ERR_MSG_JSON_KEY_MACHINE = "Unable to execute: Check missing JSON parameters in 'machine-details'."
ERR_MSG_JSON_JOB_DUPLICATE = "Unable to execute: Check JSON properties for duplicate job names."
ERR_MSG_JSON_KEY_PULL_VERSION = "Unable to execute PULL control. Version is not required."

ERR_MSG_FAIL_LAST_COMMAND_START = "A version of the requested job is already running. Please stop it before starting it again"

ERR_MSG_S3_READ_FAILURE = "Unable to read job details from S3 bucket: %s in %s."
ERR_MSG_S3_WRITE_FAILURE = "Unable to write/update job details to S3 bucket. Check %s in %s."
ERR_MSG_DDB_QUERY_FAILURE = "Invalid job name and/or version."
ERR_MSG_DDB_MULTIPLE_ENTRIES_FOUND = "Unable to execute: multiple entries found in data. Job name and version must be unique."
ERR_MSG_DDB_WRITE_FAILURE = "Unable to write job entry to database. Check %s"
ERR_MSG_DDB_UPDATE_FAILURE = "Unable to update job entry to database. Check %s"
ERR_MSG_FAIL_ALREADY_STOP = "Specified job is already stopped."
ERR_MSG_UNKNOWN_CONTROL = "Invalid control request: '%s'"
ERR_MSG_DEPLOY_JOB_NAME_ALREAD_EXIST = "Job name already exists in database. Use a different name."
INF_MSG_MANUAL_DEPLOY_REQUIRED = "Job successfully created. Deploy the GreenGrass group from the AWS IoT console and use the push control to check connectivity."
ERR_MSG_JOB_VERSION = "Unable to obtain job details from the database. Check %s version %s exists in %s."
ERR_MSG_JOB_NAME = "Unable to obtain job details from the database. Check %s exists in %s."

ERR_MSG_STOP_JOB = "Unable to stop job execution: invalid job %s."
ERR_MSG_UPDATE_JOB_ALREADY_EXISTS = "Unable to execute update request. Job '%s' version '%s' already exists."
ERR_MSG_UPDATE_JOB_DOES_NOT_EXISTS = "Unable to execute update request. Job '%s' does not exists."

ERR_MSG_PULL_JOB_DOES_NOT_EXISTS = "Unable to execute pull request. Job '%s' does not exists."

ERR_MSG_GREENGRASS_LAMBDA_CREATE = "Failed to create new connector lambda in user account"
ERR_MSG_GREENGRASS_LAMBDA_CREATE_ALIAS = "Failed to create new connector lambda alias in user account"
ERR_MSG_GREENGRASS_GET_GROUP = "Failed to retrieve GreenGrass Group information."
ERR_MSG_GREENGRASS_GET_GROUP_VERSION = "Failed to retrieve GreenGrass Group version information"
ERR_MSG_GREENGRASS_RETRIEVE_FUNCTIONS = "Failed to retrieve existing function list"
ERR_MSG_GREENGRASS_RETRIEVE_SUSCRIPTIONS = "Failed to retrieve existing subscription list"
ERR_MSG_GREENGRASS_RETRIEVE_RESOURCES = "Failed to retrieve existing resource list"
ERR_MSG_GREENGRASS_CREATE_FUNCTION_DEFINITION = "Failed to define function list"
ERR_MSG_GREENGRASS_CREATE_FUNCTION_DEFINITION_VERSION = "Failed to version function list"
ERR_MSG_GREENGRASS_CREATE_SUBSCRIPTION_DEFINITION = "Failed to define subscription list"
ERR_MSG_GREENGRASS_CREATE_SUBSCRIPTION_DEFINITION_VERSION = "Failed to version subscription list"
ERR_MSG_GREENGRASS_CREATE_RESOURCE_DEFINITION = "Failed to define resource list"
ERR_MSG_GREENGRASS_CREATE_RESOURCE_DEFINITION_VERSION = "Failed to version resource list"
ERR_MSG_GREENGRASS_CREATE_GROUP_VERSION = "Failed to version GreenGrass Group"

