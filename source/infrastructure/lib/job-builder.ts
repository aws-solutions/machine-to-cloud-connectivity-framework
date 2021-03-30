// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Aws,
  CfnDeletionPolicy,
  CfnMapping,
  Construct,
  Duration
} from '@aws-cdk/core';
import { AttributeType, CfnTable } from '@aws-cdk/aws-dynamodb';
import {
  CfnPolicy,
  Effect,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal
} from '@aws-cdk/aws-iam';
import { CfnTopicRule } from '@aws-cdk/aws-iot';
import { Code, Runtime } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';

/**
 * JobBuilderConstruct props
 */
export interface JobBuilderConstructProps {
  /**
   * Policy for CloudWatch Logs
   */
  readonly cloudWatchLogsPolicy: Policy;
  /**
   * Greengrass group ID
   */
  readonly greengrassGroupId: string;
  /**
   * Kinesis Data Stream name
   */
  readonly kinesisStreamName: string;
  /**
   * S3 M2C2 bucket
   */
  readonly s3Bucket: Bucket;
  /**
   * S3 logging bucket
   */
  readonly s3LoggingBucket: Bucket;
  /**
   * Sending anonymous usage
   */
  readonly sendAnonymousUsage: string;
  /**
   * Mapping for the source code
   */
  readonly sourceCodeMapping: CfnMapping;
  /**
   * Mapping for the solution information
   */
  readonly solutionMapping: CfnMapping;
  /**
   * Solutions UUID
   */
  readonly uuid: string;
}

/**
 * Machine to Cloud Connectivity Framework Job Builder Lambda, DynamoDB, S3, and IoT rule
 */
export class JobBuilderConstruct extends Construct {
  // Job metadata DynamoDB table name
  private dynamodbTableName: string;

  constructor(scope: Construct, id: string, props: JobBuilderConstructProps) {
    super(scope, id);

    const sourceCodeBucket: string = `${props.sourceCodeMapping.findInMap('General', 'S3Bucket')}-${Aws.REGION}`;
    const sourceCodePrefix: string = props.sourceCodeMapping.findInMap('General', 'KeyPrefix');

    const connectorLambdaRole = new Role(this, 'ConnectorLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/'
    });
    connectorLambdaRole.attachInlinePolicy(props.cloudWatchLogsPolicy);

    const lambdaToDynamoDb = new LambdaToDynamoDB(this, 'JobBuilder', {
      lambdaFunctionProps: {
        code: Code.fromBucket(
          Bucket.fromBucketName(this, 'SourceCodeBucket', sourceCodeBucket),
          `${sourceCodePrefix}/m2c2-job-builder.zip`
        ),
        description: 'Machine to Cloud Connectivity job builder function',
        environment: {
          CONNECTOR_LAMBDA_ROLE: connectorLambdaRole.roleArn,
          GREENGRASS_ID: props.greengrassGroupId,
          JOB_BUILDER_BUCKET: props.s3Bucket.bucketName,
          JOB_BUILDER_KEY: props.solutionMapping.findInMap('Parameters', 'JobMetadataPrefix'),
          KINESIS_STREAM: props.kinesisStreamName,
          SEND_ANONYMOUS_METRIC: props.sendAnonymousUsage,
          SOLUTION_ID: props.solutionMapping.findInMap('Parameters', 'Id'),
          SOLUTION_VERSION: props.solutionMapping.findInMap('Parameters', 'Version'),
          SOURCE_S3_BUCKET: sourceCodeBucket,
          SOURCE_S3_PREFIX: sourceCodePrefix,
          UUID: props.uuid
        },
        handler: 'm2c2_job_builder_main.lambda_handler',
        runtime: Runtime.PYTHON_3_8,
        timeout: Duration.minutes(5)
      },
      dynamoTableProps: {
        partitionKey: {
          name: 'jobid',
          type: AttributeType.STRING
        },
        sortKey: {
          name: 'version',
          type: AttributeType.NUMBER
        }
      },
      tableEnvironmentVariableName: 'JOB_DYNAMODB_TABLE'
    });

    const cfnDynamoTable = lambdaToDynamoDb.dynamoTable.node.defaultChild as CfnTable;
    cfnDynamoTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;
    this.dynamodbTableName = lambdaToDynamoDb.dynamoTable.tableName;

    const jobBuilderPolicy = new Policy(this, 'JobBuilderPolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [ 's3:GetObject' ],
          resources: [ `arn:${Aws.PARTITION}:s3:::${sourceCodeBucket}/${sourceCodePrefix}/*` ]
        }),
         new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            's3:GetBucketLocation',
            's3:GetObject',
            's3:ListBucket',
            's3:PutObject'
          ],
          resources: [
            props.s3Bucket.bucketArn,
            `${props.s3Bucket.bucketArn}/*`
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [ 'iot:Publish' ],
          resources: [ `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*` ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'lambda:CreateFunction',
            'lambda:DeleteFunction',
            'lambda:PublishVersion',
            'lambda:CreateAlias',
            'lambda:DeleteAlias'
          ],
          resources: [
            `arn:${Aws.PARTITION}:lambda:${Aws.REGION}:${Aws.ACCOUNT_ID}:function:m2c2-opcda-connector*`,
            `arn:${Aws.PARTITION}:lambda:${Aws.REGION}:${Aws.ACCOUNT_ID}:function:m2c2-slmp-connector*`
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [ 'iam:PassRole' ],
          resources: [ connectorLambdaRole.roleArn ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'greengrass:CreateCoreDefinitionVersion',
            'greengrass:CreateCoreDefinition',
            'greengrass:CreateDeployment',
            'greengrass:CreateDeviceDefinitionVersion',
            'greengrass:CreateDeviceDefinition',
            'greengrass:CreateFunctionDefinitionVersion',
            'greengrass:CreateFunctionDefinition',
            'greengrass:CreateGroupVersion',
            'greengrass:CreateLoggerDefinitionVersion',
            'greengrass:CreateLoggerDefinition',
            'greengrass:CreateResourceDefinitionVersion',
            'greengrass:CreateResourceDefinition',
            'greengrass:CreateSubscriptionDefinitionVersion',
            'greengrass:CreateSubscriptionDefinition',
            'greengrass:DeleteCoreDefinition',
            'greengrass:DeleteDeviceDefinition',
            'greengrass:DeleteFunctionDefinition',
            'greengrass:DeleteLoggerDefinition',
            'greengrass:DeleteResourceDefinition',
            'greengrass:DeleteSubscriptionDefinition',
            'greengrass:GetCoreDefinitionVersion',
            'greengrass:GetDeploymentStatus',
            'greengrass:GetDeviceDefinitionVersion',
            'greengrass:GetFunctionDefinitionVersion',
            'greengrass:GetGroupVersion',
            'greengrass:GetGroup',
            'greengrass:GetLoggerDefinitionVersion',
            'greengrass:GetResourceDefinitionVersion',
            'greengrass:GetSubscriptionDefinitionVersion',
            'greengrass:ListCoreDefinitions',
            'greengrass:ListDeviceDefinitions',
            'greengrass:ListFunctionDefinitions',
            'greengrass:ListLoggerDefinitions',
            'greengrass:ListResourceDefinitions',
            'greengrass:ListSubscriptionDefinitions'
          ],
          resources: [
            '*'
          ]
        })
      ]
    });
    const cfnPolicy = jobBuilderPolicy.node.defaultChild as CfnPolicy;
    cfnPolicy.addMetadata('cfn_nag', {
      rules_to_suppress: [
        { id: 'W12', reason: 'The * resource is needed to control Greengrass resources.' }
      ]
    });

    const jobBuilderLambdaFunction = lambdaToDynamoDb.lambdaFunction;
    const jobBuilderRole = jobBuilderLambdaFunction.role as Role;
    jobBuilderRole.attachInlinePolicy(jobBuilderPolicy);

    const jobGeneratorRule = new CfnTopicRule(this, 'JobGeneratorRule', {
      topicRulePayload: {
        actions: [{
          lambda: { functionArn: jobBuilderLambdaFunction.functionArn }
        }],
        description: 'Processing of the job submitted and generating the job file to be pushed to Greengrass',
        ruleDisabled: false,
        sql: `SELECT * FROM 'm2c2/job/request'`
      }
    });

    jobBuilderLambdaFunction.addPermission('LambdaInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal('iot.amazonaws.com'),
      sourceAccount: Aws.ACCOUNT_ID,
      sourceArn: jobGeneratorRule.attrArn
    });
  }

  /**
   * Get DynamoDB table name.
   * @return {string} DynamoDB table name
   */
  getDynamoDbTableName(): string {
    return this.dynamodbTableName;
  }
}