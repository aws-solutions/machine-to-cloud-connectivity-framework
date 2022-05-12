// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Auth from '@aws-amplify/auth';
import { Logger } from '@aws-amplify/core';
import { signOut } from '../utils';

const { location } = window;
const authSpy = jest.spyOn(Auth, 'signOut');
const loggerSpy = jest.spyOn(Logger.prototype, 'error');

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete window.location;
  window.location = {
    ...location,
    reload: jest.fn()
  };
});
beforeEach(() => {
  authSpy.mockReset();
  loggerSpy.mockReset();
});
afterAll(() => (window.location = location));

test('Test success to sign out', async () => {
  authSpy.mockResolvedValueOnce(undefined);

  await signOut();
  expect(authSpy).toHaveBeenCalledTimes(1);
  expect(window.location.reload).toHaveBeenCalled();
  expect(loggerSpy).not.toHaveBeenCalled();
});

test('Test failure to sign out', async () => {
  authSpy.mockRejectedValueOnce('error');

  try {
    await signOut();
  } catch (error) {
    expect(error).toEqual('error');
  }

  expect(authSpy).toHaveBeenCalledTimes(1);
  expect(window.location.reload).not.toHaveBeenCalled();
  expect(loggerSpy).toHaveBeenCalledTimes(1);
  expect(loggerSpy).toHaveBeenCalledWith('Error while signing out the user.', 'error');
});
