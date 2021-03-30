// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { KinesisStreamsToKinesisFirehoseToS3 } from '@aws-solutions-constructs/aws-kinesisstreams-kinesisfirehose-s3';

/**
 * DataStreamConstruct props
 */
export interface DataStreamConstructProps {
  /**
   * Logging S3 Bucket
   */
  readonly s3LoggingBucket: Bucket;
}

/**
 * Machine to Cloud Connectivity Framework Kinesis Streams, Kinesis Firehose, and S3
 */
export class DataStreamConstruct extends Construct {
  // Kinesis Data Stream name
  private kinesisStreamName: string;
  // Data S3 Bucket name
  private s3BucketName: string;

  constructor(scope: Construct, id: string, props: DataStreamConstructProps) {
    super(scope, id);

    const kinesisStreamsToKinesisFirehoseToS3 = new KinesisStreamsToKinesisFirehoseToS3(this, 'DataStream', {
      existingLoggingBucketObj: props.s3LoggingBucket,
      bucketProps: {
        serverAccessLogsPrefix: 'm2c2data/'
      }
    });
    this.kinesisStreamName = kinesisStreamsToKinesisFirehoseToS3.kinesisStream.streamName;
    this.s3BucketName = kinesisStreamsToKinesisFirehoseToS3.s3Bucket!.bucketName;
  }

  /**
   * Get Kinesis Data Stream name.
   * @return {string} Kinesis Data Stream name
   */
  getKinesisStreamName(): string {
    return this.kinesisStreamName;
  }

  /**
   * Get data S3 Bucket name.
   * @return {string} S3 Bucket name
   */
  getS3BucketName(): string {
    return this.s3BucketName;
  }
}