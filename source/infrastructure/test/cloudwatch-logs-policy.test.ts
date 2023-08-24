// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { CloudwatchLogsPolicyConstruct } from '../lib/common-resource/cloudwatch-logs-policy';

test('M2C2 cloudwatch logs policy test', () => {
  const stack = new Stack();
  const cloudwatchLogsPolicy = new CloudwatchLogsPolicyConstruct(stack, 'TestCloudWatchLogsPolicy');

  expect(cloudwatchLogsPolicy.policy).toBeDefined();
});
