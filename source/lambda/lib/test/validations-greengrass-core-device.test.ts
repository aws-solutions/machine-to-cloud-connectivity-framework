// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// PREPARE
import { LambdaError } from '../errors';
import { GreengrassCoreDeviceControl } from '../types/connection-builder-types';
import { CreatedBy } from '../types/dynamodb-handler-types';
import { validateGreengrassCoreDeviceRequest } from '../validations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const input: any = {};

test('When `name` is missing, it throws an error', () => {
  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `name` is not a string, it throws an error', () => {
  input.name = 1;

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `name` contains unsupported characters, it throws an error', () => {
  input.name = 'unsupported@';

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `name` length is less than 1, it throws an error', () => {
  input.name = '';

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `name` length is larger than 128, it throws an error', () => {
  const name: string[] = [];
  for (let i = 0; i < 129; i++) name.push('a');
  input.name = name.join('');

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `control` is invalid, it throws an error', () => {
  input.name = 'it-should_be:fine-123';
  input.control = 'invalid';

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `Only "create" and "delete" controls are valid.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `createdBy` is invalid, it throws an error', () => {
  input.control = GreengrassCoreDeviceControl.CREATE;
  input.createdBy = 'invalid';

  expect(() => validateGreengrassCoreDeviceRequest(input)).toThrow(
    new LambdaError({
      message: `Only "System" and "User" are valid for "createdBy".`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When every value is valid, it does not throw an error', () => {
  input.control = GreengrassCoreDeviceControl.DELETE;
  input.createdBy = CreatedBy.SYSTEM;

  expect(() => validateGreengrassCoreDeviceRequest(input)).not.toThrow();

  input.createdBy = CreatedBy.USER;
  expect(() => validateGreengrassCoreDeviceRequest(input)).not.toThrow();
});
