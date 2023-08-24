// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnCondition, Stack, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';
import { CustomResourcesConstruct } from '../lib/custom-resource/custom-resources';

const cloudWatchLogsPolicy = new iam.PolicyDocument({
  statements: [
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['logs:*'],
      actions: ['*']
    })
  ]
});

test('M2C2 custom resources test', () => {
  const stack = new Stack();
  const customResource = new CustomResourcesConstruct(stack, 'TestCustomResources', {
    cloudWatchLogsPolicy: cloudWatchLogsPolicy,
    existingKinesisStream: '',
    existingTimestreamDatabase: '',
    sendAnonymousUsageCondition: new CfnCondition(stack, 'TestCondition'),
    solutionConfig: {
      loggingLevel: 'ERROR',
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      sourceCodeBucket: s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region'),
      sourceCodePrefix: 'v0.0.1-test/machine-to-cloud-connectivity-framework'
    }
  });

  expect(customResource.customResourceFunction).toBeDefined();
  expect(customResource.customResourceFunctionRole).toBeDefined();
  expect(customResource.iotCredentialProviderEndpoint).toBeDefined();
  expect(customResource.iotDataAtsEndpoint).toBeDefined();
});

test('M2C2 setup UI custom resource test', () => {
  const stack = new Stack();
  const customResource = new CustomResourcesConstruct(stack, 'TestCustomResources', {
    cloudWatchLogsPolicy: cloudWatchLogsPolicy,
    existingKinesisStream: 'Existing',
    existingTimestreamDatabase: '',
    sendAnonymousUsageCondition: new CfnCondition(stack, 'TestCondition'),
    solutionConfig: {
      loggingLevel: 'ERROR',
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      sourceCodeBucket: s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region'),
      sourceCodePrefix: 'v0.0.1-test/machine-to-cloud-connectivity-framework'
    }
  });
  customResource.setupUi({
    apiEndpoint: 'https://mock-api.com',
    identityPoolId: 'mock-identity-pool-id',
    loggingLevel: 'ERROR',
    resourceS3Bucket: s3.Bucket.fromBucketName(stack, 'TestGreengrassResourceBucket', 'test-greengrass-bucket'),
    uiBucket: s3.Bucket.fromBucketName(stack, 'TestUIBucket', 'test-ui-bucket'),
    userPoolId: 'mock-user-pool-id',
    webClientId: 'mock-user-pool-web-client-id'
  });

  expect(customResource.customResourceFunction).toBeDefined();
});

test('M2C2 setup Greengrass v2 custom resource test', () => {
  const stack = new Stack();
  const customResource = new CustomResourcesConstruct(stack, 'TestCustomResources', {
    cloudWatchLogsPolicy: cloudWatchLogsPolicy,
    existingKinesisStream: '',
    existingTimestreamDatabase: 'Existing',
    sendAnonymousUsageCondition: new CfnCondition(stack, 'TestCondition'),
    solutionConfig: {
      loggingLevel: 'ERROR',
      solutionId: 'SO0070-Test',
      solutionVersion: 'v0.0.1-test',
      sourceCodeBucket: s3.Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region'),
      sourceCodePrefix: 'v0.0.1-test/machine-to-cloud-connectivity-framework'
    }
  });
  customResource.setupGreengrassV2({
    greengrassIoTPolicyName: 'mock-greengrass-iot-policy-name',
    greengrassV2ResourceBucket: s3.Bucket.fromBucketName(
      stack,
      'TestGreengrassV2ResourceBucket',
      'test-greengrass-v2-resource-bucket'
    ),
    iotCredentialsRoleArn: 'arn:of:iot:credentials:role',
    iotPolicyName: 'mock-iot-policy-name',
    iotRoleAliasName: 'mock-iot-role-alias-name'
  });

  expect(customResource.iotCertificateArn).toBeDefined();
});
