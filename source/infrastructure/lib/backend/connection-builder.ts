// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { ArnFormat, CfnDeletionPolicy, Duration, Fn, Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, CfnTable, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface ConnectionBuilderConstructProps {
  readonly cloudWatchLogsPolicy: PolicyDocument;
  readonly greengrassResourceBucket: IBucket;
  readonly iotCertificateArn: string;
  readonly iotEndpointAddress: string;
  readonly kinesisStreamName: string;
  readonly kinesisStreamForTimestreamName: string;
  readonly logsTableArn: string;
  readonly logsTableName: string;
  readonly collectorId: string;
  readonly solutionConfig: {
    loggingLevel: string;
    sendAnonymousUsage: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
    uuid: string;
  };
}

/**
 * Creates Lambda functions, IAM roles and policies, and DynamoDB tables related to connections.
 */
export class ConnectionBuilderConstruct extends Construct {
  public connectionTableName: string;
  public connectionBuilderLambdaFunction: LambdaFunction;
  public greengrassCoreDevicesTableName: string;

  constructor(scope: Construct, id: string, props: ConnectionBuilderConstructProps) {
    super(scope, id);

    const sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    const sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    const greengrassCoreDevicesTable = new Table(this, 'GreengrassCoreDevicesTable', {
      partitionKey: { name: 'name', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: TableEncryption.AWS_MANAGED
    });
    const cfnGreengrassCoreDevicesTable = <CfnTable>greengrassCoreDevicesTable.node.defaultChild;
    cfnGreengrassCoreDevicesTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;
    this.greengrassCoreDevicesTableName = greengrassCoreDevicesTable.tableName;

    const lambdaToDynamoDb = new LambdaToDynamoDB(this, 'ConnectionBuilder', {
      lambdaFunctionProps: {
        code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/connection-builder.zip`),
        description: 'Machine to Cloud Connectivity connection builder function',
        environment: {
          GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE: this.greengrassCoreDevicesTableName,
          GREENGRASS_RESOURCE_BUCKET: props.greengrassResourceBucket.bucketName,
          IOT_CERTIFICATE_ARN: props.iotCertificateArn,
          IOT_ENDPOINT: props.iotEndpointAddress,
          LOGGING_LEVEL: props.solutionConfig.loggingLevel,
          LOGS_DYNAMODB_TABLE: props.logsTableName,
          PAGE_SIZE: '20',
          SEND_ANONYMOUS_METRIC: props.solutionConfig.sendAnonymousUsage,
          SOLUTION_ID: props.solutionConfig.solutionId,
          SOLUTION_VERSION: props.solutionConfig.solutionVersion,
          SOLUTION_UUID: props.solutionConfig.uuid
        },
        handler: 'connection-builder/index.handler',
        runtime: Runtime.NODEJS_16_X,
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

    const cfnDynamoTable = <CfnTable>lambdaToDynamoDb.dynamoTable.node.defaultChild;
    cfnDynamoTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.DELETE;
    this.connectionTableName = lambdaToDynamoDb.dynamoTable.tableName;

    const greengrassDeployerRole = new Role(this, 'GreengrassDeployerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        CloudWatchPolicy: props.cloudWatchLogsPolicy,
        GreengrassIoTPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'greengrass:CreateComponentVersion',
                'greengrass:CreateDeployment',
                'greengrass:DeleteComponent',
                'greengrass:GetDeployment',
                'greengrass:ListComponents',
                'greengrass:ListDeployments',
                'iot:CancelJob',
                'iot:CreateJob',
                'iot:DeleteThingShadow',
                'iot:DescribeJob',
                'iot:DescribeThing',
                'iot:DescribeThingGroup',
                'iot:GetThingShadow',
                'iot:UpdateJob',
                'iot:UpdateThingShadow'
              ],
              resources: ['*']
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['iot:Publish'],
              resources: [
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'topic',
                  resourceName: 'm2c2/job/*',
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME
                }),
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'topic',
                  resourceName: 'm2c2/info/*',
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME
                }),
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'topic',
                  resourceName: 'm2c2/error/*',
                  arnFormat: ArnFormat.SLASH_RESOURCE_NAME
                })
              ]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['iot:DescribeThing'],
              resources: [
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'thing',
                  resourceName: '*'
                })
              ]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'iotsitewise:DescribeGatewayCapabilityConfiguration',
                'iotsitewise:UpdateGatewayCapabilityConfiguration'
              ],
              resources: [
                Stack.of(this).formatArn({
                  service: 'iotsitewise',
                  resource: 'gateway',
                  resourceName: '*'
                })
              ]
            })
          ]
        }),
        DynamoDBPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'dynamodb:DeleteItem',
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:Scan',
                'dynamodb:UpdateItem',
                'dynamodb:Query'
              ],
              resources: [lambdaToDynamoDb.dynamoTable.tableArn]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
              resources: [greengrassCoreDevicesTable.tableArn]
            })
          ]
        }),
        S3Policy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [props.greengrassResourceBucket.bucketArn, props.greengrassResourceBucket.arnForObjects('*')]
            })
          ]
        }),
        SecretsManagerPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                Stack.of(this).formatArn({
                  service: 'secretsmanager',
                  resource: 'secret',
                  resourceName: 'm2c2-*',
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME
                })
              ],
              actions: [
                'secretsmanager:CreateSecret',
                'secretsmanager:DeleteSecret',
                'secretsmanager:PutSecretValue',
                'secretsmanager:UpdateSecret',
                'secretsmanager:RestoreSecret'
              ]
            })
          ]
        })
      }
    });
    addCfnSuppressRules(greengrassDeployerRole, [
      {
        id: 'W11',
        reason: 'The * resource is needed to control Greengrass resources and other IoT actions.'
      }
    ]);

    /**
     * The expected solution version is vX.Y.Z. X, Y, and Z are integer numbers.
     * When the solution version is v1.0.0, the component version would be 1.0.0.
     * If the solution version is not expected format (e.g. customVersion, v.1.0.0, v1, and so on),
     * the Lambda function is going to replace the component version to `1.0.0` by default.
     */
    const greengrassDeployer = new LambdaFunction(this, 'GreengrassDeployer', {
      code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/greengrass-deployer.zip`),
      description: 'Machine to Cloud Connectivity Greengrass deployer function',
      environment: {
        ARTIFACT_BUCKET: props.greengrassResourceBucket.bucketName,
        COMPONENT_VERSION: Fn.select(1, Fn.split('v', props.solutionConfig.solutionVersion)),
        CONNECTION_DYNAMODB_TABLE: this.connectionTableName,
        GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE: this.greengrassCoreDevicesTableName,
        IOT_ENDPOINT: props.iotEndpointAddress,
        KINESIS_STREAM: props.kinesisStreamName,
        LOGGING_LEVEL: props.solutionConfig.loggingLevel,
        SEND_ANONYMOUS_METRIC: props.solutionConfig.sendAnonymousUsage,
        SOLUTION_ID: props.solutionConfig.solutionId,
        SOLUTION_VERSION: props.solutionConfig.solutionVersion,
        SOLUTION_UUID: props.solutionConfig.uuid,
        TIMESTREAM_KINESIS_STREAM: props.kinesisStreamForTimestreamName,
        COLLECTOR_ID: props.collectorId
      },
      handler: 'greengrass-deployer/index.handler',
      retryAttempts: 0,
      reservedConcurrentExecutions: 1,
      role: greengrassDeployerRole,
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.minutes(10)
    });
    this.connectionBuilderLambdaFunction.addEnvironment(
      'GREENGRASS_DEPLOYER_LAMBDA_FUNCTION',
      greengrassDeployer.functionName
    );

    const connectionBuilderPolicy = new Policy(this, 'ConnectionBuilderPolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iot:Publish'],
          resources: [
            Stack.of(this).formatArn({
              service: 'iot',
              resource: 'topic',
              resourceName: 'm2c2/job/*'
            }),
            Stack.of(this).formatArn({
              service: 'iot',
              resource: 'topic',
              resourceName: 'm2c2/info/*'
            })
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [greengrassDeployer.functionArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['dynamodb:Scan', 'dynamodb:Query'],
          resources: [props.logsTableArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['dynamodb:DeleteItem', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Scan'],
          resources: [greengrassCoreDevicesTable.tableArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'iotsitewise:DeleteGateway',
            'iotsitewise:DescribeGateway',
            'iotsitewise:DescribeGatewayCapabilityConfiguration',
            'iotsitewise:UpdateGatewayCapabilityConfiguration'
          ],
          resources: [
            Stack.of(this).formatArn({
              service: 'iotsitewise',
              resource: 'gateway',
              resourceName: '*'
            })
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iotsitewise:CreateGateway', 'iotsitewise:ListGateways'],
          resources: ['*']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['greengrass:DeleteCoreDevice', 'greengrass:ListCoreDevices'],
          resources: [
            Stack.of(this).formatArn({
              service: 'greengrass',
              resource: 'coreDevices',
              resourceName: '*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME
            })
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iot:CreateThing', 'iot:DescribeThing', 'iot:DeleteThing'],
          resources: [
            Stack.of(this).formatArn({
              service: 'iot',
              resource: 'thing',
              resourceName: '*'
            })
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['s3:DeleteObject', 's3:GetObject', 's3:ListBucket', 's3:PutObject'],
          resources: [props.greengrassResourceBucket.bucketArn, props.greengrassResourceBucket.arnForObjects('*')]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iot:AttachThingPrincipal', 'iot:DetachThingPrincipal'],
          resources: [props.iotCertificateArn]
        }),
        new PolicyStatement({
          actions: ['iam:PassRole'],
          effect: Effect.ALLOW,
          resources: [
            Stack.of(this).formatArn({
              service: 'iam',
              region: '',
              resource: 'role/aws-service-role/iotsitewise.amazonaws.com',
              resourceName: 'AWSServiceRoleForIoTSiteWise'
            })
          ]
        })
      ]
    });

    addCfnSuppressRules(connectionBuilderPolicy, [
      { id: 'W12', reason: 'iotsitewise:CreateGateway and iotsitewise:ListGateways cannot have specific resources.' }
    ]);

    const connectionBuilderRole = this.connectionBuilderLambdaFunction.role as Role;
    connectionBuilderRole.attachInlinePolicy(connectionBuilderPolicy);

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      lambdaToDynamoDb,
      [{ id: 'AwsSolutions-IAM5', reason: 'It does not allow wildcard permissions.' }],
      true
    );
    NagSuppressions.addResourceSuppressions(greengrassDeployerRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The * resource is needed to control Greengrass resources and other IoT actions.'
      }
    ]);
    NagSuppressions.addResourceSuppressions(connectionBuilderPolicy, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'iotsitewise:CreateGateway and iotsitewise:ListGateways cannot have specific resources.'
      }
    ]);
  }
}
