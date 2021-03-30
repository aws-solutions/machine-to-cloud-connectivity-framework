// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
    Aws,
    CfnMapping,
    Construct,
    CustomResource,
    Duration
} from '@aws-cdk/core';
import {
    CfnLoggerDefinition,
    CfnLoggerDefinitionVersion,
    CfnCoreDefinition,
    CfnCoreDefinitionVersion,
    CfnResourceDefinition,
    CfnResourceDefinitionVersion,
    CfnGroup
} from '@aws-cdk/aws-greengrass';
import { CfnThing, CfnPolicy, CfnPolicyPrincipalAttachment } from '@aws-cdk/aws-iot';
import { CfnFunction, Function, Code, Runtime } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';
import { Effect, PolicyStatement, Role, ServicePrincipal, CompositePrincipal, Policy } from '@aws-cdk/aws-iam';

/**
 * GreengrassConstruct props
 */
export interface GreengrassIoTProps {
    /**
     * Kinesis Stream Name
     */
    readonly kinesisStreamName: string;
    /**
     * S3 desination bucket
     */
    readonly s3BucketName: string;
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
 * Machine to Cloud Connectivity Framework Greengrass and IoT Resources
 */
export class GreengrassConstruct extends Construct {
    // Certificate and key pair download S3 pre-signed URL
    private certKeyPairS3URL: string;
    // IoT certificate ARN
    private certificateArn: string;
    // IoT certificate ID
    private certificateId: string;
    // Device gateway thing name
    private m2c2DeviceGatewayThing: string;
    // Device gateway thing ARN
    private m2c2DeviceGatewayThingArn: string;
    // Greengrass group ID
    private greengrassGroupId: string;

    constructor(scope: Construct, id: string, props: GreengrassIoTProps) {
        super(scope, id);
        const sourceCodeBucket: string = `${props.sourceCodeMapping.findInMap('General', 'S3Bucket')}-${Aws.REGION}`;
        const sourceCodePrefix: string = props.sourceCodeMapping.findInMap('General', 'KeyPrefix');

        this.m2c2DeviceGatewayThing = `${Aws.STACK_NAME}-M2C2DeviceGateway`;

        const ggCertCreatorPolicy = new Policy(this, 'GGCertCreatorPolicy', {
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [
                        `arn:${Aws.PARTITION}:s3:::${props.s3BucketName}/*`,
                        `arn:${Aws.PARTITION}:s3:::${props.s3BucketName}`
                    ],
                    actions: [
                        's3:GetObject',
                        's3:PutObject'
                    ]
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [
                        `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/${this.m2c2DeviceGatewayThing}`
                    ],
                    actions: [
                        'iot:ListThingPrincipals'
                    ]
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


        const m2c2CertCreatorPolicy = ggCertCreatorPolicy.node.defaultChild as CfnPolicy;
        m2c2CertCreatorPolicy.addMetadata('cfn_nag', {
            rules_to_suppress: [{
                id: 'W12',
                reason: 'The * resource is required for the IoT actions for the Lambda function to preform.'
            }]
        });

        const ggCertCreatorRole = new Role(this, 'GGCertCreatorRole', {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal('lambda.amazonaws.com')
            )
        });
        ggCertCreatorRole.attachInlinePolicy(ggCertCreatorPolicy)


        const m2c2DeviceGateway = new CfnThing(this, 'm2c2DeviceGateway', { thingName: `${this.m2c2DeviceGatewayThing}` });
        this.m2c2DeviceGatewayThingArn = `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:thing/${m2c2DeviceGateway.thingName}`;

        const ggCertCreatorLambda = new Function(this, 'GGCertCreatorLambdaCustomResource', {
            description: 'AWS Machine to Cloud job builder function that creates the certificate, keypair, config, and install script for the Greengrass edge device',
            code: Code.fromBucket(
                Bucket.fromBucketName(this, 'SourceCodeBucket', `${sourceCodeBucket}`),
                `${sourceCodePrefix}/m2c2-helper.zip`
            ),
            handler: 'gg_custom_resource.handler',
            role: ggCertCreatorRole,
            runtime: Runtime.PYTHON_3_8,
            timeout: Duration.minutes(1),
            memorySize: 128,
            environment: {
                AccountID: Aws.ACCOUNT_ID,
                StackName: Aws.STACK_NAME,
                ThingArn: this.m2c2DeviceGatewayThingArn,
                ThingName: m2c2DeviceGateway.ref,
                S3Bucket: props.s3BucketName,
                SolutionId: `${props.solutionMapping.findInMap('Parameters', 'Id')}`,
                SolutionVersion: `${props.solutionMapping.findInMap('Parameters', 'Version')}`
            }
        });

        const ggLambdaFunction = ggCertCreatorLambda.node.defaultChild as CfnFunction;
        ggLambdaFunction.addMetadata('cfn_nag', {
            rules_to_suppress: [{
                id: 'W58',
                reason: 'The CloudWatch logs permission is added in the role.'
            }]
        });


        const ggCertCreatorCustomResource = new CustomResource(this, 'GGCertCreator', {
            serviceToken: ggCertCreatorLambda.functionArn,
            properties: {
                Resource: 'CreateGGCertAndKeys'
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

        const m2c2LoggerDefinition = new CfnLoggerDefinition(this, 'm2c2LoggerDefinition', { name: `${Aws.STACK_NAME}-M2C2GreengrassGroup_LoggerDefinition` });
        const m2c2LoggerDefinitionVersion = new CfnLoggerDefinitionVersion(this, 'm2c2LoggerDefinitionVersion', {
            loggerDefinitionId: m2c2LoggerDefinition.attrId,
            loggers: [
                {
                    id: 'M2C2GreengrassFileSystemLogger',
                    type: 'FileSystem',
                    component: 'GreengrassSystem',
                    level: 'INFO',
                    space: 128
                },
                {
                    id: 'GreengrasAWSCloudWatchLogger',
                    type: 'AWSCloudWatch',
                    component: 'GreengrassSystem',
                    level: 'WARN'                },
                {
                    id: 'M2C2LambdaFileSystemLogger',
                    type: 'FileSystem',
                    component: 'Lambda',
                    level: 'INFO',
                    space: 128
                },
                {
                    id: 'M2C2LambdaAWSCloudWatchLogger',
                    type: 'AWSCloudWatch',
                    component: 'Lambda',
                    level: 'WARN'
                }
            ]
        });

        const m2c2ResourceDefinition = new CfnResourceDefinition(this, 'm2c2ResourceDefinition', { name: `${Aws.STACK_NAME}-M2C2GreengrassGroup_ResourceDefinition` });
        const m2c2ResourceDefintionVersion = new CfnResourceDefinitionVersion(this, 'm2c2ResourceDefinitionVersion', {
            resourceDefinitionId: m2c2ResourceDefinition.attrId,
            resources: [
                {
                    id: 'M2C2LocalResourceId',
                    name: 'M2C2LocalResource',
                    resourceDataContainer: {
                        localVolumeResourceData: {
                            sourcePath: '/m2c2/job',
                            groupOwnerSetting: {
                                autoAddGroupOwner: true
                            },
                            destinationPath: '/m2c2/job'
                        }
                    }
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
                        `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*`
                    ],
                    actions: [
                        'iot:Publish'
                    ]
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: ['*'],
                    actions: [
                        'greengrass:*'
                    ]
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [
                        `arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/aws/greengrass/*`
                    ],
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:DescribeLogStreams',
                        'logs:PutLogEvents'
                    ]
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [
                        `arn:${Aws.PARTITION}:kinesis:${Aws.REGION}:${Aws.ACCOUNT_ID}:stream/${props.kinesisStreamName}`
                    ],
                    actions: [
                        'kinesis:PutRecords'
                    ]
                })
            ]
        })
        const m2c2GGCfnPolicy = m2c2GreengrassResourcePolicy.node.defaultChild as CfnPolicy;
        m2c2GGCfnPolicy.addMetadata('cfn_nag', {
            rules_to_suppress: [
                {
                    id: 'W12',
                    reason: 'The * resource on its permission policy allows M2C2GreengrassResourcePolicy to interact with multiple topics and IoT things.'
                },
                {
                    id: 'F4',
                    reason: 'This policy is for Greengrass group to control Greengrass group fully so * action is needed.'
                }
            ]
        });

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
                coreDefinitionVersionArn: m2c2CoreDefinitionVersion.ref,
                loggerDefinitionVersionArn: m2c2LoggerDefinitionVersion.ref,
                resourceDefinitionVersionArn: m2c2ResourceDefintionVersion.ref
            }
        });

        this.greengrassGroupId = m2c2GreegrassGroup.attrId;

        new CustomResource(this, 'GGCertDelete', {
            serviceToken: ggCertCreatorLambda.functionArn,
            properties: {
                Resource: 'DeleteGGCertAndKeys',
                CertId: ggCertCreatorCustomResource.getAtt('certificateId'),
                GreengrassGroupId: this.greengrassGroupId
            }
        });

        const m2c2IoTResourcePolicy = new CfnPolicy(this, 'M2C2IoTResourcePolicy', {
            policyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: Effect.ALLOW,
                        Resource: '*',
                        Action: [
                            'greengrass:*'
                        ]
                    },
                    {
                        Effect: Effect.ALLOW,
                        Resource: [
                            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:client/${m2c2DeviceGateway.thingName}*`
                        ],
                        Action: [
                            'iot:Connect'
                        ]
                    },
                    {
                        Effect: Effect.ALLOW,
                        Resource: [
                            `${this.m2c2DeviceGatewayThingArn}*`
                        ],
                        Action: [
                            'iot:GetThingShadow',
                            'iot:UpdateThingShadow',
                            'iot:DeleteThingShadow'
                        ]
                    },
                    {
                        Effect: Effect.ALLOW,
                        Resource: [
                            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/m2c2/job/*`,
                            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/things/${m2c2DeviceGateway.thingName}*/shadow/*`
                        ],
                        Action: [
                            'iot:Publish',
                            'iot:Receive'
                        ]
                    },
                    {
                        Effect: Effect.ALLOW,
                        Resource: [
                            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/m2c2/job/*`,
                            `arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/things/${m2c2DeviceGateway.thingName}*/shadow/*`
                        ],
                        Action: [
                            'iot:Subscribe'
                        ]
                    }
                ]
            }
        });


        m2c2IoTResourcePolicy.addMetadata('cfn_nag', {
            rules_to_suppress: [
                {
                    id: 'W38',
                    reason: 'The *  action is a placeholder for Greengrass until further testing is performed.'
                },
                {
                    id: 'W39',
                    reason: 'The * resource on its permission policy allows to manipulate Greegrass resource.'
                }
            ]
        });

        new CfnPolicyPrincipalAttachment(this, 'M2C2PolicyPrincipalAttachment', {
            policyName: m2c2IoTResourcePolicy.ref,
            principal: this.certificateArn
        });

    }
    /**
     * Retrieve pre-signed S3 URL.
     * @return {string} Pre-signed S3 URL
     */
    getPresignedS3URL(): string {
        return this.certKeyPairS3URL;
    }
    /**
     * Get IoT Certificate ID.
     * @return {string} IoT certificate ID
     */
    getCertId(): string {
        return this.certificateId;
    }
    /**
     * Get IoT Certificate ARN.
     * @return {string} IoT Certificate ARN
     */
    getCertArn(): string {
        return this.certificateArn;
    }
    /**
     * Get Device Gateway Thing name.
     * @return {string} Device gateway thing name
     */
    getM2C2DeviceGatewayThing(): string {
        return this.m2c2DeviceGatewayThing;
    }
    /**
     * Get Device Gateway Thing ARN.
     * @return {string} Device gateway thing ARN
     */
    getM2C2DeviceGatewayThingArn(): string {
        return this.m2c2DeviceGatewayThingArn;
    }
    /**
     * Get the Greengrass group ID.
     * @return {string} Greengrass group ID
     */
    getM2C2GreengrassGroup(): string {
        return this.greengrassGroupId;
    }

}