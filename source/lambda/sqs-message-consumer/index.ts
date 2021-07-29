// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import { MessageConsumerTypes } from '../lib/types';
import { getAwsSdkOptions } from '../lib/utils';

const dynamoDb = new DocumentClient(getAwsSdkOptions());
const { LOGGING_LEVEL, LOGS_DYNAMODB_TABLE } = process.env;
const BATCH_WRITE_MAX = 25;
const logger = new Logger('sqs-message-consumer', LOGGING_LEVEL);

/**
 * The Lambda function consumes the IoT topic messages in the SQS queue.
 * @param event Logs from the SQS queue
 */
exports.handler = async (event: MessageConsumerTypes.EventMessage): Promise<void> => {
  logger.log(LoggingLevel.DEBUG, `Event: ${JSON.stringify(event, null, 2)}`);

  const { Records } = event;
  let batchItems: MessageConsumerTypes.BatchPutRequest[] = [];

  // DynamoDB TTL - a week after now
  const ttlDate = new Date();
  ttlDate.setDate(ttlDate.getDate() + 7);
  const ttl = Math.floor(ttlDate.getTime() / 1000);

  while (Records.length > 0) {
    Records.splice(0, BATCH_WRITE_MAX).forEach((record: MessageConsumerTypes.SqsRecord) => {
      try {
        checkMessageRecordValidation(record);
        const body: any = JSON.parse(record.body);
        const { connectionName, timestamp, logType } = body;

        delete body.connectionName;
        delete body.timestamp;
        delete body.logType;

        const item: MessageConsumerTypes.RecordBody = {
          connectionName,
          timestamp,
          logType,
          message: JSON.stringify(body, null, 2),
          ttl: ttl
        };

        batchItems.push({
          PutRequest: { Item: item }
        });
      } catch (error) {
        logger.log(LoggingLevel.ERROR, `Error to parse the record: ${JSON.stringify(record)}`);
        logger.log(LoggingLevel.ERROR, 'Error: ', error);
      }
    });

    if (batchItems.length > 0) {
      try {
        const batchResult = await dynamoDb.batchWrite({
          RequestItems: { [LOGS_DYNAMODB_TABLE]: batchItems }
        }).promise();

        if (batchResult.UnprocessedItems &&
          batchResult.UnprocessedItems[LOGS_DYNAMODB_TABLE] &&
          batchResult.UnprocessedItems[LOGS_DYNAMODB_TABLE].length > 0) {
          logger.log(LoggingLevel.WARN, `Items were unprocessed: ${JSON.stringify(batchResult.UnprocessedItems[LOGS_DYNAMODB_TABLE])}`);
        }
      } catch (error) {
        logger.log(LoggingLevel.ERROR, `Error to batchWrite the DynamoDB items: ${JSON.stringify(batchItems)}`);
        logger.log(LoggingLevel.ERROR, 'Error: ', error);
      }
    }

    batchItems = [];
  }
}

/**
 * Checks if the message record is valid.
 * @param record The message record
 */
function checkMessageRecordValidation(record: MessageConsumerTypes.SqsRecord) {
  const body: any = JSON.parse(record.body);
  const { connectionName, timestamp, logType } = body;

  if (!connectionName || !timestamp || !logType) {
    logger.log(LoggingLevel.ERROR, `Required values are missing: [connectionName]: ${connectionName}, [timestamp]: ${timestamp}, [logType]: ${logType}`);
    throw new LambdaError({
      message: `Required values are missing: [connectionName]: ${connectionName}, [timestamp]: ${timestamp}, [logType]: ${logType}`,
      name: 'MessageConsumerError',
      statusCode: 400
    });
  }
}