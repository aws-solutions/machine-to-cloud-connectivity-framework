// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { KinesisStreamsToKinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisstreams-kinesisfirehose-s3';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface KinesisDataStreamConstructProps {
  readonly s3LoggingBucket: Bucket;
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
    this.kinesisStreamName = kinesisStreamsToKinesisFirehoseToS3.kinesisStream.streamName;
    this.dataBucketName = (<Bucket>kinesisStreamsToKinesisFirehoseToS3.s3Bucket).bucketName;

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
