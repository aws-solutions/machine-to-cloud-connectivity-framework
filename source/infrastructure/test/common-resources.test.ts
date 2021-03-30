// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/core';
import { CommonResourcesConstruct } from '../lib/common-resources';

test('M2C2 common resources snapshot and private variables', () => {
  const stack = new Stack();
  const commonResources = new CommonResourcesConstruct(stack, 'TestCommonResources');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(commonResources.getCloudWatchLogsPolicy()).toBeDefined();
  expect(commonResources.getS3LoggingBucket()).toBeDefined();
  expect(commonResources.getS3Bucket()).toBeDefined();
  expect(commonResources.getS3BucketName()).toBeDefined();
});