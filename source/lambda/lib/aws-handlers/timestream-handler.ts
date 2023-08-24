// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import TimestreamWrite, { ListTablesResponse } from 'aws-sdk/clients/timestreamwrite';
import Logger, { LoggingLevel } from '../logger';
import { getAwsSdkOptions } from '../utils';
import {
  ListTablesRequest,
  DeleteTableRequest,
  DeleteDatabaseRequest,
  WriteRecordsRequest
} from '../types/timestream-handler-types';

const { LOGGING_LEVEL } = process.env;
const timestreamWrite = new TimestreamWrite(getAwsSdkOptions());
const logger = new Logger('TimestreamHandler', LOGGING_LEVEL);

/**
 * The Timestream handler to control Timestream actions
 */
export default class TimestreamHandler {
  /**
   * Writes records in Timestream database and table.
   * @param params The required params to do a write records
   */
  public async write(params: WriteRecordsRequest): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Writing records into Timestream: ${params.databaseName}/${params.tableName}`);

    const writeRecordsRequest: TimestreamWrite.WriteRecordsRequest = {
      DatabaseName: params.databaseName,
      Records: params.records,
      TableName: params.tableName
    };

    await timestreamWrite.writeRecords(writeRecordsRequest).promise();
  }

  async listTables(params: ListTablesRequest): Promise<ListTablesResponse> {
    const listTablesRequest: TimestreamWrite.Types.ListTablesRequest = {
      DatabaseName: params.databaseName
    };

    return await timestreamWrite.listTables(listTablesRequest).promise();
  }

  async deleteTable(params: DeleteTableRequest): Promise<void> {
    const deleteTableRequest: TimestreamWrite.Types.DeleteTableRequest = {
      DatabaseName: params.databaseName,
      TableName: params.tableName
    };
    console.log(`Deleting table ${params.tableName}`);

    await timestreamWrite.deleteTable(deleteTableRequest).promise();
  }

  async deleteDatabase(params: DeleteDatabaseRequest): Promise<void> {
    const deleteDbParams = {
      DatabaseName: params.databaseName
    };
    console.log(`Deleting database ${params.databaseName}`);

    await timestreamWrite.deleteDatabase(deleteDbParams).promise();
  }
}
