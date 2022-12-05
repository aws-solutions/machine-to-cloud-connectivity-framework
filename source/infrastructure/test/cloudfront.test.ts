// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnCondition, Stack } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CloudFrontConstruct } from '../lib/frontend/cloudfront';

test('M2C2 Cloudfront test', () => {
  const stack = new Stack();
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  (<CfnBucket>s3LoggingBucket.node.defaultChild).overrideLogicalId('TestLoggingBucket');
  const resourceBucket = new Bucket(stack, 'TestGreengrassResourceBucket');
  (<CfnBucket>resourceBucket.node.defaultChild).overrideLogicalId('TestGreengrassResourceBucket');

  const cf = new CloudFrontConstruct(stack, 'TestCF', {
    s3LoggingBucket: s3LoggingBucket,
    customResourcesFunctionArn: 'test-arn',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(cf.uiBucket).toBeDefined();
  expect(cf.cloudFrontDomainName).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'ui-s3/'
    }
  });
  expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
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
