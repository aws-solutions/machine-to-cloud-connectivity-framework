// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ArnFormat, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface CommonResourcesConstructProps {
  sourceCodeBucket: string;
}

/**
 * Creates a common CloudWatch Logs policy for Lambda functions and a logging S3 bucket.
 */
export class CommonResourcesConstruct extends Construct {
  public cloudWatchLogsPolicy: PolicyDocument;
  public s3LoggingBucket: Bucket;
  public sourceCodeBucket: IBucket;

  constructor(scope: Construct, id: string, props: CommonResourcesConstructProps) {
    super(scope, id);

    this.cloudWatchLogsPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: [
            Stack.of(this).formatArn({
              service: 'logs',
              resource: 'log-group',
              resourceName: '/aws/lambda/*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME
            })
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
    this.s3LoggingBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:*'],
        conditions: {
          Bool: { 'aws:SecureTransport': 'false' }
        },
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        resources: [this.s3LoggingBucket.bucketArn, this.s3LoggingBucket.arnForObjects('*')]
      })
    );
    addCfnSuppressRules(this.s3LoggingBucket, [
      { id: 'W35', reason: 'This bucket is to store S3 logs, so it does not require access logs.' }
    ]);

    this.sourceCodeBucket = Bucket.fromBucketName(this, 'SourceCodeBucket', props.sourceCodeBucket);

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(this.s3LoggingBucket, [
      { id: 'AwsSolutions-S1', reason: 'This bucket is to store S3 logs, so it does not require access logs.' }
    ]);
  }
}
