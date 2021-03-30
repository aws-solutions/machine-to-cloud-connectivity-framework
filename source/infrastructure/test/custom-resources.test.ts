// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnCondition, CfnMapping, Stack } from '@aws-cdk/core';
import { Policy } from '@aws-cdk/aws-iam';
import { CustomResourcesConstruct } from '../lib/custom-resources';

test('M2C2 custom resources test', () => {
  const stack = new Stack();
  const sourceCodeMapping = new CfnMapping(stack, 'SourceCode', {
    mapping: {
      General: {
        S3Bucket: 'Bucket',
        KeyPrefix: 'Prefix'
      }
    }
  });
  const solutionMapping = new CfnMapping(stack, 'Solution', {
    mapping: {
      Parameters: {
        Id: 'SolutionId',
        Version: 'SolutionVersion'
      }
    }
  });
  const cloudWatchLogsPolicy = new Policy(stack, 'TestCloudWatchLogsPolicy');

  const customResource = new CustomResourcesConstruct(stack, 'TestCustomResources', {
    cloudWatchLogsPolicy: cloudWatchLogsPolicy,
    existingKinesisStream: '',
    existingGreengrassGroup: '',
    sendAnonymousUsageCondition: new CfnCondition(stack, 'TestCondition'),
    sourceCodeMapping,
    solutionMapping
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(customResource.getUuid()).toBeDefined();
});