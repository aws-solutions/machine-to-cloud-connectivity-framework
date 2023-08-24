// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RemovalPolicy, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

/**
 * Creates a common CloudWatch Logs policy for Lambda functions.
 */
export class LoggingBucketConstruct extends Construct {
  public s3LoggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.s3LoggingBucket = new s3.Bucket(this, 'LogBucket', {
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    this.s3LoggingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:*'],
        conditions: {
          Bool: { 'aws:SecureTransport': 'false' }
        },
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        resources: [this.s3LoggingBucket.bucketArn, this.s3LoggingBucket.arnForObjects('*')]
      })
    );
    addCfnSuppressRules(this.s3LoggingBucket, [
      { id: 'W35', reason: 'This bucket is to store S3 logs, so it does not require access logs.' }
    ]);

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(this.s3LoggingBucket, [
      { id: 'AwsSolutions-S1', reason: 'This bucket is to store S3 logs, so it does not require access logs.' },
      { id: 'AwsSolutions-S2', reason: 'Public Access Blocking is handled by objectOwnership' }
    ]);
  }
}
