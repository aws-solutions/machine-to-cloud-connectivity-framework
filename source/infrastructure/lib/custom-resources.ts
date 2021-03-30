// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Aws,
  CfnCondition,
  CfnCustomResource,
  CfnMapping,
  Construct,
  CustomResource,
  Duration
} from '@aws-cdk/core';
import { Policy, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { CfnFunction, Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';

/**
 * CustomResourcesConstruct props
 */
export interface CustomResourcesConstructProps {
  /**
   * Policy for CloudWatch Logs
   */
  readonly cloudWatchLogsPolicy: Policy;
  /**
   * Existing Greengrass group ID
   */
  readonly existingGreengrassGroup: string;
  /**
   * Existing Kinesis Data Stream name
   */
  readonly existingKinesisStream: string;
  /**
   * Condition for sending anonymous usage
   */
  readonly sendAnonymousUsageCondition: CfnCondition;
  /**
   * Mapping for the source code
   */
  readonly sourceCodeMapping: CfnMapping;
  /**
   * Mapping for the solution information
   */
  readonly solutionMapping: CfnMapping;
}

/**
 * Machine to Cloud Connectivity Framework Custom Resources
 */
export class CustomResourcesConstruct extends Construct {
  // Solution UUID
  private uuid: string;

  constructor(scope: Construct, id: string, props: CustomResourcesConstructProps) {
    super(scope, id);

    const helperFunctionRole = new Role(this, 'HelperFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/'
    });
    helperFunctionRole.attachInlinePolicy(props.cloudWatchLogsPolicy);

    const helperFunction = new Function(this, 'HelperFunction', {
      description: 'Machine to Cloud Connectivity custom resource function',
      handler: 'm2c2_helper_custom_resource.handler',
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromBucket(
        Bucket.fromBucketName(this, 'SourceCodeBucket', `${props.sourceCodeMapping.findInMap('General', 'S3Bucket')}-${Aws.REGION}`),
        `${props.sourceCodeMapping.findInMap('General', 'KeyPrefix')}/m2c2-helper.zip`
      ),
      timeout: Duration.seconds(240),
      role: helperFunctionRole,
      environment: {
        SOLUTION_ID: props.solutionMapping.findInMap('Parameters', 'Id'),
        SOLUTION_VERSION: props.solutionMapping.findInMap('Parameters', 'Version'),
      }
    });
    const cfnFunction = helperFunction.node.defaultChild as CfnFunction;
    cfnFunction.addMetadata('cfn_nag', {
      rules_to_suppress: [
        { id: 'W58', reason: 'Miss alarm, and the function does have permission to write CloudWatch Logs.' }
      ]
    });

    const customUuid = new CustomResource(this, 'UUID', {
      serviceToken: helperFunction.functionArn,
      properties: {
        Resource: 'CreateUUID'
      }
    });
    this.uuid = customUuid.getAtt('UUID').toString();

    const sendAnonymousMetrics = new CustomResource(this, 'SendAnonymousMetrics', {
      serviceToken: helperFunction.functionArn,
      properties: {
        Resource: 'SendAnonymousMetrics',
        SolutionId: props.solutionMapping.findInMap('Parameters', 'Id'),
        UUID: this.uuid,
        Version: props.solutionMapping.findInMap('Parameters', 'Version'),
        Region: Aws.REGION,
        ExistingGreengrassGroup: props.existingGreengrassGroup,
        ExistingKinesisStream: props.existingGreengrassGroup
      }
    });
    const cfnSendAnonymousMetrics = sendAnonymousMetrics.node.defaultChild as CfnCustomResource;
    cfnSendAnonymousMetrics.cfnOptions.condition = props.sendAnonymousUsageCondition;
  }

  /**
   * Get solution UUID.
   * @return {string} UUID
   */
  getUuid(): string {
    return this.uuid;
  }
}