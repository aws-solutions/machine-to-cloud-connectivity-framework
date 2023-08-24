// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App } from 'aws-cdk-lib';
import { MachineToCloudConnectivityFrameworkStack } from '../lib/machine-to-cloud-connectivity-stack';

test('M2C2 stack test', () => {
  const solutionId = 'SO0070';
  const solutionBucketName = 'test-bucket';
  const solutionName = 'machine-to-cloud-connectivity-framework';
  const solutionVersion = 'vTest';

  const app = new App();
  const stack = new MachineToCloudConnectivityFrameworkStack(app, 'TestStack', {
    description: `(${solutionId}) - ${solutionName} Version ${solutionVersion}`,
    solutionBucketName,
    solutionId,
    solutionName,
    solutionVersion
  });

  expect(stack).toBeDefined();
});
