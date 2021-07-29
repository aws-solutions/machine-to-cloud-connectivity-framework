// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnDeletionPolicy, Construct, Duration } from '@aws-cdk/core';
import { AttributeType, CfnTable, Table } from '@aws-cdk/aws-dynamodb';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { CfnTopicRule } from '@aws-cdk/aws-iot';
import { Code, Runtime } from '@aws-cdk/aws-lambda';
import { IBucket } from '@aws-cdk/aws-s3';
import { SqsToLambda } from '@aws-solutions-constructs/aws-sqs-lambda';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';

/**
 * SQSMessageConsumerConstruct props
 * @interface SQSMessageConsumerConstructProps
 */
export interface SQSMessageConsumerConstructProps {
  // Solution config properties: Logging level, solution ID, version, source code bucket, and source code prefix
  readonly solutionConfig: {
    loggingLevel: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
}

/**
 * @class
 * Machine to Cloud Connectivity Framework SQS Message Consumer Construct.
 * It creates a message SQS queue, a message consumer Lambda function, a logs DynamoDB tables, and IoT rules.
 */
export class SQSMessageConsumerConstruct extends Construct {
  // Logs DynamoDB table
  public logsTable: Table;
  // The IoT rule SQL
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

    const cfnDynamoTable = this.logsTable.node.defaultChild as CfnTable;
    cfnDynamoTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;

    // Info and error logs rule
    const sqsSendRole = new Role(this, 'IoTRuleSQSRole', {
      assumedBy: new ServicePrincipal('iot.amazonaws.com'),
      path: '/service-role/',
      inlinePolicies: {
        'IoTRuleSQSPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [sqsToLambda.sqsQueue.queueArn]
            })
          ]
        })
      }
    });
    new CfnTopicRule(this, 'InfoLogsRule', { // NOSONAR: typescript:S1848
      topicRulePayload: {
        actions: [{
          sqs: {
            roleArn: sqsSendRole.roleArn,
            queueUrl: sqsToLambda.sqsQueue.queueUrl
          }
        }],
        awsIotSqlVersion: '2016-03-23',
        description: 'Processing info logs from the edge device Lambda functions',
        ruleDisabled: false,
        sql: this.sql.replace('{type}', 'info')
      }
    });
    new CfnTopicRule(this, 'ErrorLogsRule', { // NOSONAR: typescript:S1848
      topicRulePayload: {
        actions: [{
          sqs: {
            roleArn: sqsSendRole.roleArn,
            queueUrl: sqsToLambda.sqsQueue.queueUrl
          }
        }],
        awsIotSqlVersion: '2016-03-23',
        description: 'Processing error logs from the edge device Lambda functions',
        ruleDisabled: false,
        sql: this.sql.replace('{type}', 'error')
      }
    });
  }
}