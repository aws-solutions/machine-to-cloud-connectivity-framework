// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Match, Template } from 'aws-cdk-lib/assertions';
import { Aspects, CfnCondition, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import { ConditionAspect } from '../utils/aspects';

describe('ConditionAspect', () => {
  test('Add condition to all resources', () => {
    const stack = new Stack();
    const condition = new CfnCondition(stack, 'TestCondition');
    const lambdaFunctions: lambda.Function[] = [];
    lambdaFunctions.push(
      new lambda.Function(stack, 'TestLambdaFunction', {
        code: lambda.Code.fromInline(`console.log('Hello world!');`),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_18_X
      })
    );
    Aspects.of(stack).add(new ConditionAspect(condition));

    Template.fromStack(stack).hasResource('AWS::Lambda::Function', {
      Condition: Match.stringLikeRegexp('TestCondition')
    });
  });
});
