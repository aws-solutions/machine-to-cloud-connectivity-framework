// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { SourceBucketConstruct } from '../lib/common-resource/source-bucket';

test('M2C2 source bucket test', () => {
  const stack = new Stack();
  const sourceBucket = new SourceBucketConstruct(stack, 'LoggingBucket', {
    sourceCodeBucketName: 'test-name'
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(sourceBucket.sourceCodeBucket).toBeDefined();
});
