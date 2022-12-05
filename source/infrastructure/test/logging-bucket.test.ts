// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnCondition, Stack } from 'aws-cdk-lib';
import { LoggingBucketConstruct } from '../lib/common-resource/logging-bucket';

test('M2C2 logging bucket test', () => {
  const stack = new Stack();
  const loggingBucket = new LoggingBucketConstruct(stack, 'LoggingBucket');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(loggingBucket.s3LoggingBucket).toBeDefined();
});
