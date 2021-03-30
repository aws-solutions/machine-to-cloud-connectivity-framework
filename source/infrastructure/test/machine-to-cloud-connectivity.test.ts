// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { App } from '@aws-cdk/core';
import { M2C2Stack } from '../lib/machine-to-cloud-connectivity-stack';

test('M2C2 stack test', () => {
  const app = new App();
  const stack = new M2C2Stack(app, 'TestM2C2Stack');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});