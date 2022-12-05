// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { UiConstruct } from '../lib/frontend/ui';

test('M2C2 UI test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  (<CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const resourceBucket = new Bucket(stack, 'TestGreengrassResourceBucket');
  (<CfnBucket>resourceBucket.node.defaultChild).overrideLogicalId('TestGreengrassResourceBucket');

  const ui = new UiConstruct(stack, 'TestUi', {
    apiId: 'mock-id',
    resourceBucket,
    userEmail: 'mockmail',
    cloudFrontDomainName: 'test-domain-name'
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(ui.identityPoolId).toBeDefined();
  expect(ui.userPoolId).toBeDefined();
  expect(ui.webClientId).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    CorsConfiguration: {
      CorsRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET'],
          AllowedOrigins: ['https://test-domain-name'],
          ExposedHeaders: ['ETag']
        }
      ]
    }
  });
});
