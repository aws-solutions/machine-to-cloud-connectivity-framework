// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Aspects,
  Aws,
  CfnCondition,
  CfnMapping,
  CfnOutput,
  CfnParameter,
  CfnResource,
  Construct,
  Fn,
  IAspect,
  IConstruct,
  Stack,
  StackProps
} from '@aws-cdk/core';
import { ApiConstruct } from './api';
import { CommonResourcesConstruct } from './common-resources';
import { CustomResourcesConstruct } from './custom-resources';
import { DataStreamConstruct } from './data-stream';
import { IoTSitewiseConstruct } from './iot-sitewise';
import { ConnectionBuilderConstruct } from './connection-builder';
import { GreengrassConstruct } from './greengrass';
import { SQSMessageConsumerConstruct } from './sqs-message-consumer';
import { UiConstruct } from './ui';

/**
 * CDK Aspect implementation to set up conditions to the entire Construct resources
 */
class ConditionAspect implements IAspect {
  private readonly condition: CfnCondition;

  constructor(condition: CfnCondition) {
    this.condition = condition;
  }

  /**
   * Implement IAspect.visit to set the condition to whole resources in Construct.
   * @param {IConstruct} node Construct node to visit
   */
  visit(node: IConstruct): void {
    const resource = node as CfnResource;
    if (resource.cfnOptions) {
      resource.cfnOptions.condition = this.condition;
    }
  }
}

/**
 * Machine to Cloud Connectivity Framework main CDK Stack
 * @class
 */
export class M2C2Stack extends Stack {

  // Kinesis Data Stream name
  private kinesisStreamName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // CFN template format version
    this.templateOptions.templateFormatVersion = '2010-09-09';

    // CFN Parameters
    // Admin E-mail parameter
    const userEmail = new CfnParameter(this, 'UserEmail', {
      type: 'String',
      description: 'The user E-Mail to access the UI',
      allowedPattern: '^[_A-Za-z0-9-\\+]+(\\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\\.[A-Za-z0-9]+)*(\\.[A-Za-z]{2,})$',
      constraintDescription: 'User E-Mail must be a valid E-Mail address.'
    });

    // Logging level for Lambda and UI
    const loggingLevel = new CfnParameter(this, 'LoggingLevel', {
      type: 'String',
      description: 'The logging level of the Lambda functions and the UI',
      allowedValues: [
        'VERBOSE',
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR'
      ],
      default: 'ERROR'
    });

    // ExistingGreengrassGroupID
    const existingGreengrassGroupIDParameter = new CfnParameter(this, 'ExistingGreengrassGroupID', {
      type: 'String',
      description: 'The Greengrass Group ID can be found in the Settings option of your Greengrass group in the console.',
      allowedPattern: '[a-zA-Z0-9-]*',
      constraintDescription: 'Greengrass group ID should match the allowed pattern: [a-zA-Z0-9-]'
    });

    // ExistingKinesisStreamName
    const existingKinesisStreamNameParameter = new CfnParameter(this, 'ExistingKinesisStreamName', {
      type: 'String',
      description: 'The Kinesis Data Stream Name can be found in the Data streams in the Amazon Kinesis console.',
      allowedPattern: '[a-zA-Z0-9-_.]*',
      constraintDescription: 'Kinesis Stream Name should match the allowed pattern: [a-zA-Z0-9-_.]'
    });

    // CFN Metadata
    this.templateOptions.metadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: { default: 'Required parameters' },
            Parameters: [loggingLevel.logicalId, userEmail.logicalId]
          },
          {
            Label: { default: '(Optional) Using your existing resources' },
            Parameters: [existingGreengrassGroupIDParameter.logicalId, existingKinesisStreamNameParameter.logicalId]
          }
        ],
        ParameterLabels: {
          [loggingLevel.logicalId]: { default: '* Logging Level' },
          [userEmail.logicalId]: { default: '* Initial User Email' },
          [existingGreengrassGroupIDParameter.logicalId]: { default: 'ID of the Existing AWS IoT Greengrass Group' },
          [existingKinesisStreamNameParameter.logicalId]: { default: 'Name of the Existing Data Stream in Kinesis Data Streams' }
        }
      }
    };

    // CFN Mappings
    const solutionMapping = new CfnMapping(this, 'Solution', {
      mapping: {
        Config: {
          SolutionId: 'SO0070',
          Version: 'VERSION_PLACEHOLDER',
          SendAnonymousUsage: 'Yes',
          S3Bucket: 'BUCKET_NAME_PLACEHOLDER',
          KeyPrefix: 'SOLUTION_NAME_PLACEHOLDER/VERSION_PLACEHOLDER'
        }
      }
    });
    const sendAnonymousUsage = solutionMapping.findInMap('Config', 'SendAnonymousUsage');
    const solutionId = solutionMapping.findInMap('Config', 'SolutionId');
    const solutionVersion = solutionMapping.findInMap('Config', 'Version');
    const sourceCodeBucket = Fn.join('-', [solutionMapping.findInMap('Config', 'S3Bucket'), Aws.REGION]);
    const sourceCodePrefix = solutionMapping.findInMap('Config', 'KeyPrefix');

    // CFN Conditions
    const sendAnonymousUsageCondition = new CfnCondition(this, 'SendAnonymousUsage', {
      expression: Fn.conditionEquals(sendAnonymousUsage, 'Yes')
    });
    const createGreengrassResourcesCondition = new CfnCondition(this, 'CreateGreengrassResources', {
      expression: Fn.conditionEquals(existingGreengrassGroupIDParameter.valueAsString, '')
    });
    const createKinesisResourcesCondition = new CfnCondition(this, 'CreateKinesisResources', {
      expression: Fn.conditionEquals(existingKinesisStreamNameParameter.valueAsString, '')
    });

    // Common Resources
    const commonResources = new CommonResourcesConstruct(this, 'M2C2CommonResources', {
      sourceCodeBucket
    });

    // Kinesis Streams, Kinesis Firehose, S3
    const dataStream = new DataStreamConstruct(this, 'M2C2Data', {
      s3LoggingBucket: commonResources.s3LoggingBucket
    });
    Aspects.of(dataStream).add(new ConditionAspect(createKinesisResourcesCondition));
    this.kinesisStreamName = Fn.conditionIf(createKinesisResourcesCondition.logicalId,
      dataStream.kinesisStreamName,
      existingKinesisStreamNameParameter.valueAsString
    ).toString();

    // Custom Resources
    const customResources = new CustomResourcesConstruct(this, 'M2C2CustomResources', {
      cloudWatchLogsPolicy: commonResources.cloudWatchLogsPolicy,
      existingGreengrassGroup: existingGreengrassGroupIDParameter.valueAsString,
      existingKinesisStream: existingKinesisStreamNameParameter.valueAsString,
      sendAnonymousUsageCondition,
      solutionConfig: {
        loggingLevel: loggingLevel.valueAsString,
        solutionId,
        solutionVersion,
        sourceCodeBucket: commonResources.sourceCodeBucket,
        sourceCodePrefix
      }
    });

    // Greengrass resources
    const greengrassResources = new GreengrassConstruct(this, 'M2C2GreengrassResources', {
      kinesisStreamName: this.kinesisStreamName,
      s3LoggingBucket: commonResources.s3LoggingBucket,
      solutionConfig: {
        solutionId,
        solutionVersion,
        sourceCodeBucket: commonResources.sourceCodeBucket,
        sourceCodePrefix
      }
    });
    Aspects.of(greengrassResources).add(new ConditionAspect(createGreengrassResourcesCondition));

    // SQS message consumer resources
    const sqsMessageConsumer = new SQSMessageConsumerConstruct(this, 'M2C2SQSMessageConsumer', {
      solutionConfig: {
        loggingLevel: loggingLevel.valueAsString,
        solutionId,
        solutionVersion,
        sourceCodeBucket: commonResources.sourceCodeBucket,
        sourceCodePrefix
      }
    });

    // M2C2 IoT Sitewise
    const iotSitewise = new IoTSitewiseConstruct(this, 'M2C2IoTSitewise', {
      greengrassGroupId: Fn.conditionIf(createGreengrassResourcesCondition.logicalId,
        greengrassResources.greengrassGroupId,
        existingGreengrassGroupIDParameter.valueAsString).toString()
    });

    // Connection Builder resources
    const connectionBuilder = new ConnectionBuilderConstruct(this, 'M2C2ConnectionBuilder', {
      cloudWatchLogsPolicy: commonResources.cloudWatchLogsPolicy,
      greengrassGroupId: Fn.conditionIf(createGreengrassResourcesCondition.logicalId,
        greengrassResources.greengrassGroupId,
        existingGreengrassGroupIDParameter.valueAsString).toString(),
      iotEndpointAddress: customResources.iotEndpointAddress,
      iotSitewiseGateway: iotSitewise.iotSitewiseGateway,
      kinesisStreamName: this.kinesisStreamName,
      logsTableArn: sqsMessageConsumer.logsTable.tableArn,
      logsTableName: sqsMessageConsumer.logsTable.tableName,
      solutionConfig: {
        loggingLevel: loggingLevel.valueAsString,
        sendAnonymousUsage,
        solutionId,
        solutionVersion,
        sourceCodeBucket: commonResources.sourceCodeBucket,
        sourceCodePrefix
      },
      uuid: customResources.uuid
    });

    // M2C2 API
    const api = new ApiConstruct(this, 'M2C2Api', {
      connectionBuilderLambdaFunction: connectionBuilder.connectionBuilderLambdaFunction
    });
    connectionBuilder.connectionBuilderLambdaFunction.addEnvironment('API_ENDPOINT', `${api.apiId}.execute-api.${Aws.REGION}.amazonaws.com`);

    // M2C2 UI and UI custom resources for UI assets
    const ui = new UiConstruct(this, 'M2C2Ui', {
      apiId: api.apiId,
      s3LoggingBucket: commonResources.s3LoggingBucket,
      userEmail: userEmail.valueAsString
    });

    customResources.setupUi({
      apiEndpoint: api.apiEndpoint,
      identityPoolId: ui.identityPoolId,
      loggingLevel: loggingLevel.valueAsString,
      uiBucket: ui.uiBucket,
      userPoolId: ui.userPoolId,
      webClientId: ui.webClientId
    });

    // Define the outputs
    new CfnOutput(this, 'CertKeyPairS3URL', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'The solution generated a certificate and key pair for your Greengrass instance. Use this URL to download the tar archive to install on your Greengrass instance.',
      value: greengrassResources.certKeyPairS3URL
    });
    new CfnOutput(this, 'CertificateId', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'ID of certificate generated by the solution.',
      value: greengrassResources.certificateId
    });
    new CfnOutput(this, 'CertificateArn', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'ARN of certificate generated by the solution.',
      value: greengrassResources.certificateArn
    });
    new CfnOutput(this, 'M2C2DeviceGatewayThing', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'The name of the IoT Device Gateway',
      value: greengrassResources.m2c2DeviceGatewayThing
    });
    new CfnOutput(this, 'M2C2DeviceGatewayThingArn', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'The ARN of the IoT Device Gateway',
      value: greengrassResources.m2c2DeviceGatewayThingArn
    });
    new CfnOutput(this, 'M2C2GreengrassGroup', { // NOSONAR: typescript:S1848
      description: 'Greengrass group that needs to be deployed to the on-premises gateway',
      value: Fn.conditionIf(createGreengrassResourcesCondition.logicalId,
        greengrassResources.greengrassGroupId,
        existingGreengrassGroupIDParameter.logicalId).toString()
    });
    new CfnOutput(this, 'M2C2ConnectionControlRequestTopic', { // NOSONAR: typescript:S1848
      description: 'IoT Topic where connection controls need to be submitted',
      value: 'm2c2/job/{connectionName}'
    });
    new CfnOutput(this, 'M2C2DataBucket', { // NOSONAR: typescript:S1848
      condition: createKinesisResourcesCondition,
      description: 'Bucket where the connection telemetry data will be stored',
      value: dataStream.dataBucketName
    });
    new CfnOutput(this, 'M2C2KinesisStream', { // NOSONAR: typescript:S1848
      description: 'The Kinesis Data Stream that sends Greengrass Stream Manager data',
      value: this.kinesisStreamName
    });
    new CfnOutput(this, 'M2C2GreengrassBucket', { // NOSONAR: typescript:S1848
      condition: createGreengrassResourcesCondition,
      description: 'Bucket where the Greengrass configuration tar file will be stored',
      value: greengrassResources.greengrassBucket.bucketName
    });
    new CfnOutput(this, 'M2C2ConnectionMetadataTable', { // NOSONAR: typescript:S1848
      description: 'The DynamoDB table where the connections metadata will be stored',
      value: connectionBuilder.connectionDynamodbTableName
    });
    new CfnOutput(this, 'M2C2LogsTable', { // NOSONAR: typescript:S1848
      description: 'The DynamoDB table where the IoT topic info or error logs will be stored',
      value: sqsMessageConsumer.logsTable.tableName
    });
    new CfnOutput(this, 'UUID', { // NOSONAR: typescript:S1848
      description: 'Solution UUID',
      value: customResources.uuid
    });
    new CfnOutput(this, 'M2C2UIDomainName', { // NOSONAR: typescript:S1848
      description: 'The UI domain name',
      value: `https://${ui.cloudFrontDomainName}`
    });
  }
}
