// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RemovalPolicy, Aws } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

/**
 * Creates a common CloudWatch Logs policy for Lambda functions.
 */
export class LoggingBucketConstruct extends Construct {
  public s3LoggingBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.s3LoggingBucket = new Bucket(this, 'LogBucket', {
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      bucketName: `${Aws.STACK_NAME}-${Aws.ACCOUNT_ID}-log`
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

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(this.s3LoggingBucket, [
      { id: 'AwsSolutions-S1', reason: 'This bucket is to store S3 logs, so it does not require access logs.' },
      { id: 'AwsSolutions-S2', reason: 'Public Access Blocking is handled by objectOwnership' }
    ]);
  }
}
