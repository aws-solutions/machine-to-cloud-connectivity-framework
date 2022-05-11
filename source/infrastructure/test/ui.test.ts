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
    s3LoggingBucket,
    userEmail: 'mockmail'
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(ui.cloudFrontDomainName).toBeDefined();
  expect(ui.identityPoolId).toBeDefined();
  expect(ui.uiBucket).toBeDefined();
  expect(ui.userPoolId).toBeDefined();
  expect(ui.webClientId).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: 'TestLoggingBucket'
      },
      LogFilePrefix: 'ui-s3/'
    }
  });
  expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
    CorsConfiguration: {
      CorsRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET'],
          AllowedOrigins: [
            {
              'Fn::Join': [
                '',
                [
                  'https://',
                  {
                    'Fn::GetAtt': ['TestUiCloudFrontToS3CloudFrontDistribution97F3087A', 'DomainName']
                  }
                ]
              ]
            }
          ],
          ExposedHeaders: ['ETag']
        }
      ]
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
