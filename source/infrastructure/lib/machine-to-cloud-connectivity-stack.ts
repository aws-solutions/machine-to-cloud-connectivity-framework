// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Aspects,
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
import { CommonResourcesConstruct } from './common-resources';
import { CustomResourcesConstruct } from './custom-resources';
import { DataStreamConstruct } from './data-stream';
import { JobBuilderConstruct } from './job-builder';
import { GreengrassConstruct } from './greengrass';

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
            Label: { default: `Fill out this parameter if you're using an EXISTING Greengrass group.` },
            Parameters: [ existingGreengrassGroupIDParameter.logicalId ]
          },
          {
            Label: { default: `Fill out this parameter if you're using an EXISTING Kinesis Data Stream.` },
            Parameters: [ existingKinesisStreamNameParameter.logicalId ]
          }
        ],
        ParameterLabels: {
          [existingGreengrassGroupIDParameter.logicalId]: { default: 'ID of the Existing AWS IoT Greengrass Group' },
          [existingKinesisStreamNameParameter.logicalId]: { default: 'Name of the Existing Data Stream in Kinesis Data Streams' }
        }
      }
    };

    // CFN Mappings
    const sourceCodeMapping = new CfnMapping(this, 'SourceCode', {
      mapping: {
        General: {
          S3Bucket: 'BUCKET_NAME_PLACEHOLDER',
          KeyPrefix: 'SOLUTION_NAME_PLACEHOLDER/VERSION_PLACEHOLDER'
        }
      }
    });
    const metricsMapping = new CfnMapping(this, 'Metrics', {
      mapping: {
        General: {
          SendAnonymousUsage: 'Yes'
        }
      }
    });
    const solutionMapping = new CfnMapping(this, 'Solution', {
      mapping: {
        Parameters: {
          Id: 'SO0070',
          Version: 'VERSION_PLACEHOLDER',
          JobMetadataPrefix: 'job-metadata/'
        }
      }
    });

    // CFN Conditions
    const sendAnonymousUsageCondition = new CfnCondition(this, 'SendAnonymousUsage', {
      expression: Fn.conditionEquals(metricsMapping.findInMap('General', 'SendAnonymousUsage'), 'Yes')
    });
    const createGreengrassResourcesCondition = new CfnCondition(this, 'CreateGreengrassResources', {
      expression: Fn.conditionEquals(existingGreengrassGroupIDParameter.valueAsString, '')
    });
    const createKinesisResourcesCondition = new CfnCondition(this, 'CreateKinesisResources', {
      expression: Fn.conditionEquals(existingKinesisStreamNameParameter.valueAsString, '')
    });

    // Common Resources
    const commonResources = new CommonResourcesConstruct(this, 'M2C2CommonResources');

    // Kinesis Streams, Kinesis Firehose, S3
    const dataStream = new DataStreamConstruct(this, 'M2C2Data', {
      s3LoggingBucket: commonResources.getS3LoggingBucket()
    });
    Aspects.of(dataStream).add(new ConditionAspect(createKinesisResourcesCondition));
    this.kinesisStreamName = Fn.conditionIf(createKinesisResourcesCondition.logicalId,
      dataStream.getKinesisStreamName(),
      existingKinesisStreamNameParameter.valueAsString).toString();


    // Custom Resources
    const customResources = new CustomResourcesConstruct(this, 'M2C2CustomResources', {
      cloudWatchLogsPolicy: commonResources.getCloudWatchLogsPolicy(),
      existingGreengrassGroup: existingGreengrassGroupIDParameter.valueAsString,
      existingKinesisStream: existingKinesisStreamNameParameter.valueAsString,
      sendAnonymousUsageCondition,
      solutionMapping,
      sourceCodeMapping
    });

    // Greengrass resources
    const greengrassResources = new GreengrassConstruct(this, 'M2C2GreengrassResources', {
      kinesisStreamName: this.kinesisStreamName,
      s3BucketName: commonResources.getS3BucketName(),
      solutionMapping,
      sourceCodeMapping
    });
    Aspects.of(greengrassResources).add(new ConditionAspect(createGreengrassResourcesCondition));

    // Job Builder resources
    const jobBuilder = new JobBuilderConstruct(this, 'M2C2JobBuilder', {
      cloudWatchLogsPolicy: commonResources.getCloudWatchLogsPolicy(),
      greengrassGroupId: Fn.conditionIf(createGreengrassResourcesCondition.logicalId, greengrassResources.getM2C2GreengrassGroup(), existingGreengrassGroupIDParameter.valueAsString).toString(),
      kinesisStreamName: this.kinesisStreamName,
      s3LoggingBucket: commonResources.getS3LoggingBucket(),
      s3Bucket: commonResources.getS3Bucket(),
      sendAnonymousUsage: metricsMapping.findInMap('General', 'SendAnonymousUsage'),
      sourceCodeMapping,
      solutionMapping,
      uuid: customResources.getUuid()
    });

    // Define the outputs
    new CfnOutput(this, 'CertKeyPairS3URL', {
      condition: createGreengrassResourcesCondition,
      description: "The solution generated a certificate and key pair for your Greengrass instance. Use this URL to download the tar archive to install on your Greengrass instance.",
      value: greengrassResources.getPresignedS3URL()
    });

    new CfnOutput(this, 'CertificateId', {
      condition: createGreengrassResourcesCondition,
      description: "ID of certificate generated by the solution.",
      value: greengrassResources.getCertId()
    });

    new CfnOutput(this, 'CertificateArn', {
      condition: createGreengrassResourcesCondition,
      description: "ARN of certificate generated by the solution.",
      value: greengrassResources.getCertArn()
    });

    new CfnOutput(this, 'M2C2DeviceGatewayThing', {
      condition: createGreengrassResourcesCondition,
      description: "The name of the IoT Device Gateway",
      value: greengrassResources.getM2C2DeviceGatewayThing()
    });

    new CfnOutput(this,'M2C2DeviceGatewayThingArn', {
      condition: createGreengrassResourcesCondition,
      description:  "The ARN of the IoT Device Gateway",
      value: greengrassResources.getM2C2DeviceGatewayThingArn()
    });

    new CfnOutput(this, 'M2C2GreengrassGroup', {
      description: "Greengrass group that needs to be deployed to the on-premises gateway",
      value: Fn.conditionIf(createGreengrassResourcesCondition.logicalId, greengrassResources.getM2C2GreengrassGroup(), existingGreengrassGroupIDParameter.logicalId).toString()
    });

    new CfnOutput(this, 'M2C2JobRequestTopic', {
      description: 'IoT Topic where jobs need to be submitted',
      value: 'm2c2/job/request'
    });
    new CfnOutput(this, 'M2C2DataBucket', {
      condition: createKinesisResourcesCondition,
      description: 'Bucket where the job telemetry data will be stored',
      value: dataStream.getS3BucketName()
    });
    new CfnOutput(this, 'M2C2KinesisStream', {
      description: 'The Kinesis Data Stream that sends Greengrass Stream Manager data',
      value: this.kinesisStreamName
    });
    new CfnOutput(this, 'M2C2Bucket', {
      description: 'Bucket where the job files will be stored',
      value: commonResources.getS3BucketName()
    });
    new CfnOutput(this, 'M2C2JobMetadataTable', {
      description: 'The DynamoDB table where the jobs will be stored',
      value: jobBuilder.getDynamoDbTableName()
    });
    new CfnOutput(this, 'UUID', {
      description: 'Solution UUID',
      value: customResources.getUuid()
    });
  }
}
