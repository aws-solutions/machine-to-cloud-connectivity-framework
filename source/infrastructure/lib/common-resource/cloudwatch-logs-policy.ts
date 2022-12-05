// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ArnFormat, Stack } from 'aws-cdk-lib';
import { Effect, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Creates a common CloudWatch Logs policy for Lambda functions.
 */
export class CloudwatchLogsPolicyConstruct extends Construct {
  public policy: PolicyDocument;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.policy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: [
            Stack.of(this).formatArn({
              service: 'logs',
              resource: 'log-group',
              resourceName: '/aws/lambda/*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME
            })
          ]
        })
      ]
    });
  }
}
