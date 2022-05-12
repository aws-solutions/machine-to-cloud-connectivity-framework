// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { setValue } from '../utils';

const obj: Record<string, unknown> = {
  first: 'first',
  child: {
    second: 'second'
  }
};

test('Set value when the key exists', () => {
  const input = { ...obj };
  const response = setValue(input, 'first', 'new-first');

  expect(response).toEqual(true);
  expect(input.first).toEqual('new-first');
});

test('Set value when the key exists in the child object', () => {
  const input = { ...obj };
  const response = setValue(input, 'second', 'new-second');

  expect(response).toEqual(true);
  expect(input.child).toEqual({ second: 'new-second' });
});

test('Set value when the key is interval in the OPC DA object', () => {
  const input = { opcDa: { interval: 1 } };
  const response = setValue(input, 'interval', '1');

  expect(response).toEqual(true);
  expect(input.opcDa).toEqual({ interval: '1' });
});

test('Set value when the key is iterations in the OPC DA object', () => {
  const input = { opcDa: { iterations: 1 } };
  const response = setValue(input, 'iterations', '1');

  expect(response).toEqual(true);
  expect(input.opcDa).toEqual({ iterations: '1' });
});

test('Not set value when the input is not an object', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = 'string' as any;
  const response = setValue(input, 'first', 'new-first');

  expect(response).toEqual(false);
  expect(input).toEqual('string');
});

test('Not set value when the input is an array', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = [] as any;
  const response = setValue(input, 'first', 'new-first');

  expect(response).toEqual(false);
  expect(input).toEqual([]);
});

test('Not set value when the key does not exist in the child object', () => {
  const input = { ...obj };
  const response = setValue(input, 'third', 'new-third');

  expect(response).toEqual(false);
  expect(input).toEqual(obj);
});

test('Not set value when the type of value is different than the value of the key in the object', () => {
  const input = { ...obj };
  const response = setValue(input, 'first', 10);

  expect(response).toEqual(false);
  expect(input).toEqual(obj);
});
