// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { Stack, aws_s3 as s3 } from 'aws-cdk-lib';
import { UiConstruct } from '../lib/frontend/ui';

test('M2C2 UI test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new s3.Bucket(stack, 'TestLoggingBucket');
  (<s3.CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const resourceBucket = new s3.Bucket(stack, 'TestGreengrassResourceBucket');
  (<s3.CfnBucket>resourceBucket.node.defaultChild).overrideLogicalId('TestGreengrassResourceBucket');

  const ui = new UiConstruct(stack, 'TestUi', {
    apiId: 'mock-id',
    resourceBucket,
    userEmail: 'mockmail',
    cloudFrontDomainName: 'test-domain-name'
  });

  expect(ui.identityPoolId).toBeDefined();
  expect(ui.userPoolId).toBeDefined();
  expect(ui.webClientId).toBeDefined();
  Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
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
