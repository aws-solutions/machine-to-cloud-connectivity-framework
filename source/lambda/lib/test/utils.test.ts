// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAxios, mockCuid2, UPPER_ALPHA_NUMERIC } from './mock';
import { LambdaError } from '../errors';
import { ConnectionControl } from '../types/solution-common-types';
import {
  getAwsSdkOptions,
  generateUniqueId,
  isValidVersion,
  sendAnonymousMetric,
  sleep,
  trimAllStringInObjectOrArray
} from '../utils';

describe('Unit tests of getAwsSdkOptions() function', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('Test with the default parameter', () => {
    delete process.env.SOLUTION_ID;
    delete process.env.SOLUTION_VERSION;
    expect(getAwsSdkOptions()).toEqual({});
  });

  test('Test with the optional inputs parameter', () => {
    expect(getAwsSdkOptions({ custom: 'value' })).toEqual({ custom: 'value' });
  });

  test('Test with the solution ID only', () => {
    process.env.SOLUTION_ID = 'TestId001';
    expect(getAwsSdkOptions()).toEqual({});
  });

  test('Test with the solution version only', () => {
    delete process.env.SOLUTION_ID;
    process.env.SOLUTION_VERSION = 'TestVersion001';
    expect(getAwsSdkOptions()).toEqual({});
  });

  test('Test with the solution ID and version', () => {
    process.env.SOLUTION_ID = 'TestId002';
    process.env.SOLUTION_VERSION = 'TestVersion002';
    expect(getAwsSdkOptions()).toEqual({
      customUserAgent: `AwsSolution/TestId002/TestVersion002`
    });
  });

  test('Test with the optional inputs parameter and the solution ID and version', () => {
    process.env.SOLUTION_ID = 'TestId003';
    process.env.SOLUTION_VERSION = 'TestVersion003';
    expect(getAwsSdkOptions({ custom: 'value' })).toEqual({
      custom: 'value',
      customUserAgent: `AwsSolution/TestId003/TestVersion003`
    });
  });
});

describe('Unit tests of generateUniqueId() function', () => {
  test('Test with the default parameter', () => {
    mockCuid2.mockImplementationOnce(() => () => UPPER_ALPHA_NUMERIC.slice(0, 4));
    expect(generateUniqueId()).toEqual(UPPER_ALPHA_NUMERIC.slice(0, 4));
  });

  test('Test with the length parameter', () => {
    mockCuid2.mockImplementationOnce(() => () => UPPER_ALPHA_NUMERIC.slice(0, 8));
    expect(generateUniqueId(8)).toEqual(UPPER_ALPHA_NUMERIC.slice(0, 8));
  });
});

describe('Unit tests of sleep() function', () => {
  const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

  test('Test if it sleeps correctly', async () => {
    await sleep(0.1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 100);
  });
});

describe('Unit tests of sendAnonymousMetric() function', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error');

  test('Test to send anonymous metric successfully', async () => {
    mockAxios.mockResolvedValue({ status: 200 });
    await sendAnonymousMetric({ EventType: ConnectionControl.DEPLOY }, 'uuid');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test to fail to send anonymous metric', async () => {
    mockAxios.mockRejectedValueOnce('Error');
    await sendAnonymousMetric({ EventType: ConnectionControl.DEPLOY }, 'uuid');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending an anonymous metric: ', 'Error');
  });
});

test('Unit tests of trimAllStringInObjectOrArray() function', () => {
  expect(trimAllStringInObjectOrArray({})).toEqual({});
  expect(trimAllStringInObjectOrArray({ a: ' need to trim ' })).toEqual({ a: 'need to trim' });
  expect(trimAllStringInObjectOrArray({ a: [' need to trim '] })).toEqual({ a: ['need to trim'] });
  expect(trimAllStringInObjectOrArray({ a: { b: ' need to trim ' } })).toEqual({ a: { b: 'need to trim' } });
  expect(trimAllStringInObjectOrArray({ a: { b: ' need to trim ' }, c: 1 })).toEqual({
    a: { b: 'need to trim' },
    c: 1
  });
  expect(trimAllStringInObjectOrArray({ a: [[' need to trim '], ['fine']] })).toEqual({
    a: [['need to trim'], ['fine']]
  });
  expect(trimAllStringInObjectOrArray({ a: [{ b: ' need to trim ' }] })).toEqual({ a: [{ b: 'need to trim' }] });
  expect(trimAllStringInObjectOrArray({ a: [{ b: [' need to trim '] }] })).toEqual({ a: [{ b: ['need to trim'] }] });
  expect(
    trimAllStringInObjectOrArray({
      a: ' need to trim ',
      b: { c: 'need to trim ', d: ' need to trim', e: [{ f: ' need to trim ' }] }
    })
  ).toEqual({
    a: 'need to trim',
    b: { c: 'need to trim', d: 'need to trim', e: [{ f: 'need to trim' }] }
  });
  expect(trimAllStringInObjectOrArray({ a: [1, 2, 3], b: 1 })).toEqual({ a: [1, 2, 3], b: 1 });
  expect(() => trimAllStringInObjectOrArray('error')).toThrow(
    new LambdaError({
      message: 'Invalid object',
      name: 'UtilsInvalidObject',
      statusCode: 400
    })
  );
});

test('Unit tests of isValidVersion() function', () => {
  expect(isValidVersion('0.0.0')).toEqual(true);
  expect(isValidVersion('1.0.0')).toEqual(true);
  expect(isValidVersion('10.0.0')).toEqual(true);
  expect(isValidVersion('1.1.0')).toEqual(true);
  expect(isValidVersion('1.1.1')).toEqual(true);
  expect(isValidVersion('1.10.10')).toEqual(true);
  expect(isValidVersion('01.0.0')).toEqual(false);
  expect(isValidVersion('0.01.0')).toEqual(false);
  expect(isValidVersion('0.0.01')).toEqual(false);
  expect(isValidVersion('0.0')).toEqual(false);
  expect(isValidVersion('0.0.x')).toEqual(false);
  expect(isValidVersion('x.y.z')).toEqual(false);
  expect(isValidVersion('v1.0.0')).toEqual(false);
});
