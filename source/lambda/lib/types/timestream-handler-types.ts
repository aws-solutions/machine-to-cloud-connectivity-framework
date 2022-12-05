// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import TimestreamWrite from 'aws-sdk/clients/timestreamwrite';

export interface WriteRecordsRequest {
  databaseName: string;
  tableName: string;
  records: TimestreamWrite.Records;
}

export interface ListTablesRequest {
  databaseName: string;
}

export interface DeleteTableRequest {
  databaseName: string;
  tableName: string;
}

export interface DeleteDatabaseRequest {
  databaseName: string;
}
