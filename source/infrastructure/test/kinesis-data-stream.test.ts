// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { Stack, CfnCondition, aws_s3 as s3 } from 'aws-cdk-lib';
import { KinesisDataStreamConstruct } from '../lib/data-flow/kinesis-data-stream';

test('M2C2 data stream test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new s3.Bucket(stack, 'TestLoggingBucket');
  (<s3.CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const dataStream = new KinesisDataStreamConstruct(stack, 'TestKinesisDataStream', {
    s3LoggingBucket,
    customResourcesFunctionArn: '',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition'),
    shouldCreateKinesisResources: new CfnCondition(stack, 'TestCreateKinesisCondition')
  });

  expect(dataStream.kinesisStreamName).toBeDefined();
  expect(dataStream.dataBucketName).toBeDefined();
  Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'm2c2data/'
    }
  });
});
