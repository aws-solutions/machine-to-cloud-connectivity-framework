// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack, aws_lambda as lambda, aws_s3 as s3 } from 'aws-cdk-lib';
import { ApiConstruct } from '../lib/backend/api';

test('M2C2 API test', () => {
  const stack = new Stack();
  const connectionBuilderLambdaFunction = new lambda.Function(stack, 'TestConnectionBuilder', {
    code: lambda.Code.fromBucket(
      s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket'),
      'connection-builder.zip'
    ),
    handler: 'connection-builder/index.handler',
    runtime: lambda.Runtime.NODEJS_18_X
  });

  const api = new ApiConstruct(stack, 'TestApi', { connectionBuilderLambdaFunction, corsOrigin: '*' });
  expect(api.apiEndpoint).toBeDefined();
  expect(api.apiId).toBeDefined();
});
