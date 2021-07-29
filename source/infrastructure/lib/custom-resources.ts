// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnCustomResource, Construct, CustomResource, Duration } from '@aws-cdk/core';
import {
  CfnPolicy,
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal
} from '@aws-cdk/aws-iam';
import { CfnFunction, Code, Function as LambdaFunction, Runtime } from '@aws-cdk/aws-lambda';
import { IBucket } from '@aws-cdk/aws-s3';
import { addCfnSuppressRules } from '../utils/utils';

/**
 * CustomResourcesConstruct props
 * @interface CustomResourcesConstructProps
 */
export interface CustomResourcesConstructProps {
  // Policy for CloudWatch Logs
  readonly cloudWatchLogsPolicy: Policy;
  // Existing Greengrass group ID
  readonly existingGreengrassGroup: string;
  // Existing Kinesis Data Stream name
  readonly existingKinesisStream: string;
  // Condition for sending anonymous usage
  readonly sendAnonymousUsageCondition: CfnCondition;
  // Solution config properties: Logging level, solution ID, version, source code bucket, and source code prefix
  readonly solutionConfig: {
    loggingLevel: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
}

/**
 * Custom resource setup UI props
 * @interface CustomResourceSetupUiProps
 */
interface CustomResourceSetupUiProps {
  // API endpoint
  apiEndpoint: string;
  // Cognito identity pool ID
  identityPoolId: string;
  // UI logging level
  loggingLevel: string;
  // UI bucket
  uiBucket: IBucket;
  // Cognito user pool ID
  userPoolId: string;
  // Cognito user pool web client ID
  webClientId: string;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework Custom Resources Construct.
 * It creates a custom resource Lambda function, a solution UUID, and a custom resource to send anonymous usage.
 */
export class CustomResourcesConstruct extends Construct {
  // Custom resource helper function
  public helperFunction: LambdaFunction;
  // Custom resource helper function role
  public helperFunctionRole: Role;
  // IoT endpoint address
  public iotEndpointAddress: string;
  // Source code bucket
  private sourceCodeBucket: IBucket;
  // Source code prefix
  private sourceCodePrefix: string;
  // Solution UUID
  public uuid: string;

  constructor(scope: Construct, id: string, props: CustomResourcesConstructProps) {
    super(scope, id);

    this.sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    this.sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    this.helperFunctionRole = new Role(this, 'HelperFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        'GreengrassIoTPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['iot:DescribeEndpoint'],
              resources: ['*']
            })
          ]
        })
      }
    });
    this.helperFunctionRole.attachInlinePolicy(props.cloudWatchLogsPolicy);
    addCfnSuppressRules(this.helperFunctionRole, [
      { id: 'W11', reason: 'iot:DescribeEndpoint cannot specify the resource.' }
    ]);

    this.helperFunction = new LambdaFunction(this, 'HelperFunction', {
      description: 'Machine to Cloud Connectivity custom resource function',
      handler: 'custom-resource/index.handler',
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromBucket(this.sourceCodeBucket, `${this.sourceCodePrefix}/custom-resource.zip`),
      timeout: Duration.seconds(240),
      role: this.helperFunctionRole,
      environment: {
        LOGGING_LEVEL: props.solutionConfig.loggingLevel,
        SOLUTION_ID: props.solutionConfig.solutionId,
        SOLUTION_VERSION: props.solutionConfig.solutionVersion
      }
    });
    (this.helperFunction.node.defaultChild as CfnFunction).addDependsOn(props.cloudWatchLogsPolicy.node.defaultChild as CfnPolicy);

    const customUuid = new CustomResource(this, 'UUID', {
      serviceToken: this.helperFunction.functionArn,
      properties: {
        Resource: 'CreateUUID'
      }
    });
    this.uuid = customUuid.getAtt('UUID').toString();

    const sendAnonymousMetrics = new CustomResource(this, 'SendAnonymousMetrics', {
      serviceToken: this.helperFunction.functionArn,
      properties: {
        Resource: 'SendAnonymousMetrics',
        ExistingGreengrassGroup: props.existingGreengrassGroup,
        ExistingKinesisStream: props.existingKinesisStream,
        SolutionUUID: this.uuid
      }
    });
    const cfnSendAnonymousMetrics = sendAnonymousMetrics.node.defaultChild as CfnCustomResource;
    cfnSendAnonymousMetrics.cfnOptions.condition = props.sendAnonymousUsageCondition;

    const describeIoTEndpoint = new CustomResource(this, 'DescribeIoTEndpoint', {
      serviceToken: this.helperFunction.functionArn,
      properties: {
        Resource: 'DescribeIoTEndpoint'
      }
    });
    this.iotEndpointAddress = describeIoTEndpoint.getAtt('IOT_ENDPOINT').toString();
  }

  /**
   * Sets up the UI assets and UI configuration.
   * @param props Custom resource setup UI props
   */
  public setupUi(props: CustomResourceSetupUiProps) {
    this.sourceCodeBucket.grantRead(this.helperFunction, `${this.sourceCodePrefix}/*`);
    props.uiBucket.grantPut(this.helperFunction);

    new CustomResource(this, 'CopyUiAssets', { // NOSONAR: typescript:S1848
      serviceToken: this.helperFunction.functionArn,
      properties: {
        Resource: 'CopyUIAssets',
        DestinationBucket: props.uiBucket.bucketName,
        ManifestFile: 'manifest.json',
        SourceBucket: this.sourceCodeBucket.bucketName,
        SourcePrefix: this.sourceCodePrefix
      }
    });

    new CustomResource(this, 'CreateUiConfig', { // NOSONAR: typescript:S1848
      serviceToken: this.helperFunction.functionArn,
      properties: {
        Resource: 'CreateUIConfig',
        ApiEndpoint: props.apiEndpoint,
        ConfigFileName: 'aws-exports.js',
        DestinationBucket: props.uiBucket.bucketName,
        IdentityPoolId: props.identityPoolId,
        LoggingLevel: props.loggingLevel,
        UserPoolId: props.userPoolId,
        WebClientId: props.webClientId
      }
    });
  }
}