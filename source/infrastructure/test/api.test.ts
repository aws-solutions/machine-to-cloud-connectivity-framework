// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ApiConstruct } from '../lib/backend/api';

test('M2C2 API test', () => {
  const stack = new Stack();
  const connectionBuilderLambdaFunction = new LambdaFunction(stack, 'TestConnectionBuilder', {
    code: Code.fromBucket(Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket'), 'connection-builder.zip'),
    handler: 'connection-builder/index.handler',
    runtime: Runtime.NODEJS_16_X
  });

  const api = new ApiConstruct(stack, 'TestApi', { connectionBuilderLambdaFunction, corsOrigin: '*' });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(api.apiEndpoint).toBeDefined();
  expect(api.apiId).toBeDefined();
});
