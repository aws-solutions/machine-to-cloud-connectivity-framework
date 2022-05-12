// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IotToSqs, IotToSqsProps } from '@aws-solutions-constructs/aws-iot-sqs';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { SqsToLambda } from '@aws-solutions-constructs/aws-sqs-lambda';
import { CfnDeletionPolicy, Duration } from 'aws-cdk-lib';
import { AttributeType, CfnTable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface SQSMessageConsumerConstructProps {
  readonly solutionConfig: {
    loggingLevel: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
}

/**
 * Creates a message SQS queue, a message consumer Lambda function, a logs DynamoDB tables, and IoT rules.
 */
export class SQSMessageConsumerConstruct extends Construct {
  public logsTable: Table;
  private readonly sql: string = `SELECT topic(3) as connectionName, topic(2) as logType, timestamp() as timestamp, * FROM 'm2c2/{type}/+'`;

  constructor(scope: Construct, id: string, props: SQSMessageConsumerConstructProps) {
    super(scope, id);

    const sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    const sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    const sqsToLambda = new SqsToLambda(this, 'SQSMessageConsumer', {
      lambdaFunctionProps: {
        code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/sqs-message-consumer.zip`),
        description: 'Machine to Cloud Connectivity SQS message consumer function',
        environment: {
          LOGGING_LEVEL: props.solutionConfig.loggingLevel,
          SOLUTION_ID: props.solutionConfig.solutionId,
          SOLUTION_VERSION: props.solutionConfig.solutionVersion
        },
        handler: 'sqs-message-consumer/index.handler',
        retryAttempts: 0,
        runtime: Runtime.NODEJS_14_X,
        timeout: Duration.minutes(1)
      },
      queueProps: {
        visibilityTimeout: Duration.minutes(1)
      },
      maxReceiveCount: 3
    });

    const lambdaToDynamoDb = new LambdaToDynamoDB(this, 'LogsDynamoDB', {
      existingLambdaObj: sqsToLambda.lambdaFunction,
      dynamoTableProps: {
        partitionKey: {
          name: 'connectionName',
          type: AttributeType.STRING
        },
        sortKey: {
          name: 'timestamp',
          type: AttributeType.NUMBER
        },
        timeToLiveAttribute: 'ttl'
      },
      tableEnvironmentVariableName: 'LOGS_DYNAMODB_TABLE'
    });
    this.logsTable = lambdaToDynamoDb.dynamoTable;

    const cfnDynamoTable = <CfnTable>this.logsTable.node.defaultChild;
    cfnDynamoTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;

    const infoLogsProps: IotToSqsProps = {
      existingQueueObj: sqsToLambda.sqsQueue,
      iotTopicRuleProps: {
        topicRulePayload: {
          actions: [],
          awsIotSqlVersion: '2016-03-23',
          description: 'Processing connection info logs',
          sql: this.sql.replace('{type}', 'info')
        }
      }
    };
    new IotToSqs(this, 'InfoLogsRule', infoLogsProps);

    const errorLogsProps: IotToSqsProps = {
      existingQueueObj: sqsToLambda.sqsQueue,
      iotTopicRuleProps: {
        topicRulePayload: {
          actions: [],
          awsIotSqlVersion: '2016-03-23',
          description: 'Processing connection error logs',
          sql: this.sql.replace('{type}', 'error')
        }
      }
    };
    new IotToSqs(this, 'ErrorLogsRule', errorLogsProps);

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      sqsToLambda,
      [
        { id: 'AwsSolutions-IAM5', reason: 'It does not allow wildcard permissions' },
        { id: 'AwsSolutions-SQS3', reason: 'deadLetterQueue is the dead letter queue.' }
      ],
      true
    );
  }
}
