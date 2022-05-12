// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// PREPARE
import { LambdaError } from '../errors';

test('Test to throw LambdaError with the default parameters', () => {
  try {
    throw new LambdaError({
      message: 'An error happened.'
    });
  } catch (error) {
    expect(error.message).toEqual('An error happened.');
    expect(error.name).toEqual('LambdaError');
    expect(error.statusCode).toEqual(500);
  }
});

test('Test to throw LambdaError with the customized name', () => {
  try {
    throw new LambdaError({
      message: 'An error happened.',
      name: 'CustomError'
    });
  } catch (error) {
    expect(error.message).toEqual('An error happened.');
    expect(error.name).toEqual('CustomError');
    expect(error.statusCode).toEqual(500);
  }
});

test('Test to throw LambdaError with the customized status code', () => {
  try {
    throw new LambdaError({
      message: 'Not found.',
      statusCode: 404
    });
  } catch (error) {
    expect(error.message).toEqual('Not found.');
    expect(error.name).toEqual('LambdaError');
    expect(error.statusCode).toEqual(404);
  }
});
