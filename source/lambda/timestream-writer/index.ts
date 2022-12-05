// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import TimestreamWrite from 'aws-sdk/clients/timestreamwrite';
import TimestreamHandler from '../lib/aws-handlers/timestream-handler';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import { WriteRecordsRequest } from '../lib/types/timestream-handler-types';

const { LOGGING_LEVEL, TIMESTREAM_DATABASE, TIMESTREAM_TABLE } = process.env;
const A_DAY_MS = 60 * 60 * 24 * 1000;
const MAX_WRITE_RECORDS = 100;

const logger = new Logger('timestream-putter', LOGGING_LEVEL);
const timestream = new TimestreamHandler();

/**
 * This is an abstract type of Kinesis record event.
 * Refer to {@link https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html} for more information.
 */
type KinesisRecord = {
  kinesis: {
    data: string;
  };
};

type EventMessage = {
  Records: KinesisRecord[];
};

type DataType = {
  area: string;
  machine: string;
  process: string;
  quality: 'Good' | 'GOOD' | 'Bad' | 'BAD' | 'Uncertain' | 'UNCERTAIN';
  site: string;
  tag: string;
  timestamp: number;
  value: unknown;
};

/**
 * The Lambda function consumes the Kinesis data stream records and store the data in Timestream.
 * @param event Kinesis data stream record event containing machine data
 */
export async function handler(event: EventMessage): Promise<void> {
  logger.log(LoggingLevel.VERBOSE, `Event: ${JSON.stringify(event, null, 2)}`);

  const { Records } = event;

  while (Records.length > 0) {
    const timestreamRecords: TimestreamWrite.Record[] = [];

    Records.splice(0, MAX_WRITE_RECORDS).forEach((record: KinesisRecord) => {
      try {
        const data: DataType = JSON.parse(Buffer.from(record.kinesis.data, 'base64').toString());
        validateRecord(data);
        timestreamRecords.push(parseToTimestream(data));
      } catch (error) {
        logger.log(
          LoggingLevel.ERROR,
          'Error occurred while parsing a record, record: ',
          JSON.stringify(record, null, 2),
          ', error: ',
          error
        );
      }
    });

    if (timestreamRecords.length > 0) {
      try {
        const params: WriteRecordsRequest = {
          databaseName: TIMESTREAM_DATABASE,
          tableName: TIMESTREAM_TABLE,
          records: timestreamRecords
        };
        await timestream.write(params);
      } catch (error) {
        logger.log(LoggingLevel.ERROR, 'Error occurred while storing data into Timestream: ', error);
      }
    }
  }
}

/**
 * Validates if a record is valid.
 * @param record Kinesis record data
 */
function validateRecord(record: DataType): void {
  const { area, machine, process, quality, site, tag, timestamp, value } = record;

  for (const [key, val] of Object.entries({ area, machine, process, site, tag })) {
    if (typeof val !== 'string' || !val.trim()) {
      throw new LambdaError({
        message: `Required value is missing or empty: [${key}]: ${val}`,
        name: 'ValidationError',
        statusCode: 400
      });
    }
  }

  if (!['Good', 'GOOD', 'Bad', 'BAD', 'Uncertain', 'UNCERTAIN'].includes(quality)) {
    throw new LambdaError({
      message: `Quality value is invalid, quality: ${quality}`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (typeof value === 'undefined' || value === null) {
    throw new LambdaError({
      message: 'Value is missing.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const now = new Date().getTime();
  if (isNaN(parseInt(`${timestamp}`)) || now - timestamp > A_DAY_MS || now < timestamp) {
    throw new LambdaError({
      message: `Timestamp is invalid, timestamp: ${timestamp}`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Parses a record to Timestream format.
 * @param record Kinesis record data
 * @returns Timestream write record
 */
export function parseToTimestream(record: DataType): TimestreamWrite.Record {
  return {
    Dimensions: [
      createDimension('site', record.site),
      createDimension('area', record.area),
      createDimension('process', record.process),
      createDimension('machine', record.machine),
      createDimension('quality', record.quality)
    ],
    MeasureName: record.tag,
    MeasureValue: `${record.value}`,
    MeasureValueType: getTimestreamValueType(record.value),
    Time: `${record.timestamp}`,
    TimeUnit: 'MILLISECONDS'
  };
}

/**
 * Creates a Timestream record dimension.
 * @param name The name of dimension
 * @param value The value of dimension
 * @returns Timestream record dimension
 */
function createDimension(name: string, value: unknown): TimestreamWrite.Dimension {
  return {
    Name: name,
    Value: `${value}`
  };
}

/**
 * Gets Timestream value type from the machine value.
 * @param value The value from the machine
 * @returns Timestream value type
 */
function getTimestreamValueType(value: unknown): string {
  const valueType = typeof value;

  switch (valueType) {
    case 'string':
      return 'VARCHAR';
    case 'boolean':
      return 'BOOLEAN';
    case 'number':
      return 'DOUBLE';
    default:
      throw new LambdaError({
        message: `The value type, ${valueType}, is currently not supported.`,
        name: 'UnsupportedType',
        statusCode: 400
      });
  }
}
