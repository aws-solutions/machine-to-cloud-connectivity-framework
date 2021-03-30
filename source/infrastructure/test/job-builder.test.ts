// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnMapping, Stack } from '@aws-cdk/core';
import { Policy } from '@aws-cdk/aws-iam';
import { Bucket } from '@aws-cdk/aws-s3';
import { JobBuilderConstruct } from '../lib/job-builder';

test('M2C2 job builder test', () => {
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
        Id: 'SolutionId',
        Version: 'SolutionVersion',
        JobMetadataPrefix: 'job-metadata/'
      }
    }
  });
  const s3Bucket = new Bucket(stack, 'TestM2C2Bucket');
  const s3LoggingBucket = new Bucket(stack, 'TestLoggingBucket');
  const cloudWatchLogsPolicy = new Policy(stack, 'TestCloudWatchLogsPolicy');

  const jobBuilder = new JobBuilderConstruct(stack, 'TestJobBuilder', {
    cloudWatchLogsPolicy,
    greengrassGroupId: 'greengrass',
    kinesisStreamName: 'kinesis-stream',
    s3Bucket,
    s3LoggingBucket,
    sendAnonymousUsage: 'Yes',
    sourceCodeMapping,
    solutionMapping,
    uuid: 'uuid'
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(jobBuilder.getDynamoDbTableName()).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        CONNECTOR_LAMBDA_ROLE: {
          'Fn::GetAtt': ['TestJobBuilderConnectorLambdaRole3498718A', 'Arn']
        },
        GREENGRASS_ID: 'greengrass',
        JOB_BUILDER_KEY: {
          'Fn::FindInMap': [ 'Solution', 'Parameters', 'JobMetadataPrefix' ]
        },
        JOB_DYNAMODB_TABLE: {
          Ref: 'TestJobBuilderDynamoTable68BFEB1E'
        },
        KINESIS_STREAM: 'kinesis-stream',
        SEND_ANONYMOUS_METRIC: 'Yes',
        SOLUTION_ID: {
          'Fn::FindInMap': [ 'Solution', 'Parameters', 'Id' ]
        },
        SOLUTION_VERSION:{
          'Fn::FindInMap': [ 'Solution', 'Parameters', 'Version' ]
        },
        SOURCE_S3_BUCKET:  {
          'Fn::Join': [
            '',
            [
              {
                'Fn::FindInMap':[ 'SourceCode', 'General', 'S3Bucket' ]
              },
              '-',
              {
                Ref: 'AWS::Region'
              }
            ]
          ]
        },
        SOURCE_S3_PREFIX: {
          'Fn::FindInMap': [ 'SourceCode', 'General', 'KeyPrefix' ]
        },
        UUID: 'uuid'
      }
    }
  });
  expect(stack).toHaveResourceLike('AWS::DynamoDB::Table', {
    KeySchema: [
      {
        AttributeName: 'jobid',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'version',
        KeyType: 'RANGE'
      }
    ]
  });
});
