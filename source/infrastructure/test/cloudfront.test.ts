// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { CfnCondition, Stack, aws_s3 as s3 } from 'aws-cdk-lib';
import { CloudFrontConstruct } from '../lib/frontend/cloudfront';

test('M2C2 Cloudfront test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new s3.Bucket(stack, 'TestLoggingBucket');
  (<s3.CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const resourceBucket = new s3.Bucket(stack, 'TestGreengrassResourceBucket');
  (<s3.CfnBucket>resourceBucket.node.defaultChild).overrideLogicalId('TestGreengrassResourceBucket');

  const cf = new CloudFrontConstruct(stack, 'TestCF', {
    s3LoggingBucket: s3LoggingBucket,
    customResourcesFunctionArn: 'test-arn',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });

  expect(cf.uiBucket).toBeDefined();
  expect(cf.cloudFrontDomainName).toBeDefined();
  Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'ui-s3/'
    }
  });
  Template.fromStack(stack).hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      Logging: {
        Bucket: {
          'Fn::GetAtt': ['TestLoggingBucket', 'RegionalDomainName']
        },
        Prefix: 'ui-cf/'
      }
    }
  });
});
