// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { KinesisStreamsToKinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisstreams-kinesisfirehose-s3';

/**
 * DataStreamConstruct props
 * @interface DataStreamConstructProps
 */
export interface DataStreamConstructProps {
  // Logging S3 Bucket
  readonly s3LoggingBucket: Bucket;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework Data Stream Construct.
 * It creates a Kinesis data stream, a Kinesis data firehose, and a data S3 bucket.
 */
export class DataStreamConstruct extends Construct {
  // Kinesis Data Stream name
  public kinesisStreamName: string;
  // Data S3 Bucket name
  public dataBucketName: string;

  constructor(scope: Construct, id: string, props: DataStreamConstructProps) {
    super(scope, id);

    const kinesisStreamsToKinesisFirehoseToS3 = new KinesisStreamsToKinesisFirehoseToS3(this, 'DataStream', {
      existingLoggingBucketObj: props.s3LoggingBucket,
      bucketProps: {
        serverAccessLogsPrefix: 'm2c2data/'
      }
    });
    this.kinesisStreamName = kinesisStreamsToKinesisFirehoseToS3.kinesisStream.streamName;
    this.dataBucketName = kinesisStreamsToKinesisFirehoseToS3.s3Bucket!.bucketName;
  }
}