// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface SourceBucketConstructProps {
  sourceCodeBucketName: string;
}

/**
 * Imports existing bucket containing source code
 */
export class SourceBucketConstruct extends Construct {
  public sourceCodeBucket: IBucket;

  constructor(scope: Construct, id: string, props: SourceBucketConstructProps) {
    super(scope, id);

    this.sourceCodeBucket = Bucket.fromBucketName(this, 'SourceCodeBucket', props.sourceCodeBucketName);
  }
}
