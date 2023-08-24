// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { CommonResourcesConstruct } from '../lib/common-resource/common-resources';

test('M2C2 common resources test', () => {
  const stack = new Stack();
  const commonResources = new CommonResourcesConstruct(stack, 'TestCommonResources', {
    sourceCodeBucket: 'test-bucket-region'
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(commonResources.cloudWatchLogsPolicy).toBeDefined();
  expect(commonResources.s3LoggingBucket).toBeDefined();
  expect(commonResources.sourceCodeBucket).toBeDefined();
});
