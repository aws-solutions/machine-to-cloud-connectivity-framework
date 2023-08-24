// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { SQSMessageConsumerConstruct } from '../lib/data-flow/sqs-message-consumer';

test('M2C2 SQS message consumer test', () => {
  const stack = new Stack();
  const sqsMessageConsumer = new SQSMessageConsumerConstruct(stack, 'TestSQSMessageConsumer', {
    solutionConfig: {
      loggingLevel: 'ERROR',
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      sourceCodeBucket: Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region'),
      sourceCodePrefix: 'v0.0.1-test/machine-to-cloud-connectivity-framework'
    }
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(sqsMessageConsumer.logsTable).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::DynamoDB::Table', {
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
