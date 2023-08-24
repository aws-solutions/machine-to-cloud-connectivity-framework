// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Aspects, DefaultStackSynthesizer } from 'aws-cdk-lib';
import {
  MachineToCloudConnectivityFrameworkProps,
  MachineToCloudConnectivityFrameworkStack
} from '../lib/machine-to-cloud-connectivity-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

/**
 * Gets the solution props from the environment variables.
 * @returns The solution props
 */
function getProps(): MachineToCloudConnectivityFrameworkProps {
  const { BUCKET_NAME_PLACEHOLDER, SOLUTION_NAME_PLACEHOLDER, VERSION_PLACEHOLDER } = process.env;

  if (typeof BUCKET_NAME_PLACEHOLDER !== 'string' || BUCKET_NAME_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: BUCKET_NAME_PLACEHOLDER');
  }

  if (typeof SOLUTION_NAME_PLACEHOLDER !== 'string' || SOLUTION_NAME_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: SOLUTION_NAME_PLACEHOLDER');
  }

  if (typeof VERSION_PLACEHOLDER !== 'string' || VERSION_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: BUCKET_NAME_PLACEHOLDER');
  }

  const solutionBucketName = BUCKET_NAME_PLACEHOLDER;
  const solutionId = 'SO0070';
  const solutionName = SOLUTION_NAME_PLACEHOLDER;
  const solutionVersion = VERSION_PLACEHOLDER;
  const description = `(${solutionId}) - ${solutionName} Version ${solutionVersion}`;

  return {
    description,
    solutionBucketName,
    solutionId,
    solutionName,
    solutionVersion
  };
}

const app = new App();
new MachineToCloudConnectivityFrameworkStack(app, 'Stack', {
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  ...getProps()
});
Aspects.of(app).add(new AwsSolutionsChecks());
