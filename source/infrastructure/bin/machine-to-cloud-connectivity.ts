// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  App,
  Aspects,
  CfnResource,
  IAspect,
  IConstruct
} from '@aws-cdk/core';
import { CfnFunction } from '@aws-cdk/aws-lambda';
import { M2C2Stack } from '../lib/machine-to-cloud-connectivity-stack';
import { addCfnSuppressRules } from '../utils/utils';

/**
 * CDK Aspect implementation to add common metadata to suppress CFN rules
 */
class LambdaFunctionAspect implements IAspect {
  visit(node: IConstruct): void {
    const resource = node as CfnResource;
    if (resource instanceof CfnFunction) {

      const rules = [
        { id: 'W58', reason: 'The function does have permission to write CloudWatch Logs.' },
        { id: 'W89', reason: 'The Lambda function does not require any VPC connection at all.' }
      ];

      if (!resource.logicalId.includes('GreengrassDeployer')) {
        rules.push({ id: 'W92', reason: 'The Lambda function does not require ReservedConcurrentExecutions.' });
      }

      addCfnSuppressRules(resource, rules);
    }
  }
}

const app = new App();
const stack = new M2C2Stack(app, 'M2C2Stack', {
  description: '(SO0070) - The AWS cloud formation template for the deployment of SOLUTION_NAME_PLACEHOLDER. Version VERSION_PLACEHOLDER.'
});
Aspects.of(stack).add(new LambdaFunctionAspect());