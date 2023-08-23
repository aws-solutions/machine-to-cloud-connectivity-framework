// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SourceBucketConstructProps {
  sourceCodeBucketName: string;
}

/**
 * Imports existing bucket containing source code
 */
export class SourceBucketConstruct extends Construct {
  public sourceCodeBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: SourceBucketConstructProps) {
    super(scope, id);

    this.sourceCodeBucket = s3.Bucket.fromBucketName(this, 'SourceCodeBucket', props.sourceCodeBucketName);
  }
}
