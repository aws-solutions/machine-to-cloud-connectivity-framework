// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { Stack, aws_s3 as s3 } from 'aws-cdk-lib';
import { SQSMessageConsumerConstruct } from '../lib/data-flow/sqs-message-consumer';

test('M2C2 SQS message consumer test', () => {
  const stack = new Stack();
  const sqsMessageConsumer = new SQSMessageConsumerConstruct(stack, 'TestSQSMessageConsumer', {
    solutionConfig: {
      loggingLevel: 'ERROR',
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      sourceCodeBucket: s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region'),
      sourceCodePrefix: 'v0.0.1-test/machine-to-cloud-connectivity-framework'
    }
  });

  expect(sqsMessageConsumer.logsTable).toBeDefined();
  Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'connectionName',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'timestamp',
        KeyType: 'RANGE'
      }
    ],
    TimeToLiveSpecification: {
      AttributeName: 'ttl',
      Enabled: true
    }
  });
});
