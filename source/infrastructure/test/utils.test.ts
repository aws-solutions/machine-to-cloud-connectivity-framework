// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { CfnCondition, Fn, Stack, aws_s3 as s3 } from 'aws-cdk-lib';
import { addCfnSuppressRules, addOutputs } from '../utils/utils';

describe('addCfnSuppressRules', () => {
  test('Add a new CFN NAG suppression rule', () => {
    const suppressionRule = { id: 'mock', reason: 'mock reason' };
    const stack = new Stack();
    const s3Bucket = new s3.Bucket(stack, 'TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).overrideLogicalId('TestBucket');

    addCfnSuppressRules(s3Bucket, [suppressionRule]);
    Template.fromStack(stack).templateMatches({
      Resources: {
        TestBucket: {
          Type: 'AWS::S3::Bucket',
          UpdateReplacePolicy: 'Retain',
          DeletionPolicy: 'Retain',
          Metadata: {
            cfn_nag: {
              rules_to_suppress: [suppressionRule]
            }
          }
        }
      }
    });
  });

  test('Add a new CFN NAG suppression rule to the existing suppression rules', () => {
    const suppressionRules = [
      { id: 'mock-1', reason: 'mock reason 1' },
      { id: 'mock-2', reason: 'mock reason 2' }
    ];
    const stack = new Stack();
    const s3Bucket = new s3.Bucket(stack, 'TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).overrideLogicalId('TestBucket');

    addCfnSuppressRules(s3Bucket, [suppressionRules[0]]);
    addCfnSuppressRules(s3Bucket, [suppressionRules[1]]);
    Template.fromStack(stack).templateMatches({
      Resources: {
        TestBucket: {
          Type: 'AWS::S3::Bucket',
          UpdateReplacePolicy: 'Retain',
          DeletionPolicy: 'Retain',
          Metadata: {
            cfn_nag: {
              rules_to_suppress: [suppressionRules[1], suppressionRules[0]]
            }
          }
        }
      }
    });
  });

  test('Overwrite the existing CFN NAG suppression rules with the new rules', () => {
    const suppressionExistingRules = [
      { id: 'mock-1', reason: 'This will be gone' },
      { id: 'mock-3', reason: 'This exists' }
    ];
    const suppressionNewRules = [
      { id: 'mock-1', reason: 'mock reason 1' },
      { id: 'mock-2', reason: 'mock reason 2' }
    ];
    const stack = new Stack();
    const s3Bucket = new s3.Bucket(stack, 'TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).overrideLogicalId('TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).addMetadata('cfn_nag', {
      rules_to_suppress: suppressionExistingRules
    });

    addCfnSuppressRules(s3Bucket, suppressionNewRules);
    Template.fromStack(stack).templateMatches({
      Resources: {
        TestBucket: {
          Type: 'AWS::S3::Bucket',
          UpdateReplacePolicy: 'Retain',
          DeletionPolicy: 'Retain',
          Metadata: {
            cfn_nag: {
              rules_to_suppress: [suppressionNewRules[0], suppressionNewRules[1], suppressionExistingRules[1]]
            }
          }
        }
      }
    });
  });

  test('Overwrite new rules when rules_to_suppress is not an array', () => {
    const suppressionRules = [
      { id: 'mock-1', reason: 'mock reason 1' },
      { id: 'mock-2', reason: 'mock reason 2' }
    ];
    const stack = new Stack();
    const s3Bucket = new s3.Bucket(stack, 'TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).overrideLogicalId('TestBucket');
    (<s3.CfnBucket>s3Bucket.node.defaultChild).addMetadata('cfn_nag', {
      rules_to_suppress: 'invalid'
    });

    addCfnSuppressRules(s3Bucket, suppressionRules);
    Template.fromStack(stack).templateMatches({
      Resources: {
        TestBucket: {
          Type: 'AWS::S3::Bucket',
          UpdateReplacePolicy: 'Retain',
          DeletionPolicy: 'Retain',
          Metadata: {
            cfn_nag: {
              rules_to_suppress: suppressionRules
            }
          }
        }
      }
    });
  });
});

describe('addOutputs', () => {
  test('Add CloudFormation outputs', () => {
    const stack = new Stack();
    const condition = new CfnCondition(stack, 'MockCondition', {
      expression: Fn.conditionEquals('AlwaysYes', 'AlwaysYes')
    });
    const outputs = [
      { id: 'MockOutputWithoutCondition', description: 'The output does not have any condition.', value: 'Yes' },
      { id: 'MockOutputWithCondition', description: 'The output has a condition.', value: 'Yes', condition }
    ];
    addOutputs(stack, outputs);

    Template.fromStack(stack).templateMatches({
      Conditions: {
        MockCondition: {
          'Fn::Equals': ['AlwaysYes', 'AlwaysYes']
        }
      },
      Outputs: {
        MockOutputWithoutCondition: {
          Description: 'The output does not have any condition.',
          Value: 'Yes'
        },
        MockOutputWithCondition: {
          Description: 'The output has a condition.',
          Value: 'Yes',
          Condition: 'MockCondition'
        }
      }
    });
  });
});
