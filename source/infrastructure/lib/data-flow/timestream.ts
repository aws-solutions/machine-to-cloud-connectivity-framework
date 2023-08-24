// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { KinesisStreamsToLambda } from '@aws-solutions-constructs/aws-kinesisstreams-lambda';
import {
  CfnCondition,
  CfnDeletionPolicy,
  Duration,
  Fn,
  CustomResource,
  CfnCustomResource,
  Aws,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_timestream as timestream,
  aws_s3 as s3
} from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface TimestreamConstructProps {
  readonly existingDatabaseName: string;
  readonly solutionConfig: {
    loggingLevel: string;
    solutionId: string;
    solutionVersion: string;
    sourceCodeBucket: s3.IBucket;
    sourceCodePrefix: string;
    uuid: string;
  };
  readonly customResourcesFunctionArn: string;
  readonly shouldTeardownData: CfnCondition;
}

/**
 * Creates a Lambda function, Kinesis Data Stream streams, Timestream database and table, and other related resources.
 */
export class TimestreamConstruct extends Construct {
  public kinesisStreamArn: string;
  public kinesisStreamName: string;
  public timestreamDatabaseTable: string;

  constructor(scope: Construct, id: string, props: TimestreamConstructProps) {
    super(scope, id);

    const sourceCodeBucket = props.solutionConfig.sourceCodeBucket;
    const sourceCodePrefix = props.solutionConfig.sourceCodePrefix;

    const createTimestreamDatabaseCondition = new CfnCondition(this, 'CreateTimestreamDatabase', {
      expression: Fn.conditionEquals(props.existingDatabaseName, '')
    });

    const timestreamDatabase = new timestream.CfnDatabase(this, 'Database', {
      databaseName: `${Aws.STACK_NAME}-${props.solutionConfig.uuid}`
    });
    timestreamDatabase.cfnOptions.condition = createTimestreamDatabaseCondition;
    timestreamDatabase.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;

    const timestreamDatabaseName = Fn.conditionIf(
      createTimestreamDatabaseCondition.logicalId,
      timestreamDatabase.ref,
      props.existingDatabaseName
    ).toString();

    const teardownTimestreamDatabase = new CustomResource(this, 'teardownTimestreamDatabase', {
      serviceToken: props.customResourcesFunctionArn,
      properties: {
        Resource: 'DeleteTimestreamDatabase',
        DatabaseName: timestreamDatabaseName
      }
    });
    const cfnTeardownGreengrassResourcesBucket = <CfnCustomResource>teardownTimestreamDatabase.node.defaultChild;
    cfnTeardownGreengrassResourcesBucket.cfnOptions.condition = props.shouldTeardownData;

    const timestreamTable = new timestream.CfnTable(this, 'Table', {
      databaseName: timestreamDatabaseName,
      retentionProperties: {
        MemoryStoreRetentionPeriodInHours: 24 * 90,
        MagneticStoreRetentionPeriodInDays: 365
      }
    });
    const timestreamTableName = timestreamTable.getAtt('Name').toString();
    const timestreamTableArn = timestreamTable.getAtt('Arn').toString();
    timestreamTable.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;

    const kinesisStreamsToLambda = new KinesisStreamsToLambda(this, 'KinesisLambda', {
      lambdaFunctionProps: {
        code: lambda.Code.fromBucket(sourceCodeBucket, `${sourceCodePrefix}/timestream-writer.zip`),
        description: 'Machine to Cloud Connectivity Framework Timestream data writer function',
        environment: {
          LOGGING_LEVEL: props.solutionConfig.loggingLevel,
          SOLUTION_ID: props.solutionConfig.solutionId,
          SOLUTION_VERSION: props.solutionConfig.solutionVersion,
          TIMESTREAM_DATABASE: timestreamDatabaseName,
          TIMESTREAM_TABLE: timestreamTableName
        },
        handler: 'timestream-writer/index.handler',
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: Duration.seconds(30)
      }
    });

    const lambdaFunctionPolicy = new iam.Policy(this, 'TimestreamPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['timestream:WriteRecords'],
          resources: [timestreamTableArn]
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['timestream:DescribeEndpoints'],
          resources: ['*']
        })
      ]
    });

    addCfnSuppressRules(lambdaFunctionPolicy, [
      { id: 'W12', reason: 'timestream:DescribeEndpoints cannot have specific resources.' }
    ]);

    const lambdaFunctionRole = <iam.Role>kinesisStreamsToLambda.lambdaFunction.role;
    lambdaFunctionRole.attachInlinePolicy(lambdaFunctionPolicy);

    this.kinesisStreamArn = kinesisStreamsToLambda.kinesisStream.streamArn;
    this.kinesisStreamName = kinesisStreamsToLambda.kinesisStream.streamName;
    this.timestreamDatabaseTable = `${timestreamDatabaseName}.${timestreamTableName}`;

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      kinesisStreamsToLambda,
      [
        { id: 'AwsSolutions-IAM5', reason: 'It does not allow wildcard permissions.' },
        { id: 'AwsSolutions-SQS3', reason: 'SqsDlqQueue is the dead letter queue.' }
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(timestreamDatabase, [
      { id: 'AwsSolutions-TS3', reason: 'The default KMS is used by default.' }
    ]);
    NagSuppressions.addResourceSuppressions(lambdaFunctionPolicy, [
      { id: 'AwsSolutions-IAM5', reason: 'timestream:DescribeEndpoints cannot have specific resources.' }
    ]);
  }
}
