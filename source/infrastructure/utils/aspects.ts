// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnResource, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * CDK Aspect implementation to set up conditions to the entire Construct resources
 */
export class ConditionAspect implements IAspect {
  private readonly condition: CfnCondition;

  constructor(condition: CfnCondition) {
    this.condition = condition;
  }

  visit(node: IConstruct): void {
    const resource = <CfnResource>node;
    if (resource.cfnOptions) {
      resource.cfnOptions.condition = this.condition;
    }
  }
}
