// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, mockTimestreamHandler } from './mock';
import { handler, parseToTimestream } from '../index';
import { LambdaError } from '../../lib/errors';

const A_DAY_MS = 60 * 60 * 24 * 1000 + 1;
const quality = ['Good', 'GOOD', 'Bad', 'BAD', 'Uncertain', 'UNCERTAIN'];
const value = ['mock-string', true, Number.MAX_SAFE_INTEGER + 1, 1];
const data: Partial<{
  area: string;
  machine: string;
  process: string;
  quality: string;
  site: string;
  tag: string;
  timestamp: number;
  value: unknown;
}> = {};

/**
 * Creates mock records.
 * @param loop The loop to create mock records
 * @returns Mock records
 */
function createMockRecord(loop: number) {
  const mockRecords = [];

  for (let i = 0; i < loop; i++) {
    mockRecords.push({
      area: 'mock-area',
      machine: 'mock-machine',
      process: 'mock-process',
      quality: quality[i % quality.length],
      site: 'site',
      tag: 'Random.Mock',
      timestamp: A_DAY_MS - i,
      value: value[i % value.length]
    });
  }

  return mockRecords;
}

/**
 * Expects parsing error.
 * @param record The invalid record
 * @param error The error
 */
function expectParsingError(record: unknown, error: LambdaError) {
  expect(mockTimestreamHandler.write).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[timestream-putter]',
    'Error occurred while parsing a record, record: ',
    JSON.stringify(record, null, 2),
    ', error: ',
    error
  );
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(A_DAY_MS));
});

beforeEach(() => {
  consoleErrorSpy.mockReset();
  mockTimestreamHandler.write.mockReset();
});

afterAll(() => {
  jest.useRealTimers();
});

test('Test success to write records in Timestream table', async () => {
  mockTimestreamHandler.write.mockResolvedValueOnce(undefined);
  const records = createMockRecord(10);
  const event = {
    Records: records.map(record => ({
      kinesis: {
        data: Buffer.from(JSON.stringify(record)).toString('base64')
      }
    }))
  };

  await handler(event);
  expect(mockTimestreamHandler.write).toHaveBeenCalledTimes(1);
  expect(mockTimestreamHandler.write).toHaveBeenCalledWith({
    databaseName: 'mock-timestream-database',
    records: records.map(record => parseToTimestream(record)),
    tableName: 'mock-timestream-table'
  });
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});

test('Test success to write records in Timestream table when there are more than 100 records', async () => {
  mockTimestreamHandler.write.mockResolvedValue(undefined);
  const records = createMockRecord(150);
  const event = {
    Records: records.map(record => ({
      kinesis: {
        data: Buffer.from(JSON.stringify(record)).toString('base64')
      }
    }))
  };

  await handler(event);
  expect(mockTimestreamHandler.write).toHaveBeenCalledTimes(2);
  expect(mockTimestreamHandler.write).toHaveBeenNthCalledWith(1, {
    databaseName: 'mock-timestream-database',
    records: records.splice(0, 100).map(record => parseToTimestream(record)),
    tableName: 'mock-timestream-table'
  });
  expect(mockTimestreamHandler.write).toHaveBeenNthCalledWith(2, {
    databaseName: 'mock-timestream-database',
    records: records.splice(0, 100).map(record => parseToTimestream(record)),
    tableName: 'mock-timestream-table'
  });
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});

test('Test failure to write records in Timestream table due to invalid area name type', async () => {
  const error = new LambdaError({
    message: `Required value is missing or empty: [area]: ${data.area}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to empty area name', async () => {
  data.area = '';
  const error = new LambdaError({
    message: `Required value is missing or empty: [area]: ${data.area}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid machine name type', async () => {
  data.area = 'mock-area';
  const error = new LambdaError({
    message: `Required value is missing or empty: [machine]: ${data.machine}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to empty machine name', async () => {
  data.machine = '';
  const error = new LambdaError({
    message: `Required value is missing or empty: [machine]: ${data.machine}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid process type', async () => {
  data.machine = 'mock-machine';
  const error = new LambdaError({
    message: `Required value is missing or empty: [process]: ${data.process}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to empty process', async () => {
  data.process = '';
  const error = new LambdaError({
    message: `Required value is missing or empty: [process]: ${data.process}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid site type', async () => {
  data.process = 'mock-process';
  const error = new LambdaError({
    message: `Required value is missing or empty: [site]: ${data.site}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to empty site', async () => {
  data.site = '';
  const error = new LambdaError({
    message: `Required value is missing or empty: [site]: ${data.site}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid tag type', async () => {
  data.site = 'mock-site';
  const error = new LambdaError({
    message: `Required value is missing or empty: [tag]: ${data.tag}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to empty tag', async () => {
  data.tag = '';
  const error = new LambdaError({
    message: `Required value is missing or empty: [tag]: ${data.tag}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid quality', async () => {
  data.tag = 'mock-tag';
  data.quality = 'invalid';
  const error = new LambdaError({
    message: `Quality value is invalid, quality: ${data.quality}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to missing value', async () => {
  data.quality = 'Good';
  const error = new LambdaError({
    message: 'Value is missing.',
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to null value', async () => {
  data.value = null;
  const error = new LambdaError({
    message: 'Value is missing.',
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to invalid timestream type', async () => {
  data.value = 'mock-string';
  data.timestamp = <never>'invalid';
  const error = new LambdaError({
    message: `Timestamp is invalid, timestamp: ${data.timestamp}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to more than a day old timestamp', async () => {
  data.timestamp = 0;
  const error = new LambdaError({
    message: `Timestamp is invalid, timestamp: ${data.timestamp}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to future timestamp', async () => {
  data.timestamp = A_DAY_MS + 1;
  const error = new LambdaError({
    message: `Timestamp is invalid, timestamp: ${data.timestamp}`,
    name: 'ValidationError',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to unsupported value type', async () => {
  data.timestamp = A_DAY_MS;
  data.value = {};
  const error = new LambdaError({
    message: `The value type, ${typeof data.value}, is currently not supported.`,
    name: 'UnsupportedType',
    statusCode: 400
  });
  const record = {
    kinesis: {
      data: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  };
  const event = {
    Records: [record]
  };

  await handler(event);
  expectParsingError(record, error);
});

test('Test failure to write records in Timestream table due to write failure', async () => {
  mockTimestreamHandler.write.mockRejectedValue('Failure');
  const records = createMockRecord(1);
  const event = {
    Records: records.map(record => ({
      kinesis: {
        data: Buffer.from(JSON.stringify(record)).toString('base64')
      }
    }))
  };

  await handler(event);
  expect(mockTimestreamHandler.write).toHaveBeenCalledTimes(1);
  expect(mockTimestreamHandler.write).toHaveBeenCalledWith({
    databaseName: 'mock-timestream-database',
    records: records.map(record => parseToTimestream(record)),
    tableName: 'mock-timestream-table'
  });
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[timestream-putter]',
    'Error occurred while storing data into Timestream: ',
    'Failure'
  );
});
