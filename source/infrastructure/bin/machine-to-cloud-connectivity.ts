// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Aspects, DefaultStackSynthesizer } from 'aws-cdk-lib';
import {
  MachineToCloudConnectivityFrameworkProps,
  MachineToCloudConnectivityFrameworkStack
} from '../lib/machine-to-cloud-connectivity-stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { AppRegistry } from '../lib/app-registry/app-registry';
import * as crypto from 'crypto';

/**
 * Gets the solution props from the environment variables.
 * @returns The solution props
 */
function getProps(): MachineToCloudConnectivityFrameworkProps {
  const {
    BUCKET_NAME_PLACEHOLDER,
    SOLUTION_NAME_PLACEHOLDER,
    VERSION_PLACEHOLDER,
    SHOULD_SEND_ANONYMOUS_METRICS,
    SHOULD_TEARDOWN_DATA_ON_DESTROY
  } = process.env;

  if (typeof BUCKET_NAME_PLACEHOLDER !== 'string' || BUCKET_NAME_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: BUCKET_NAME_PLACEHOLDER');
  }

  if (typeof SOLUTION_NAME_PLACEHOLDER !== 'string' || SOLUTION_NAME_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: SOLUTION_NAME_PLACEHOLDER');
  }

  if (typeof VERSION_PLACEHOLDER !== 'string' || VERSION_PLACEHOLDER.trim() === '') {
    throw new Error('Missing required environment variable: BUCKET_NAME_PLACEHOLDER');
  }

  if (typeof SHOULD_SEND_ANONYMOUS_METRICS !== 'string' || SHOULD_SEND_ANONYMOUS_METRICS.trim() === '') {
    throw new Error('Missing required environment variable: SHOULD_SEND_ANONYMOUS_METRICS');
  }

  if (typeof SHOULD_TEARDOWN_DATA_ON_DESTROY !== 'string' || SHOULD_TEARDOWN_DATA_ON_DESTROY.trim() === '') {
    throw new Error('Missing required environment variable: SHOULD_TEARDOWN_DATA_ON_DESTROY');
  }

  const solutionBucketName = BUCKET_NAME_PLACEHOLDER;
  const solutionId = 'SO0070';
  const solutionName = SOLUTION_NAME_PLACEHOLDER;
  const solutionVersion = VERSION_PLACEHOLDER;
  const shouldSendAnonymousMetrics = SHOULD_SEND_ANONYMOUS_METRICS;
  const shouldTeardownDataOnDestroy = SHOULD_TEARDOWN_DATA_ON_DESTROY;
  const description = `(${solutionId}) - ${solutionName}. Version ${solutionVersion}`;

  return {
    description,
    solutionBucketName,
    solutionId,
    solutionName,
    solutionVersion,
    shouldSendAnonymousMetrics,
    shouldTeardownDataOnDestroy
  };
}

const appProps = getProps();
const app = new App();
const m2c2Stack = new MachineToCloudConnectivityFrameworkStack(app, 'Stack', {
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  ...appProps
});
Aspects.of(app).add(new AwsSolutionsChecks());
const hash = crypto.createHash('sha256').update(m2c2Stack.stackName).digest('hex');
Aspects.of(m2c2Stack).add(
  new AppRegistry(m2c2Stack, `AppRegistry-${hash}`, {
    solutionID: appProps.solutionId
  })
);
