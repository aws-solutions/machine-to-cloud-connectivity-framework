// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Stack, CfnMapping } from '@aws-cdk/core';
import { Effect, Policy, PolicyStatement } from '@aws-cdk/aws-iam';
import {Bucket} from '@aws-cdk/aws-s3';
import { GreengrassConstruct } from '../lib/greengrass';

test('M2C2 greengrass resource creation test', () => {
    const stack = new Stack();
    const sourceCodeMapping = new CfnMapping(stack, 'SourceCode', {
        mapping: {
          General: {
            S3Bucket: 'Bucket',
            KeyPrefix: 'Prefix'
          }
        }
      });
    const solutionMapping = new CfnMapping(stack, 'Solution', {
      mapping: {
        Parameters: {
          Id: 'SO0070',
          Version: 'v2.2.0',
          JobMetadataPrefix: 'job-metadata/'
        }
      }
    });
    const kinesisStreamName = 'TestStreamArn';
    const s3BucketName = new Bucket(stack, 'TestM2C2Bucket').bucketName;
    const greengrass = new GreengrassConstruct(stack, 'TestGreengrass', { kinesisStreamName, s3BucketName, sourceCodeMapping, solutionMapping});


    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    expect(greengrass.getPresignedS3URL()).toBeDefined();
    expect(greengrass.getCertId()).toBeDefined();
    expect(greengrass.getCertArn()).toBeDefined();
    expect(greengrass.getM2C2DeviceGatewayThing()).toBeDefined();
    expect(greengrass.getM2C2DeviceGatewayThingArn()).toBeDefined();
    expect(greengrass.getM2C2GreengrassGroup()).toBeDefined();
})