// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { Stack, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { ConnectionBuilderConstruct } from '../lib/backend/connection-builder';

test('M2C2 connection builder test', () => {
  const stack = new Stack();
  const cloudWatchLogsPolicy = new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ['logs:*'],
        actions: ['*']
      })
    ]
  });

  const greengrassResourceBucket = s3.Bucket.fromBucketName(stack, 'GreengrassResourceBucket', 'greengrass-bucket');
  const iotCertificateArn = 'arn:of:certificate';
  const iotEndpointAddress = 'https://iot.amazonaws.com';
  const kinesisStreamName = 'test-kinesis-stream';
  const kinesisStreamForTimestreamName = 'test-kinesis-stream-for-timestream';
  const loggingLevel = 'ERROR';
  const logsTableArn = 'arn:of:logs:dynamodb:table';
  const logsTableName = 'test-logs-table';
  const collectorId = 'test-collector-id';
  const sendAnonymousUsage = 'Yes';
  const solutionId = 'SO0070-Test';
  const solutionVersion = 'v0.0.1-test';
  const sourceCodeBucket = s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region');
  const sourceCodePrefix = 'v0.0.1-test/machine-to-cloud-connectivity-framework';
  const uuid = 'test-uuid';

  const connectionBuilder = new ConnectionBuilderConstruct(stack, 'TestConnectionBuilder', {
    cloudWatchLogsPolicy,
    greengrassResourceBucket,
    iotCertificateArn,
    iotEndpointAddress,
    kinesisStreamName,
    kinesisStreamForTimestreamName,
    logsTableArn,
    logsTableName,
    collectorId,
    solutionConfig: {
      loggingLevel,
      sendAnonymousUsage,
      solutionId,
      solutionVersion,
      sourceCodeBucket,
      sourceCodePrefix,
      uuid
    }
  });

  expect(connectionBuilder.connectionBuilderLambdaFunction).toBeDefined();
  expect(connectionBuilder.connectionTableName).toBeDefined();
  Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'connectionName',
        KeyType: 'HASH'
      }
    ]
  });
  Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'name',
        KeyType: 'HASH'
      }
    ]
  });
});
