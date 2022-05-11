// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildResponseBody, consoleErrorSpy, mockAxios, mockValues } from './mock';
import { handler } from '../index';
import { LambdaError } from '../../lib/errors';
import { StatusTypes } from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

beforeAll(() => {
  consoleErrorSpy.mockReset();
  mockAxios.put.mockReset();
});

test('Test failure when Resource is not supported', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event.ResourceProperties.Resource = 'Invalid' as any;
  const errorMessage = `Not supported custom resource type: ${event.ResourceProperties.Resource}`;

  mockAxios.put.mockResolvedValueOnce({ status: 200 });

  const response = await handler(event, context);
  const responseBody = buildResponseBody({
    event,
    response,
    reason: errorMessage
  });
  axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

  expect(response).toEqual({
    Status: StatusTypes.FAILED,
    Data: {
      Error: errorMessage
    }
  });
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[custom-resource]',
    'Error: ',
    new LambdaError({
      message: errorMessage,
      name: 'NotSupportedCustomResourceType',
      statusCode: 400
    })
  );
  expect(mockAxios.put).toHaveBeenCalledTimes(1);
  expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
});
