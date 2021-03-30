// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Construct, RemovalPolicy } from '@aws-cdk/core';
import { Effect, Policy, PolicyStatement, ServicePrincipal } from '@aws-cdk/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption, CfnBucket } from '@aws-cdk/aws-s3';

/**
 * Machine to Cloud Connectivity Framework Common Resources
 */
export class CommonResourcesConstruct extends Construct {
  // CloudWatch Logs policy
  private cloudWatchLogsPolicy: Policy;
  // S3 Logging bucket
  private s3LoggingBucket: Bucket;
  // S3 Resource Storage bucket
  private s3Bucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.cloudWatchLogsPolicy = new Policy(this, 'CloudWatchLogsPolicy', {
      statements: [
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

    this.s3LoggingBucket = new Bucket(this, 'LogBucket', {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN
    });
    const cfnBucket = this.s3LoggingBucket.node.defaultChild as CfnBucket;
    cfnBucket.addMetadata('cfn_nag', {
      rules_to_suppress: [
        { id: 'W35', reason: 'This bucket is to store S3 logs, so it does not require access logs.' },
        { id: 'W51', reason: 'This bucket is to store S3 logs, so it does not require S3 policy.' }
      ]
    });

    this.s3Bucket = new Bucket(this, 'M2C2Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: this.s3LoggingBucket,
      serverAccessLogsPrefix: 'm2c2/'
    });
    this.s3Bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [ new ServicePrincipal('lambda.amazonaws.com') ],
        actions: [
          's3:GetObject',
          's3:PutObject'
        ],
        resources: [
          `${this.s3Bucket.bucketArn}/*`
        ]
      })
    );
  }

  /**
   * Get CloudWatch Logs policy.
   * @return {Policy} CloudWatch Logs policy
   */
  getCloudWatchLogsPolicy(): Policy {
    return this.cloudWatchLogsPolicy;
  }

  /**
   * Get S3 logging bucket.
   * @return {Bucket} Logging bucket
   */
  getS3LoggingBucket(): Bucket {
    return this.s3LoggingBucket;
  }

  /**
   * Get S3 M2C2 bucket.
   * @return {Bucket} M2C2 bucket
   */
  getS3Bucket(): Bucket {
    return this.s3Bucket;
  }

  /**
   * Get S3 M2C2 bucket name
   * @return {string} M2C2 bucket name
   */
  getS3BucketName(): string {
    return this.s3Bucket.bucketName;
  }
}