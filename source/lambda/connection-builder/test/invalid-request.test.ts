// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, mockValue } from './mock';
import { LambdaError } from '../../lib/errors';
import { handler } from '../index';

test('Unit tests of GET other path', async () => {
  consoleErrorSpy.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/invalid',
    resource: '/invalid'
  };
  const error = new LambdaError({
    message: `Path not found: GET ${event.path}`,
    name: 'ConnectionBuilderError',
    statusCode: 404
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', error);
});

test('Unit tests of POST other path', async () => {
  consoleErrorSpy.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/invalid',
    resource: '/invalid'
  };
  const error = new LambdaError({
    message: `Path not found: POST ${event.path}`,
    name: 'ConnectionBuilderError',
    statusCode: 404
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', error);
});

test('Test http method other than GET or POST', async () => {
  consoleErrorSpy.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'PUT',
    path: '/invalid',
    resource: '/invalid'
  };
  const error = new LambdaError({
    message: `Not supported http method: ${event.httpMethod}`,
    name: 'ConnectionBuilderError',
    statusCode: 405
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', error);
});

test('Test headers are missing', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    httpMethod: 'GET',
    path: '/connections',
    resource: '/connections'
  };
  const error = new LambdaError({
    message: 'Invalid Host header',
    name: 'ConnectionBuilderError',
    statusCode: 400
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
});

test('Test Host header is missing', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: {},
    httpMethod: 'GET',
    path: '/connections',
    resource: '/connections'
  };
  const error = new LambdaError({
    message: 'Invalid Host header',
    name: 'ConnectionBuilderError',
    statusCode: 400
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
});

test('Test Host header does not equal to the API endpoint', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: 'invalid' },
    httpMethod: 'GET',
    path: '/connections',
    resource: '/connections'
  };
  const error = new LambdaError({
    message: 'Invalid Host header',
    name: 'ConnectionBuilderError',
    statusCode: 400
  });

  const response = await handler(event);
  expect(response).toEqual({
    headers: mockValue.headers,
    statusCode: error.statusCode,
    body: JSON.stringify({ errorMessage: error.message })
  });
});
