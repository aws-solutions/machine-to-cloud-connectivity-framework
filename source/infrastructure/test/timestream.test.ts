// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { CfnCondition, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnDatabase, CfnTable } from 'aws-cdk-lib/aws-timestream';
import { TimestreamConstruct } from '../lib/data-flow/timestream';

const loggingLevel = 'ERROR';
const solutionId = 'SO0070-Test';
const solutionVersion = 'v0.0.1-test';
const sourceCodePrefix = `machine-to-cloud-connectivity-framework/${solutionVersion}`;
const uuid = 'test-uuid';

test('M2C2 Timestream test snapshot and default values', () => {
  const stack = new Stack();
  const sourceCodeBucket = Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region');
  const timestream = new TimestreamConstruct(stack, 'TestTimestream', {
    existingDatabaseName: '',
    solutionConfig: {
      loggingLevel,
      solutionId,
      solutionVersion,
      sourceCodeBucket,
      sourceCodePrefix,
      uuid
    },
    customResourcesFunctionArn: '',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });
  const table = <CfnTable>timestream.node.findChild('Table');
  table.overrideLogicalId('TestTable');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(timestream.kinesisStreamName).toBeDefined();
  expect(timestream.timestreamDatabaseTable).toBeDefined();
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        LOGGING_LEVEL: 'ERROR',
        SOLUTION_ID: solutionId,
        SOLUTION_VERSION: solutionVersion
      }
    },
    Handler: 'timestream-writer/index.handler',
    Runtime: 'nodejs16.x',
    Timeout: 30
  });
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'timestream:WriteRecords',
          Effect: 'Allow',
          Resource: {
            'Fn::GetAtt': ['TestTable', 'Arn']
          }
        },
        {
          Action: 'timestream:DescribeEndpoints',
          Effect: 'Allow',
          Resource: '*'
        }
      ]
    }
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Kinesis::Stream', 1);
});

test('M2C2 Timestream test when Timestream database name parameter is provided', () => {
  const stack = new Stack();
  const sourceCodeBucket = Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region');
  const timestream = new TimestreamConstruct(stack, 'TestTimestream', {
    existingDatabaseName: 'test-database',
    solutionConfig: {
      loggingLevel,
      solutionId,
      solutionVersion,
      sourceCodeBucket,
      sourceCodePrefix,
      uuid
    },
    customResourcesFunctionArn: '',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });
  const database = <CfnDatabase>timestream.node.findChild('Database');
  database.overrideLogicalId('TestDatabase');
  const condition = <CfnCondition>timestream.node.findChild('CreateTimestreamDatabase');
  condition.overrideLogicalId('TestCondition');

  expect(stack).toHaveResourceLike('AWS::Timestream::Table', {
    DatabaseName: {
      'Fn::If': [
        'TestCondition',
        {
          Ref: 'TestDatabase'
        },
        'test-database'
      ]
    }
  });
});

test('M2C2 Timestream test when Timestream database name parameter is empty', () => {
  const stack = new Stack();
  const sourceCodeBucket = Bucket.fromBucketName(stack, 'SourceCodeBucket', 'test-bucket-region');
  const timestream = new TimestreamConstruct(stack, 'TestTimestream', {
    existingDatabaseName: '',
    solutionConfig: {
      loggingLevel,
      solutionId,
      solutionVersion,
      sourceCodeBucket,
      sourceCodePrefix,
      uuid
    },
    customResourcesFunctionArn: '',
    shouldTeardownData: new CfnCondition(stack, 'TestCondition')
  });
  const database = <CfnDatabase>timestream.node.findChild('Database');
  database.overrideLogicalId('TestDatabase');
  const condition = <CfnCondition>timestream.node.findChild('CreateTimestreamDatabase');
  condition.overrideLogicalId('TestCondition');

  expect(stack).toHaveResourceLike('AWS::Timestream::Table', {
    DatabaseName: {
      'Fn::If': [
        'TestCondition',
        {
          Ref: 'TestDatabase'
        },
        ''
      ]
    }
  });
});
