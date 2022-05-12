// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { requestApi } from '../apis';
import { API_NAME } from '../utils';

const mockAPI = {
  get: jest.fn(),
  post: jest.fn()
};
jest.mock('@aws-amplify/api');
API.get = mockAPI.get;
API.post = mockAPI.post;

const mockResponse = { mock: 'response' };

beforeEach(() => {
  mockAPI.get.mockReset();
  mockAPI.post.mockReset();
});

test('GET API', async () => {
  mockAPI.get.mockResolvedValueOnce(mockResponse);

  const response = await requestApi({
    method: 'get',
    path: '/test'
  });

  expect(response).toEqual(mockResponse);
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/test', {});
});

test('POST API', async () => {
  mockAPI.post.mockResolvedValueOnce(mockResponse);

  const mockBody = {
    mock: 'test'
  };
  const response = await requestApi({
    method: 'post',
    path: '/test',
    options: mockBody
  });

  expect(response).toEqual(mockResponse);
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/test', { ...mockBody });
});
