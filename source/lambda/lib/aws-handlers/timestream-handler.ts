// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import TimestreamWrite from 'aws-sdk/clients/timestreamwrite';
import Logger, { LoggingLevel } from '../logger';
import { getAwsSdkOptions } from '../utils';

const { LOGGING_LEVEL } = process.env;
const timestreamWrite = new TimestreamWrite(getAwsSdkOptions());
const logger = new Logger('TimestreamHandler', LOGGING_LEVEL);

/**
 * The Timestream handler to control Timestream table actions
 */
export default class TimestreamHandler {
  constructor(private readonly database: string, private readonly table: string) {}

  /**
   * Writes records in Timestream database and table.
   * @param records The Timestream data records
   */
  public async write(records: TimestreamWrite.Records): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Writing records into Timestream: ${this.database}/${this.table}`);
    logger.log(LoggingLevel.VERBOSE, 'Records: ', JSON.stringify(records));

    const params: TimestreamWrite.WriteRecordsRequest = {
      DatabaseName: this.database,
      Records: records,
      TableName: this.table
    };

    await timestreamWrite.writeRecords(params).promise();
  }
}
