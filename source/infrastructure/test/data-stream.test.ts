// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { KinesisDataStreamConstruct } from '../lib/data-flow/kinesis-data-stream';

test('M2C2 data stream test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  (<CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const kinesisDataStream = new KinesisDataStreamConstruct(stack, 'TestKinesis', { s3LoggingBucket });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(kinesisDataStream.kinesisStreamName).toBeDefined();
  expect(kinesisDataStream.dataBucketName).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'm2c2data/'
    }
  });
});
