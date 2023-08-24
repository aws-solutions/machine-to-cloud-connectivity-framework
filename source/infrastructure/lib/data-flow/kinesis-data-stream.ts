// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CustomResource, CfnCondition, CfnCustomResource, Aspects, aws_s3 as s3, aws_iam as iam } from 'aws-cdk-lib';
import { KinesisStreamsToKinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisstreams-kinesisfirehose-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { ConditionAspect } from '../../utils/aspects';

export interface KinesisDataStreamConstructProps {
  readonly s3LoggingBucket: s3.Bucket;
  readonly customResourcesFunctionArn: string;
  readonly shouldTeardownData: CfnCondition;
  readonly shouldCreateKinesisResources: CfnCondition;
}

/**
 * Creates a Kinesis data stream, a Kinesis data firehose, a data S3 bucket, and related roles.
 */
export class KinesisDataStreamConstruct extends Construct {
  public kinesisStreamName: string;
  public dataBucketName: string;

  constructor(scope: Construct, id: string, props: KinesisDataStreamConstructProps) {
    super(scope, id);

    const kinesisStreamsToKinesisFirehoseToS3 = new KinesisStreamsToKinesisFirehoseToS3(this, 'DataStream', {
      existingLoggingBucketObj: props.s3LoggingBucket,
      bucketProps: {
        serverAccessLogsPrefix: 'm2c2data/'
      }
    });
    (<s3.Bucket>kinesisStreamsToKinesisFirehoseToS3.s3Bucket).addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'HttpsOnly',
        effect: iam.Effect.DENY,
        resources: [
          (<s3.Bucket>kinesisStreamsToKinesisFirehoseToS3.s3Bucket).arnForObjects('*'),
          (<s3.Bucket>kinesisStreamsToKinesisFirehoseToS3.s3Bucket).bucketArn
        ],
        actions: ['*'],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: { 'aws:SecureTransport': 'false' }
        }
      })
    );
    Aspects.of(kinesisStreamsToKinesisFirehoseToS3).add(new ConditionAspect(props.shouldCreateKinesisResources));
    Aspects.of(kinesisStreamsToKinesisFirehoseToS3.kinesisStreamRole).add(
      new ConditionAspect(props.shouldCreateKinesisResources)
    );
    this.kinesisStreamName = kinesisStreamsToKinesisFirehoseToS3.kinesisStream.streamName;
    this.dataBucketName = (<s3.Bucket>kinesisStreamsToKinesisFirehoseToS3.s3Bucket).bucketName;

    const teardownKinesisBucket = new CustomResource(this, 'TeardownKinesisBucket', {
      serviceToken: props.customResourcesFunctionArn,
      properties: {
        Resource: 'DeleteS3Bucket',
        BucketName: kinesisStreamsToKinesisFirehoseToS3.s3Bucket?.bucketName
      }
    });
    const cfnTeardownKinesisBucket = <CfnCustomResource>teardownKinesisBucket.node.defaultChild;
    cfnTeardownKinesisBucket.cfnOptions.condition = props.shouldTeardownData;

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      kinesisStreamsToKinesisFirehoseToS3,
      [
        { id: 'AwsSolutions-IAM5', reason: 'It specifies a bucket, so it is not a wildcard permission.' },
        { id: 'AwsSolutions-KDF1', reason: 'The data stream is encrypted.' }
      ],
      true
    );
  }
}
