// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getErrorMessage } from '../utils';

test('Test to return `error.response.data.errorMessage`', () => {
  const errorMessage = 'Error from error.response.data.errorMessage';
  const error = {
    response: {
      data: { errorMessage: errorMessage }
    }
  };
  expect(getErrorMessage(error)).toEqual(errorMessage);
});

test('Test to return `error.response.data`', () => {
  const errorMessage = 'Error from error.response.data';
  const error = {
    response: {
      data: { mock: errorMessage }
    }
  };
  expect(getErrorMessage(error)).toEqual({ mock: errorMessage });
});

test('Test to return `error.message`', () => {
  const errorMessage = 'Error from error.message';
  const error = {
    response: {},
    message: errorMessage
  };
  expect(getErrorMessage(error)).toEqual(errorMessage);
});

test('Test to return `error`', () => {
  const errorMessage = 'Error from error';
  const error = { mock: errorMessage };
  expect(getErrorMessage(error)).toEqual({ mock: errorMessage });
});
