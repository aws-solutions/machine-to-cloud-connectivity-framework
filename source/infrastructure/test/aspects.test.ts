// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@aws-cdk/assert/jest';
import { SynthUtils } from '@aws-cdk/assert';
import { Aspects, CfnCondition, CfnResource, Stack } from 'aws-cdk-lib';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { ConditionAspect } from '../utils/aspects';

describe('ConditionAspect', () => {
  test('Add condition to all resources', () => {
    const stack = new Stack();
    const condition = new CfnCondition(stack, 'TestCondition');
    const lambdaFunction = new LambdaFunction(stack, 'TestLambdaFunction', {
      code: Code.fromInline(`console.log('Hello world!');`),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_16_X
    });
    Aspects.of(stack).add(new ConditionAspect(condition));

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    const cfnResource = <CfnResource>lambdaFunction.node.defaultChild;
    expect(cfnResource.cfnOptions.condition).toEqual(condition);
  });
});
