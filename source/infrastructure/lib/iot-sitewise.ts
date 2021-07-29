// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CfnDeletionPolicy, Construct } from '@aws-cdk/core';
import { CfnGateway } from '@aws-cdk/aws-iotsitewise';

/**
 * IoTSitewiseConstructProps props
 * @interface IoTSitewiseConstructProps
 */
export interface IoTSitewiseConstructProps {
  // Greengrass group ID
  readonly greengrassGroupId: string;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework IoT Sitewise Construct.
 * It creates a common CloudWatch Logs policy for Lambda functions, a logging S3 bucket, and M2C2 S3 bucket.
 */
export class IoTSitewiseConstruct extends Construct {
  // IoT Sitewise gateway
  public iotSitewiseGateway: CfnGateway;

  constructor(scope: Construct, id: string, props: IoTSitewiseConstructProps) {
    super(scope, id);

    this.iotSitewiseGateway = new CfnGateway(this, 'Gateway', {
      gatewayName: `${Aws.STACK_NAME}-sitewise-gateway`,
      gatewayPlatform: {
        greengrass: {
          groupArn: `arn:${Aws.PARTITION}:greengrass:${Aws.REGION}:${Aws.ACCOUNT_ID}:/greengrass/groups/${props.greengrassGroupId}`
        }
      }
    });
    this.iotSitewiseGateway.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;
  }
}