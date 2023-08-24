// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ArnFormat, Stack, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Creates a common CloudWatch Logs policy for Lambda functions.
 */
export class CloudwatchLogsPolicyConstruct extends Construct {
  public policy: iam.PolicyDocument;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
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
