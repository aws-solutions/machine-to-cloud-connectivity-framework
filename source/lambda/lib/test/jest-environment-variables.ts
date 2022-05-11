// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

process.env = {
  ARTIFACT_BUCKET: 'mock-artifact-bucket',
  CONNECTION_DYNAMODB_TABLE: 'connection-table',
  GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE: 'greengrass-core-devices-table',
  GREENGRASS_DEPLOYER_LAMBDA_FUNCTION: 'mock-greengrass-deployer',
  KINESIS_STREAM: 'mock-kinesis-stream',
  LAMBDA_ROLE: 'mock-lambda-role',
  LOGGING_LEVEL: 'ERROR',
  LOGS_DYNAMODB_TABLE: 'logs-table',
  PAGE_SIZE: '2',
  SOLUTION_ID: 'SO0070',
  SOLUTION_VERSION: 'vTest'
};
