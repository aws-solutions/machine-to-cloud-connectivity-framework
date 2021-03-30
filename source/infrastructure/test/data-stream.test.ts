// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/core';
import { Bucket, CfnBucket } from '@aws-cdk/aws-s3';
import { DataStreamConstruct } from '../lib/data-stream';

test('M2C2 data stream test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  (s3LoggingBucket.node.defaultChild as CfnBucket).overrideLogicalId('TestLoggingBucket');
  const dataStream = new DataStreamConstruct(stack, 'TestDataStream', { s3LoggingBucket });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(dataStream.getKinesisStreamName()).toBeDefined();
  expect(dataStream.getS3BucketName()).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'm2c2data/'
    }
  });
});