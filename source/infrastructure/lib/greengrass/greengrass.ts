// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ArnFormat,
  RemovalPolicy,
  Stack,
  CfnCondition,
  CustomResource,
  CfnCustomResource,
  aws_iam as iam,
  aws_iot as iot,
  aws_s3 as s3
} from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface GreengrassIoTProps {
  readonly kinesisStreamName: string;
  readonly s3LoggingBucket: s3.Bucket;
  readonly solutionConfig: {
    solutionId: string;
    solutionVersion: string;
    uuid: string;
  };
  readonly timestreamKinesisStreamArn: string;
  readonly customResourcesFunctionArn: string;
  readonly shouldTeardownData: CfnCondition;
}

/**
 * Creates a Greengrass resource bucket and Greengrass/IoT permissions.
 */
export class GreengrassConstruct extends Construct {
  public greengrassIoTPolicyName: string;
  public greengrassResourceBucket: s3.Bucket;
  public iotCredentialsRoleArn: string;
  public iotPolicyName: string;
  public iotRoleAliasName: string;

  constructor(scope: Construct, id: string, props: GreengrassIoTProps) {
    super(scope, id);

    this.greengrassResourceBucket = new s3.Bucket(this, 'GreengrassResourceBucket', {
      enforceSSL: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsPrefix: 'm2c2/'
    });
    this.greengrassResourceBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:*'],
        conditions: {
          Bool: { 'aws:SecureTransport': 'false' }
        },
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        resources: [this.greengrassResourceBucket.bucketArn, this.greengrassResourceBucket.arnForObjects('*')]
      })
    );

    const teardownGreengrassResourcesBucket = new CustomResource(this, 'TeardownGreengrassResourcesBucket', {
      serviceToken: props.customResourcesFunctionArn,
      properties: {
        Resource: 'DeleteS3Bucket',
        BucketName: this.greengrassResourceBucket.bucketName
      }
    });
    const cfnTeardownGreengrassResourcesBucket = <CfnCustomResource>teardownGreengrassResourcesBucket.node.defaultChild;
    cfnTeardownGreengrassResourcesBucket.cfnOptions.condition = props.shouldTeardownData;

    const iotCredentialsRole = new iam.Role(this, 'IoTCredentialsRole', {
      assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('credentials.iot.amazonaws.com')),
      inlinePolicies: {
        CloudWatchPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [
                Stack.of(this).formatArn({
                  service: 'logs',
                  resource: 'log-group',
                  resourceName: '/aws/greengrass/*',
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME
                })
              ],
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:DescribeLogStreams', 'logs:PutLogEvents']
            })
          ]
        }),
        GreengrassPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: ['*'],
              actions: ['greengrass:*']
            })
          ]
        }),
        IoTPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [...this.createIoTResourceArns('thing', ['GG_*', '*-gcm', '*-gda', '*-gci'])],
              actions: ['iot:GetThingShadow', 'iot:UpdateThingShadow', 'iot:DeleteThingShadow']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [...this.createIoTResourceArns('topic', ['m2c2/info/*', 'm2c2/error/*', 'm2c2/data/*'])],
              actions: ['iot:Publish']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['iot:DescribeThing'],
              resources: [
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'thing',
                  resourceName: '*'
                })
              ]
            })
          ]
        }),
        IoTSiteWisePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: ['*'],
              actions: ['iotsitewise:BatchPutAssetPropertyValue']
            })
          ]
        }),
        KinesisPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [
                Stack.of(this).formatArn({
                  service: 'kinesis',
                  resource: 'stream',
                  resourceName: props.kinesisStreamName
                }),
                props.timestreamKinesisStreamArn
              ],
              actions: ['kinesis:PutRecords', 'kinesis:PutRecord']
            })
          ]
        }),
        S3Policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [this.greengrassResourceBucket.bucketArn, this.greengrassResourceBucket.arnForObjects('*')],
              actions: ['s3:GetBucketLocation', 's3:GetObject']
            })
          ]
        }),
<<<<<<< HEAD
        SecretsManagerPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
=======
        SecretsManagerPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
>>>>>>> main
              resources: [
                Stack.of(this).formatArn({
                  service: 'secretsmanager',
                  resource: 'secret',
<<<<<<< HEAD
                  resourceName: '*',
=======
                  resourceName: 'm2c2-*',
>>>>>>> main
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME
                })
              ],
              actions: ['secretsmanager:GetSecretValue']
            })
          ]
        })
      }
    });
    this.iotCredentialsRoleArn = iotCredentialsRole.roleArn;
    addCfnSuppressRules(iotCredentialsRole, [
      { id: 'F3', reason: 'The * action is required to control Greengrass resources fully.' },
      {
        id: 'W11',
        reason:
          'The * resource is required to control Greengrass resources fully and iotsitewise:BatchPutAssetPropertyValue actions for Greengrass v2.'
      }
    ]);

    this.iotRoleAliasName = `m2c2-role-alias-${props.solutionConfig.uuid}`;

    const iotPolicy = new iot.CfnPolicy(this, 'IoTPolicy', {
      policyDocument: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Connect'],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:GetThingShadow', 'iot:UpdateThingShadow', 'iot:DeleteThingShadow'],
            resources: [
              Stack.of(this).formatArn({
                service: 'iot',
                resource: 'thing',
                resourceName: '*'
              })
            ]
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Publish', 'iot:Receive'],
            resources: [
              Stack.of(this).formatArn({
                service: 'iot',
                resource: 'topic',
                resourceName: '$aws/things/*/greengrass/health/json',
                arnFormat: ArnFormat.SLASH_RESOURCE_NAME
              }),
              Stack.of(this).formatArn({
                service: 'iot',
                resource: 'topic',
                resourceName: '$aws/things/*/greengrassv2/health/json',
                arnFormat: ArnFormat.SLASH_RESOURCE_NAME
              }),
              ...this.createIoTResourceArns('topic', ['m2c2/job/*', 'm2c2/info/*', 'm2c2/error/*', 'm2c2/data/*']),
              ...this.getDefaultIoTPolicyResourceArns('topic')
            ]
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Subscribe'],
            resources: [
              Stack.of(this).formatArn({ service: 'iot', resource: 'topicfilter', resourceName: 'm2c2/job/*' }),
              ...this.getDefaultIoTPolicyResourceArns('topicfilter')
            ]
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:AssumeRoleWithCertificate'],
            resources: [
              Stack.of(this).formatArn({ service: 'iot', resource: 'rolealias', resourceName: this.iotRoleAliasName })
            ]
          })
        ]
      })
    });
    this.iotPolicyName = iotPolicy.ref;
    addCfnSuppressRules(iotPolicy, [
      { id: 'W39', reason: 'The * resource for iot:Connect is required for the solution.' }
    ]);

    const greengrassIoTPolicy = new iot.CfnPolicy(this, 'GreengrassIoTPolicy', {
      policyDocument: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'greengrass:GetComponentVersionArtifact',
              'greengrass:ResolveComponentCandidates',
              'greengrass:GetDeploymentConfiguration',
              'greengrass:ListThingGroupsForCoreDevice',
              'greengrass:PutCertificateAuthorities',
              'greengrass:VerifyClientDeviceIdentity'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['greengrass:VerifyClientDeviceIoTCertificateAssociation', 'greengrass:Discover'],
            resources: [
              Stack.of(this).formatArn({
                service: 'iot',
                resource: 'thing',
                resourceName: '*'
              })
            ]
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['greengrass:GetConnectivityInfo', 'greengrass:UpdateConnectivityInfo'],
            resources: [
              Stack.of(this).formatArn({
                service: 'greengrass',
                resource: '/greengrass/things',
                resourceName: '*'
              })
            ]
          })
        ]
      })
    });
    this.greengrassIoTPolicyName = greengrassIoTPolicy.ref;
    addCfnSuppressRules(greengrassIoTPolicy, [
      { id: 'W39', reason: 'The * resource for Greengrass actions is the minimum requirement.' }
    ]);

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      iotCredentialsRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'The * action/resource is required to control Greengrass resources fully. The * resource is required for iotsitewise:BatchPutAssetPropertyValue for Greengrass v2.'
        }
      ],
      true
    );
  }

  /**
   * Gets the default IoT policy resource ARNs.
   * @param resource The IoT policy resource
   * @returns The list of the default IoT policy resource ARNs
   */
  getDefaultIoTPolicyResourceArns(resource: string): string[] {
    return [
      Stack.of(this).formatArn({
        service: 'iot',
        resource,
        resourceName: '$aws/things/*/jobs/*'
      }),
      Stack.of(this).formatArn({
        service: 'iot',
        resource,
        resourceName: '$aws/things/*/shadow/*'
      }),
      Stack.of(this).formatArn({ service: 'iot', resource, resourceName: '$aws/sitewise/gateways/*/diagnostics' }),
      Stack.of(this).formatArn({
        service: 'iot',
        resource,
        resourceName: '$aws/sitewise/things/*/connectors/*/configuration/*'
      })
    ];
  }

  /**
   * Creates a list of IoT resource ARNs for different resource names.
   * @param resource The IoT policy resource
   * @param resourceNames The IoT policy resource names
   * @returns The list of IoT policy resource ARNs
   */
  createIoTResourceArns(resource: string, resourceNames: string[]): string[] {
    return resourceNames.map(resourceName => Stack.of(this).formatArn({ service: 'iot', resource, resourceName }));
  }
}
