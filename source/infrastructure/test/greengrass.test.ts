// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnCondition, Stack } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { GreengrassConstruct } from '../lib/greengrass/greengrass';

test('M2C2 greengrass resource creation test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  (<CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const greengrass = new GreengrassConstruct(stack, 'TestGreengrass', {
    kinesisStreamName: 'TestStream',
    s3LoggingBucket,
    solutionConfig: {
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      uuid: 'test-uuid'
    },
    timestreamKinesisStreamArn: 'arn:of:timestream:kinesis:stream',
    customResourcesFunctionArn: 'test-arn',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(greengrass.greengrassResourceBucket).toBeDefined();
  expect(greengrass.iotCredentialsRoleArn).toBeDefined();
  expect(greengrass.iotPolicyName).toBeDefined();
  expect(greengrass.iotRoleAliasName).toBeDefined();
});
