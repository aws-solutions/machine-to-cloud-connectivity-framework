// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CfnDeletionPolicy, Construct, Duration } from '@aws-cdk/core';
import { AttributeType, CfnTable } from '@aws-cdk/aws-dynamodb';
import {
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal
} from '@aws-cdk/aws-iam';
import { Code, Function as LambdaFunction, Runtime } from '@aws-cdk/aws-lambda';
import { IBucket } from '@aws-cdk/aws-s3';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { addCfnSuppressRules } from '../utils/utils';
import { CfnGateway } from '@aws-cdk/aws-iotsitewise';

/**
 * ConnectionBuilderConstruct props
 * @interface ConnectionBuilderConstructProps
 */
export interface ConnectionBuilderConstructProps {
  // Policy for CloudWatch Logs
  readonly cloudWatchLogsPolicy: Policy;
  // IoT endpoint address
  readonly iotEndpointAddress: string;
  // IoT Sitewise gateway
  readonly iotSitewiseGateway: CfnGateway;
  // Greengrass group ID
  readonly greengrassGroupId: string;
  // Kinesis Data Stream name
  readonly kinesisStreamName: string;
  // Logs DynamoDB table ARN
  readonly logsTableArn: string;
  // Logs DynamoDB table name
  readonly logsTableName: string;
  /**
   * Solution config properties.
   * Logging level, solution ID, version, source code bucket, and source code prefix
   */
  readonly solutionConfig: {
    loggingLevel: string;
    sendAnonymousUsage: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
  // Solution UUID
  readonly uuid: string;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework Connection Builder Construct.
 * It creates a connection builder Lambda function, a connection metadata DynamoDB table, an M2C2 S3 bucket, an IoT rule, and an API Gateway.
 */
export class ConnectionBuilderConstruct extends Construct {
  // Connection metadata DynamoDB table name
  public connectionDynamodbTableName: string;
  // Connection builder Lambda function
  public connectionBuilderLambdaFunction: LambdaFunction;

  constructor(scope: Construct, id: string, props: ConnectionBuilderConstructProps) {
    super(scope, id);

    const sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    const sourceCodePrefix = props.solutionConfig.sourceCodePrefix;
    const iotSitewiseGatewayArn = `arn:${Aws.PARTITION}:iotsitewise:${Aws.REGION}:${Aws.ACCOUNT_ID}:gateway/${props.iotSitewiseGateway.ref}`;

    const greengrassLambdaRole = new Role(this, 'GreengrassLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/'
    });
    greengrassLambdaRole.attachInlinePolicy(props.cloudWatchLogsPolicy);

    const lambdaToDynamoDb = new LambdaToDynamoDB(this, 'ConnectionBuilder', {
      lambdaFunctionProps: {
        code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/connection-builder.zip`),
        description: 'Machine to Cloud Connectivity connection builder function',
        environment: {
          IOT_ENDPOINT: props.iotEndpointAddress,
          IOT_SITEWISE_GATEWAY_ID: props.iotSitewiseGateway.ref,
          KINESIS_STREAM: props.kinesisStreamName,
          LOGGING_LEVEL: props.solutionConfig.loggingLevel,
          LOGS_DYNAMODB_TABLE: props.logsTableName,
          PAGE_SIZE: '20',
          SEND_ANONYMOUS_METRIC: props.solutionConfig.sendAnonymousUsage,
          SOLUTION_ID: props.solutionConfig.solutionId,
          SOLUTION_VERSION: props.solutionConfig.solutionVersion,
          SOLUTION_UUID: props.uuid
        },
        handler: 'connection-builder/index.handler',
        runtime: Runtime.NODEJS_14_X,
        timeout: Duration.minutes(1)
      },
      dynamoTableProps: {
        partitionKey: {
          name: 'connectionName',
          type: AttributeType.STRING
        }
      },
      tableEnvironmentVariableName: 'CONNECTION_DYNAMODB_TABLE'
    });
    this.connectionBuilderLambdaFunction = lambdaToDynamoDb.lambdaFunction;

    const cfnDynamoTable = lambdaToDynamoDb.dynamoTable.node.defaultChild as CfnTable;
    cfnDynamoTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;
    this.connectionDynamodbTableName = lambdaToDynamoDb.dynamoTable.tableName;

    const greengrassDeployerRole = new Role(this, 'GreengrassDeployerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        'GreengrassIoTPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'greengrass:Create*DefinitionVersion',
                'greengrass:Create*Definition',
                'greengrass:CreateDeployment',
                'greengrass:CreateGroupVersion',
                'greengrass:Get*DefinitionVersion',
                'greengrass:GetDeploymentStatus',
                'greengrass:GetGroupVersion',
                'greengrass:GetGroup',
                'greengrass:List*Definitions'
              ],
              resources: ['*']
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['iot:Publish'],
              resources: [
                `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*`,
                `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/info/*`,
                `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/error/*`
              ]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'iotsitewise:DescribeGatewayCapabilityConfiguration',
                'iotsitewise:UpdateGatewayCapabilityConfiguration'
              ],
              resources: [iotSitewiseGatewayArn]
            })
          ]
        }),
        'LambdaPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'lambda:CreateFunction',
                'lambda:DeleteFunction',
                'lambda:PublishVersion',
                'lambda:CreateAlias',
                'lambda:DeleteAlias'
              ],
              resources: [`arn:${Aws.PARTITION}:lambda:${Aws.REGION}:${Aws.ACCOUNT_ID}:function:m2c2-*`]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['iam:PassRole'],
              resources: [greengrassLambdaRole.roleArn]
            })
          ]
        }),
        'DynamoDBPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'dynamodb:DeleteItem',
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:Scan',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
              ],
              resources: [lambdaToDynamoDb.dynamoTable.tableArn]
            })
          ]
        }),
        'S3Policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [`arn:${Aws.PARTITION}:s3:::${sourceCodeBucket.bucketName}/${sourceCodePrefix}/*`]
            })
          ]
        })
      }
    });
    greengrassDeployerRole.attachInlinePolicy(props.cloudWatchLogsPolicy);
    addCfnSuppressRules(greengrassDeployerRole, [{
      id: 'W11', reason: 'The * resource is needed to control Greengrass resources.'
    }]);

    const greengrassDeployer = new LambdaFunction(this, 'GreengrassDeployer', {
      code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/greengrass-deployer.zip`),
      description: 'Machine to Cloud Connectivity Greengrass deployer function',
      environment: {
        LAMBDA_ROLE: greengrassLambdaRole.roleArn,
        GREENGRASS_GROUP_ID: props.greengrassGroupId,
        IOT_ENDPOINT: props.iotEndpointAddress,
        IOT_SITEWISE_GATEWAY_ID: props.iotSitewiseGateway.ref,
        CONNECTION_DYNAMODB_TABLE: this.connectionDynamodbTableName,
        KINESIS_STREAM: props.kinesisStreamName,
        LOGGING_LEVEL: props.solutionConfig.loggingLevel,
        SEND_ANONYMOUS_METRIC: props.solutionConfig.sendAnonymousUsage,
        SOLUTION_ID: props.solutionConfig.solutionId,
        SOLUTION_VERSION: props.solutionConfig.solutionVersion,
        SOLUTION_UUID: props.uuid,
        SOURCE_S3_BUCKET: sourceCodeBucket.bucketName,
        SOURCE_S3_PREFIX: sourceCodePrefix
      },
      handler: 'greengrass-deployer/index.handler',
      retryAttempts: 0,
      reservedConcurrentExecutions: 1,
      role: greengrassDeployerRole,
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.minutes(5)
    });
    this.connectionBuilderLambdaFunction.addEnvironment('GREENGRASS_DEPLOYER_LAMBDA_FUNCTION', greengrassDeployer.functionName);

    const connectionBuilderPolicy = new Policy(this, 'ConnectionBuilderPolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iot:Publish'],
          resources: [
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/info/*`
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [greengrassDeployer.functionArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'dynamodb:Scan',
            'dynamodb:Query'
          ],
          resources: [props.logsTableArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'iotsitewise:DescribeGatewayCapabilityConfiguration',
            'iotsitewise:UpdateGatewayCapabilityConfiguration'
          ],
          resources: [iotSitewiseGatewayArn]
        })
      ]
    });

    const connectionBuilderRole = this.connectionBuilderLambdaFunction.role as Role;
    connectionBuilderRole.attachInlinePolicy(connectionBuilderPolicy);
  }
}