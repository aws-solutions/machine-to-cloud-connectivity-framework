// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnOutput, CfnResource, Resource, Stack } from 'aws-cdk-lib';

interface CfnNagSuppressRule {
  id: string;
  reason: string;
}

/**
 * Adds CFN NAG suppress rules to the CDK resource.
 * @param resource The CDK resource
 * @param rules The CFN NAG suppress rules
 */
export function addCfnSuppressRules(resource: Resource | CfnResource, rules: CfnNagSuppressRule[]): void {
  if (resource instanceof Resource) {
    resource = <CfnResource>resource.node.defaultChild;
  }

  const cfnNagMetadata = resource.getMetadata('cfn_nag');

  if (cfnNagMetadata) {
    const existingRules = cfnNagMetadata.rules_to_suppress;

    if (Array.isArray(existingRules)) {
      for (const rule of existingRules) {
        if (typeof rules.find(newRule => newRule.id === rule.id) === 'undefined') {
          rules.push(rule);
        }
      }
    }
  }

  resource.addMetadata('cfn_nag', {
    rules_to_suppress: rules
  });
}

interface AddOutputRequest {
  id: string;
  description: string;
  value: string;
  condition?: CfnCondition;
}

/**
 * Adds outputs to the CloudFormation template.
 * @param stack The CDK stack
 * @param outputRequests The CloudFormation outputs
 */
export function addOutputs(stack: Stack, outputRequests: AddOutputRequest[]): void {
  for (const request of outputRequests) {
    const { id, description, value, condition } = request;

    new CfnOutput(stack, id, {
      description,
      value,
      condition
    });
  }
}
