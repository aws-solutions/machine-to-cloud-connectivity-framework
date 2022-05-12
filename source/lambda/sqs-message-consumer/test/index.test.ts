// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, consoleWarnSpy, mockBatchWrite } from './mock';
import { handler } from '../index';
import { BatchPutRequest, EventMessage, SqsRecord } from '../../lib/types/message-consumer-types';
import { LogType } from '../../lib/types/solution-common-types';

type MockBody = {
  message: string;
  connectionName?: string;
  logType?: LogType;
  timestamp?: number;
};

const mockNowTime = 1620141782000;
const mockAWeekAfter = Math.floor((mockNowTime + 7 * 24 * 60 * 60 * 1000) / 1000);
const BATCH_NUMBER = 25;

/**
 * Creates mock event messages.
 * @param loop The number of event messages
 * @param body Body of the message
 * @returns Mock event messages
 */
function createMockEvent(loop: number, body?: string): EventMessage {
  const records: SqsRecord[] = [];

  for (let i = 0; i < loop; i++) {
    const logType = i % 2 === 0 ? LogType.INFO : LogType.ERROR;

    records.push({
      messageId: 'mock-id',
      receiptHandle: 'mock',
      body: body
        ? body
        : JSON.stringify({
            connectionName: `${i}`,
            timestamp: mockNowTime,
            logType,
            message: 'A message for you.'
          }),
      attributes: {
        ApproximateReceiveCount: 'mock',
        SentTimestamp: 'mock',
        SenderId: 'mock',
        ApproximateFirstReceiveTimestamp: 'mock'
      },
      messageAttributes: {},
      md5OfBody: 'mock',
      eventSource: 'mock',
      eventSourceARN: 'mock',
      awsRegion: 'mock'
    });
  }

  return { Records: records };
}

/**
 * Creates mock DynamoDB put requests.
 * @param loop The number of batch put requests
 * @returns Mock DynamoDB put requests
 */
function mockDynamoDbPutRequest(loop: number): BatchPutRequest[] {
  const mockBatchPutRequests: BatchPutRequest[] = [];

  for (let i = 0; i < loop; i++) {
    mockBatchPutRequests.push({
      PutRequest: {
        Item: {
          connectionName: `${i}`,
          timestamp: mockNowTime,
          logType: i % 2 === 0 ? LogType.INFO : LogType.ERROR,
          message: JSON.stringify({ message: 'A message for you.' }, null, 2),
          ttl: mockAWeekAfter
        }
      }
    });
  }

  return mockBatchPutRequests;
}

beforeEach(() => {
  mockBatchWrite.mockReset();
  consoleWarnSpy.mockReset();
  consoleErrorSpy.mockReset();
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date(mockNowTime));
});

test('Test a single SQS record', async () => {
  mockBatchWrite.mockImplementationOnce(() => ({
    promise() {
      return Promise.resolve({});
    }
  }));

  const eventNumber = 1;
  const event = createMockEvent(eventNumber);
  await handler(event);

  expect(mockBatchWrite).toBeCalledTimes(Math.ceil(eventNumber / BATCH_NUMBER));
  expect(mockBatchWrite).toBeCalledWith({
    RequestItems: {
      [process.env.LOGS_DYNAMODB_TABLE]: mockDynamoDbPutRequest(eventNumber)
    }
  });
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).not.toBeCalled();
});

test('Test more than 25 SQS records', async () => {
  mockBatchWrite.mockImplementation(() => ({
    promise() {
      return Promise.resolve({});
    }
  }));

  const eventNumber = 26;
  const event = createMockEvent(eventNumber);
  await handler(event);

  const expectedCalledTime = Math.ceil(eventNumber / BATCH_NUMBER);
  const mockDynamoDbPutRequests = mockDynamoDbPutRequest(eventNumber);
  expect(mockBatchWrite).toBeCalledTimes(expectedCalledTime);

  for (let i = 0; i < expectedCalledTime; i++) {
    expect(mockBatchWrite).toHaveBeenNthCalledWith(i + 1, {
      RequestItems: {
        [process.env.LOGS_DYNAMODB_TABLE]: mockDynamoDbPutRequests.splice(0, BATCH_NUMBER)
      }
    });
  }

  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).not.toBeCalled();
});

test('Test error while parsing JSON', async () => {
  const eventNumber = 1;
  const event = createMockEvent(eventNumber, 'parsing error');
  const mockRecord = event.Records[0];
  await handler(event);

  expect(mockBatchWrite).not.toBeCalled();
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    1,
    '[sqs-message-consumer]',
    `Error to parse the record: ${JSON.stringify(mockRecord)}`
  );
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    2,
    '[sqs-message-consumer]',
    'Error: ',
    SyntaxError('Unexpected token p in JSON at position 0')
  );
});

test('Test error when connectionName is missing from the record', async () => {
  const eventNumber = 1;
  const mockBody: MockBody = {
    timestamp: mockNowTime,
    logType: LogType.INFO,
    message: 'connectionName is missing'
  };
  const event = createMockEvent(eventNumber, JSON.stringify(mockBody));
  const mockRecord = event.Records[0];
  await handler(event);

  expect(mockBatchWrite).not.toBeCalled();
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    1,
    '[sqs-message-consumer]',
    `Required values are missing: [connectionName]: ${mockBody.connectionName}, [timestamp]: ${mockBody.timestamp}, [logType]: ${mockBody.logType}`
  );
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    2,
    '[sqs-message-consumer]',
    `Error to parse the record: ${JSON.stringify(mockRecord)}`
  );
});

test('Test error when timestamp is missing from the record', async () => {
  const eventNumber = 1;
  const mockBody: MockBody = {
    connectionName: '1',
    logType: LogType.INFO,
    message: 'timestamp is missing'
  };
  const event = createMockEvent(eventNumber, JSON.stringify(mockBody));
  const mockRecord = event.Records[0];
  await handler(event);

  expect(mockBatchWrite).not.toBeCalled();
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    1,
    '[sqs-message-consumer]',
    `Required values are missing: [connectionName]: ${mockBody.connectionName}, [timestamp]: ${mockBody.timestamp}, [logType]: ${mockBody.logType}`
  );
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    2,
    '[sqs-message-consumer]',
    `Error to parse the record: ${JSON.stringify(mockRecord)}`
  );
});

test('Test error when logType is missing from the record', async () => {
  const eventNumber = 1;
  const mockBody: MockBody = {
    connectionName: '1',
    timestamp: mockNowTime,
    message: 'logType is missing'
  };
  const event = createMockEvent(eventNumber, JSON.stringify(mockBody));
  const mockRecord = event.Records[0];
  await handler(event);

  expect(mockBatchWrite).not.toBeCalled();
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    1,
    '[sqs-message-consumer]',
    `Required values are missing: [connectionName]: ${mockBody.connectionName}, [timestamp]: ${mockBody.timestamp}, [logType]: ${mockBody.logType}`
  );
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    2,
    '[sqs-message-consumer]',
    `Error to parse the record: ${JSON.stringify(mockRecord)}`
  );
});

test('Test DynamoDB batchWrite unprocessed items', async () => {
  const eventNumber = 1;
  mockBatchWrite.mockImplementationOnce(() => ({
    promise() {
      return Promise.resolve({
        UnprocessedItems: {
          [process.env.LOGS_DYNAMODB_TABLE]: mockDynamoDbPutRequest(eventNumber)
        }
      });
    }
  }));

  const event = createMockEvent(eventNumber);
  await handler(event);

  expect(mockBatchWrite).toBeCalledTimes(Math.ceil(eventNumber / BATCH_NUMBER));
  expect(mockBatchWrite).toBeCalledWith({
    RequestItems: {
      [process.env.LOGS_DYNAMODB_TABLE]: mockDynamoDbPutRequest(eventNumber)
    }
  });
  expect(consoleWarnSpy).toBeCalledWith(
    '[sqs-message-consumer]',
    `Items were unprocessed: ${JSON.stringify(mockDynamoDbPutRequest(eventNumber))}`
  );
  expect(consoleErrorSpy).not.toBeCalled();
});

test('Test error while batch writing DynamoDB', async () => {
  mockBatchWrite.mockImplementationOnce(() => ({
    promise() {
      return Promise.reject('dynamodb:BatchWrite failed.');
    }
  }));

  const eventNumber = 1;
  const event = createMockEvent(eventNumber);
  await handler(event);

  expect(mockBatchWrite).toBeCalledTimes(Math.ceil(eventNumber / BATCH_NUMBER));
  expect(mockBatchWrite).toBeCalledWith({
    RequestItems: {
      [process.env.LOGS_DYNAMODB_TABLE]: mockDynamoDbPutRequest(eventNumber)
    }
  });
  expect(consoleWarnSpy).not.toBeCalled();
  expect(consoleErrorSpy).toBeCalledTimes(2);
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    1,
    '[sqs-message-consumer]',
    `Error to batchWrite the DynamoDB items: ${JSON.stringify(mockDynamoDbPutRequest(eventNumber))}`
  );
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(
    2,
    '[sqs-message-consumer]',
    'Error: ',
    'dynamodb:BatchWrite failed.'
  );
});
