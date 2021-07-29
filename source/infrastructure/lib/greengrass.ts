// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Aws, Construct, CustomResource, Duration, RemovalPolicy } from '@aws-cdk/core';
import { CfnCoreDefinition, CfnCoreDefinitionVersion, CfnGroup } from '@aws-cdk/aws-greengrass';
import { CfnThing, CfnPolicy, CfnPolicyPrincipalAttachment } from '@aws-cdk/aws-iot';
import { Function as LambdaFunction, Code, Runtime } from '@aws-cdk/aws-lambda';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket } from '@aws-cdk/aws-s3';
import { Effect, PolicyStatement, Role, ServicePrincipal, CompositePrincipal, Policy } from '@aws-cdk/aws-iam';
import { addCfnSuppressRules } from '../utils/utils';

/**
 * GreengrassConstruct props
 * @interface GreengrassIoTProps
 */
export interface GreengrassIoTProps {
  /**
   * Kinesis Stream Name
   */
  readonly kinesisStreamName: string;
  /**
   * S3 logging bucket
   */
  readonly s3LoggingBucket: Bucket;
  /**
   * Solution config properties.
   * Solution ID, solution version, source code bucket, and source code prefix
   */
  readonly solutionConfig: {
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
}

/**
 * @class
 * Machine to Cloud Connectivity Framework Greengrass and IoT Resources Construct.
 * It creates Greengrass resources and Greengrass related IoT resources.
 */
export class GreengrassConstruct extends Construct {
  // Certificate and key pair download S3 pre-signed URL
  public certKeyPairS3URL: string;
  // IoT certificate ARN
  public certificateArn: string;
  // IoT certificate ID
  public certificateId: string;
  // Device gateway thing name
  public m2c2DeviceGatewayThing: string;
  // Device gateway thing ARN
  public m2c2DeviceGatewayThingArn: string;
  // Greengrass group ID
  public greengrassGroupId: string;
  // Greengrass certificate and keys bucket
  public greengrassBucket: Bucket;

  constructor(scope: Construct, id: string, props: GreengrassIoTProps) {
    super(scope, id);

    const sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    const sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    const thingName = `${Aws.STACK_NAME}-M2C2DeviceGateway`;
    const m2c2DeviceGateway = new CfnThing(this, 'm2c2DeviceGateway', { thingName });
    this.m2c2DeviceGatewayThing = m2c2DeviceGateway.thingName as string;
    this.m2c2DeviceGatewayThingArn = `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/${this.m2c2DeviceGatewayThing}`;

    this.greengrassBucket = new Bucket(this, 'GreegrassBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: props.s3LoggingBucket,
      serverAccessLogsPrefix: 'm2c2/'
    });
    this.greengrassBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('lambda.amazonaws.com')],
        actions: [
          's3:GetObject',
          's3:PutObject'
        ],
        resources: [`${this.greengrassBucket.bucketArn}/*`]
      })
    );

    const ggCertCreatorPolicy = new Policy(this, 'GGCertCreatorPolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [
            this.greengrassBucket.bucketArn,
            `${this.greengrassBucket.bucketArn}/*`
          ],
          actions: [
            's3:GetObject',
            's3:PutObject'
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [`arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/${this.m2c2DeviceGatewayThing}`],
          actions: ['iot:ListThingPrincipals']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: [
            'iot:CreateKeysAndCertificate',
            'iot:DescribeEndpoint',
            'iot:UpdateCertificate',
            'iot:UpdateThingShadow',
            'iot:DeleteCertificate'
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [
            `arn:${Aws.PARTITION}:greengrass:${Aws.REGION}:${Aws.ACCOUNT_ID}:/greengrass/groups/*`
          ],
          actions: [
            'greengrass:ResetDeployments',
            'greengrass:GetGroup'
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [
            `arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`
          ]
        })
      ]
    });
    addCfnSuppressRules(ggCertCreatorPolicy, [
      { id: 'W12', reason: 'The * resource is required for the IoT actions for the Lambda function to preform.' }
    ]);

    const ggCertCreatorRole = new Role(this, 'GGCertCreatorRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com')
      )
    });
    ggCertCreatorRole.attachInlinePolicy(ggCertCreatorPolicy)

    const ggCertCreatorLambda = new LambdaFunction(this, 'GGCertCreatorLambdaCustomResource', {
      description: 'AWS Machine to Cloud connection builder function that creates the certificate, keypair, config, and install script for the Greengrass edge device',
      code: Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/custom-resource.zip`),
      handler: 'custom-resource/index.handler',
      role: ggCertCreatorRole,
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        STACK_NAME: Aws.STACK_NAME,
        SOLUTION_ID: props.solutionConfig.solutionId,
        SOLUTION_VERION: props.solutionConfig.solutionVersion
      }
    });

    const ggCertCreatorCustomResource = new CustomResource(this, 'GGCertCreator', {
      serviceToken: ggCertCreatorLambda.functionArn,
      properties: {
        Resource: 'CreateGGCertAndKeys',
        DestinationBucket: this.greengrassBucket.bucketName,
        ThingArn: this.m2c2DeviceGatewayThingArn
      }
    });
    ggCertCreatorCustomResource.node.addDependency(ggCertCreatorPolicy);

    this.certificateArn = ggCertCreatorCustomResource.getAtt('certificateArn').toString();
    this.certKeyPairS3URL = ggCertCreatorCustomResource.getAtt('generatedS3URL').toString();
    this.certificateId = ggCertCreatorCustomResource.getAtt('certificateId').toString();

    const m2c2CoreDefinition = new CfnCoreDefinition(this, 'm2c2CoreDefinition', { name: `${Aws.STACK_NAME}-M2C2GreengrassGroup_Core` });
    const m2c2CoreDefinitionVersion = new CfnCoreDefinitionVersion(this, 'm2c2CoreDefinitionVersion', {
      coreDefinitionId: m2c2CoreDefinition.attrId,
      cores: [
        {
          id: m2c2CoreDefinition.attrId,
          thingArn: this.m2c2DeviceGatewayThingArn,
          certificateArn: this.certificateArn,
          syncShadow: true
        }
      ]
    });

    const m2c2GreengrassResourcePolicy = new Policy(this, 'M2C2GreengrassResourcePolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/GG_*`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/GG_*`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/*-gcm`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/*-gda`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/*-gci`
          ],
          actions: [
            'iot:GetThingShadow',
            'iot:UpdateThingShadow',
            'iot:DeleteThingShadow'
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/info/*`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/error/*`,
            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/data/*`
          ],
          actions: ['iot:Publish']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['greengrass:*']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [`arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/aws/greengrass/*`],
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:DescribeLogStreams',
            'logs:PutLogEvents'
          ]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [`arn:${Aws.PARTITION}:kinesis:${Aws.REGION}:${Aws.ACCOUNT_ID}:stream/${props.kinesisStreamName}`],
          actions: ['kinesis:PutRecords']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['iotsitewise:BatchPutAssetPropertyValue']
        })
      ]
    });
    addCfnSuppressRules(m2c2GreengrassResourcePolicy, [
      { id: 'W12', reason: 'Greengrass and IoT Sitewise cannnot specify the resources, so * is used.' },
      { id: 'F4', reason: 'This policy is for Greengrass group to control Greengrass group fully so * action is needed.' }
    ]);

    const m2c2GreengrassResourceRole = new Role(this, 'M2C2GreengrassResourceRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('greengrass.amazonaws.com')
      )
    });
    m2c2GreengrassResourceRole.attachInlinePolicy(m2c2GreengrassResourcePolicy);

    const m2c2GreegrassGroup = new CfnGroup(this, 'm2c2GreengrassGroup', {
      name: `${Aws.STACK_NAME}-M2C2GreengrassGroup`,
      roleArn: m2c2GreengrassResourceRole.roleArn,
      initialVersion: {
        coreDefinitionVersionArn: m2c2CoreDefinitionVersion.ref
      }
    });

    this.greengrassGroupId = m2c2GreegrassGroup.attrId;

    new CustomResource(this, 'GGDeleteResources', { // NOSONAR: typescript:S1848
      serviceToken: ggCertCreatorLambda.functionArn,
      properties: {
        Resource: 'DeleteGreengrassResources',
        CertificateId: ggCertCreatorCustomResource.getAtt('certificateId'),
        GreengrassGroupId: this.greengrassGroupId,
        ThingName: this.m2c2DeviceGatewayThing
      }
    });

    const m2c2IoTResourcePolicy = new CfnPolicy(this, 'M2C2IoTResourcePolicy', {
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: Effect.ALLOW,
            Resource: '*',
            Action: ['greengrass:*']
          },
          {
            Effect: Effect.ALLOW,
            Resource: [`arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:client/${this.m2c2DeviceGatewayThing}*`],
            Action: ['iot:Connect']
          },
          {
            Effect: Effect.ALLOW,
            Resource: [`${this.m2c2DeviceGatewayThingArn}*`],
            Action: [
              'iot:GetThingShadow',
              'iot:UpdateThingShadow',
              'iot:DeleteThingShadow'
            ]
          },
          {
            Effect: Effect.ALLOW,
            Resource: [
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/info/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/error/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/data/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/things/${m2c2DeviceGateway.thingName}*/shadow/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/sitewise/gateways/*/diagnostics`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/sitewise/things/*/connectors/*/configuration/*`
            ],
            Action: ['iot:Publish']
          },
          {
            Effect: Effect.ALLOW,
            Resource: [
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/things/${m2c2DeviceGateway.thingName}*/shadow/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/sitewise/gateways/*/diagnostics`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/sitewise/things/*/connectors/*/configuration/*`
            ],
            Action: ['iot:Receive']
          },
          {
            Effect: Effect.ALLOW,
            Resource: [
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/m2c2/job/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/things/${m2c2DeviceGateway.thingName}*/shadow/*`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/sitewise/gateways/*/diagnostics`,
              `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/sitewise/things/*/connectors/*/configuration/*`
            ],
            Action: ['iot:Subscribe']
          }
        ]
      }
    });
    addCfnSuppressRules(m2c2IoTResourcePolicy, [
      { id: 'W38', reason: 'The *  action is a placeholder for Greengrass until further testing is performed.' },
      { id: 'W39', reason: 'The * resource on its permission policy allows to manipulate Greegrass resource.' }
    ]);

    new CfnPolicyPrincipalAttachment(this, 'M2C2PolicyPrincipalAttachment', { // NOSONAR: typescript:S1848
      policyName: m2c2IoTResourcePolicy.ref,
      principal: this.certificateArn
    });
  }
}