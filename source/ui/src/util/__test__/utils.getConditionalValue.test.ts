// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getConditionalValue } from '../utils';

test('return false value when condition is an empty string', () => {
  expect(getConditionalValue<boolean>('', true, false)).toBeFalsy();
});

test('return false value when condition is undefined', () => {
  expect(getConditionalValue<boolean>(undefined, true, false)).toBeFalsy();
});

test('return true value when condition is a string', () => {
  expect(getConditionalValue<boolean>('string', true, false)).toBeTruthy();
});

test('return true value when condition is true', () => {
  expect(getConditionalValue<boolean>(true, true, false)).toBeTruthy();
});

test('return false value when condition is 0', () => {
  expect(getConditionalValue<boolean>(0, true, false)).toBeFalsy();
});

test('return true value when condition is 1', () => {
  expect(getConditionalValue<boolean>(1, true, false)).toBeTruthy();
});

test('return true value when condition is an object', () => {
  expect(getConditionalValue<boolean>({}, true, false)).toBeTruthy();
});
