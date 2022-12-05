// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, CfnCustomResource, CustomResource, Duration, Stack, ArnFormat, Aws } from 'aws-cdk-lib';
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnPolicyPrincipalAttachment } from 'aws-cdk-lib/aws-iot';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface CustomResourcesConstructProps {
  readonly cloudWatchLogsPolicy: PolicyDocument;
  readonly existingKinesisStream: string;
  readonly existingTimestreamDatabase: string;
  readonly sendAnonymousUsageCondition: CfnCondition;
  readonly solutionConfig: {
    loggingLevel: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: IBucket;
    sourceCodePrefix: string;
  };
}

interface CustomResourceSetupUiProps {
  apiEndpoint: string;
  identityPoolId: string;
  loggingLevel: string;
  resourceS3Bucket: IBucket;
  uiBucket: IBucket;
  userPoolId: string;
  webClientId: string;
}

interface CustomResourceSetupGreengrassV2Props {
  greengrassIoTPolicyName: string;
  greengrassV2ResourceBucket: IBucket;
  iotCredentialsRoleArn: string;
  iotPolicyName: string;
  iotRoleAliasName: string;
}

/**
 * Creates a custom resource Lambda function, a solution UUID, a custom resource to send anonymous usage, and a role.
 */
export class CustomResourcesConstruct extends Construct {
  public customResourceFunction: LambdaFunction;
  public customResourceFunctionRole: Role;
  public iotCertificateArn: string;
  public iotCredentialProviderEndpoint: string;
  public iotDataAtsEndpoint: string;
  private sourceCodeBucket: IBucket;
  private sourceCodePrefix: string;
  public uuid: string;

  constructor(scope: Construct, id: string, props: CustomResourcesConstructProps) {
    super(scope, id);

    this.sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    this.sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    this.customResourceFunctionRole = new Role(this, 'CustomResourceFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        CloudWatchPolicy: props.cloudWatchLogsPolicy,
        GreengrassIoTPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'iot:CreateKeysAndCertificate',
                'iot:DescribeEndpoint',
                'iot:UpdateCertificate',
                'iot:UpdateThingShadow',
                'iot:DeleteCertificate'
              ],
              effect: Effect.ALLOW,
              resources: ['*']
            }),
            new PolicyStatement({
              actions: ['iot:CreateRoleAlias', 'iot:DeleteRoleAlias'],
              effect: Effect.ALLOW,
              resources: [
                Stack.of(this).formatArn({
                  service: 'iot',
                  resource: 'rolealias',
                  resourceName: '*'
                })
              ]
            }),
            new PolicyStatement({
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              effect: Effect.ALLOW,
              resources: [
                Stack.of(this).formatArn({
                  service: 'logs',
                  resource: 'log-group',
                  resourceName: '*',
                  arnFormat: ArnFormat.COLON_RESOURCE_NAME
                })
              ]
            })
          ]
        }),
        TeardownPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['s3:List*', 's3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:Delete*'],
              effect: Effect.ALLOW,
              resources: [`arn:aws:s3:::${Aws.STACK_NAME}*`]
            }),
            new PolicyStatement({
              actions: [
                'timestream:DescribeEndpoints',
                'timestream:ListTables',
                'timestream:DescribeTable',
                'timestream:DeleteTable',
                'timestream:DeleteDatabase',
                'timestream:DescribeDatabase'
              ],
              effect: Effect.ALLOW,
              // access denied on describe endpoints when doing teardown happens
              // everytime unless we put a wildcard, even prefix doesn't work
              // also, tables aren't named with prefix
              resources: ['*']
            })
          ]
        })
      }
    });

    addCfnSuppressRules(this.customResourceFunctionRole, [
      { id: 'W11', reason: 'IoT actions cannot specify the resource.' }
    ]);

    this.customResourceFunction = new LambdaFunction(this, 'CustomResourceFunction', {
      description: 'Machine to Cloud Connectivity custom resource function',
      handler: 'custom-resource/index.handler',
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromBucket(this.sourceCodeBucket, `${this.sourceCodePrefix}/custom-resource.zip`),
      timeout: Duration.seconds(240),
      role: this.customResourceFunctionRole,
      environment: {
        LOGGING_LEVEL: props.solutionConfig.loggingLevel,
        SOLUTION_ID: props.solutionConfig.solutionId,
        SOLUTION_VERSION: props.solutionConfig.solutionVersion
      }
    });
    this.sourceCodeBucket.grantRead(this.customResourceFunction, `${this.sourceCodePrefix}/*`);

    const customUuid = new CustomResource(this, 'UUID', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'CreateUUID'
      }
    });
    this.uuid = customUuid.getAtt('UUID').toString();

    const sendAnonymousMetrics = new CustomResource(this, 'SendAnonymousMetrics', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'SendAnonymousMetrics',
        ExistingKinesisStream: props.existingKinesisStream,
        ExistingTimestreamDatabase: props.existingTimestreamDatabase,
        SolutionUUID: this.uuid
      }
    });
    const cfnSendAnonymousMetrics = <CfnCustomResource>sendAnonymousMetrics.node.defaultChild;
    cfnSendAnonymousMetrics.cfnOptions.condition = props.sendAnonymousUsageCondition;

    const describeIoTEndpoint = new CustomResource(this, 'DescribeIoTEndpoint', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'DescribeIoTEndpoint'
      }
    });
    this.iotCredentialProviderEndpoint = describeIoTEndpoint.getAttString('CredentialProviderEndpoint');
    this.iotDataAtsEndpoint = describeIoTEndpoint.getAttString('DataAtsEndpoint');

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      this.customResourceFunctionRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'IoT actions cannot specify the resource. It does not allow wildcard permissions either.'
        }
      ],
      true
    );
  }

  /**
   * Sets up the UI assets and UI configuration.
   * @param props Custom resource setup UI props
   */
  public setupUi(props: CustomResourceSetupUiProps): void {
    props.uiBucket.grantPut(this.customResourceFunction);

    new CustomResource(this, 'CopyUiAssets', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'CopyUIAssets',
        DestinationBucket: props.uiBucket.bucketName,
        ManifestFile: 'manifest.json',
        SourceBucket: this.sourceCodeBucket.bucketName,
        SourcePrefix: this.sourceCodePrefix
      }
    });

    new CustomResource(this, 'CreateUiConfig', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'CreateUIConfig',
        ApiEndpoint: props.apiEndpoint,
        ConfigFileName: 'aws-exports.js',
        DestinationBucket: props.uiBucket.bucketName,
        IdentityPoolId: props.identityPoolId,
        LoggingLevel: props.loggingLevel,
        S3Bucket: props.resourceS3Bucket.bucketName,
        UserPoolId: props.userPoolId,
        WebClientId: props.webClientId
      }
    });
  }

  /**
   * Sets up Greengrass v2 resources.
   * @param props Custom resource setup Greengrass v2 props
   */
  public setupGreengrassV2(props: CustomResourceSetupGreengrassV2Props): void {
    props.greengrassV2ResourceBucket.grantPut(this.customResourceFunction);
    props.greengrassV2ResourceBucket.grantRead(this.customResourceFunction);

    const greengrassV2CustomResourcePolicy = new Policy(this, 'GreengrassV2CustomResourcePolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [props.iotCredentialsRoleArn]
        })
      ]
    });
    this.customResourceFunctionRole.attachInlinePolicy(greengrassV2CustomResourcePolicy);

    new CustomResource(this, 'ManageIoTRoleAlias', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'ManageIoTRoleAlias',
        RoleAliasName: props.iotRoleAliasName,
        RoleArn: props.iotCredentialsRoleArn
      }
    });

    new CustomResource(this, 'CopyGreengrassComponentsArtifact', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'CopyGreengrassComponentsArtifact',
        Artifacts: {
          OpcDaConnectorArtifact: 'm2c2_opcda_connector.zip',
          OsiPiConnectorArtifact: 'm2c2_osipi_connector.zip',
          ModbusTcpConnectorArtifact: 'm2c2_modbus_tcp_connector.zip',
          PublisherArtifact: 'm2c2_publisher.zip'
        },
        DestinationBucket: props.greengrassV2ResourceBucket.bucketName,
        SourceBucket: this.sourceCodeBucket.bucketName,
        SourcePrefix: this.sourceCodePrefix
      }
    });

    const createGreengrassInstallationScripts = new CustomResource(this, 'CreateGreengrassInstallationScripts', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'CreateGreengrassInstallationScripts',
        CredentialProviderEndpoint: this.iotCredentialProviderEndpoint,
        DataAtsEndpoint: this.iotDataAtsEndpoint,
        DestinationBucket: props.greengrassV2ResourceBucket.bucketName,
        IoTRoleAlias: props.iotRoleAliasName
      }
    });
    this.iotCertificateArn = createGreengrassInstallationScripts.getAttString('CertificateArn');

    const greengrassV2DeletePolicy = new Policy(this, 'GreengrassV2DeletePolicy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [this.iotCertificateArn],
          actions: ['iot:DetachThingPrincipal', 'iot:ListPrincipalThings']
        })
      ]
    });
    this.customResourceFunctionRole.attachInlinePolicy(greengrassV2DeletePolicy);

    const deleteIoTCertificate = new CustomResource(this, 'DeleteIoTCertificate', {
      serviceToken: this.customResourceFunction.functionArn,
      properties: {
        Resource: 'DeleteIoTCertificate',
        CertificateArn: this.iotCertificateArn,
        CertificateId: createGreengrassInstallationScripts.getAttString('CertificateId')
      }
    });
    deleteIoTCertificate.node.addDependency(greengrassV2DeletePolicy);

    new CfnPolicyPrincipalAttachment(this, 'PolicyPrincipalAttachment', {
      policyName: props.iotPolicyName,
      principal: this.iotCertificateArn
    });

    new CfnPolicyPrincipalAttachment(this, 'GreengrassPolicyPrincipalAttachment', {
      policyName: props.greengrassIoTPolicyName,
      principal: this.iotCertificateArn
    });
  }
}
