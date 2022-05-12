// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { validateGreengrassCoreDeviceName } from '../validations';

test('Name is not string', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(validateGreengrassCoreDeviceName(1 as any)).toBeFalsy();
});

test('Name is empty', () => {
  expect(validateGreengrassCoreDeviceName('')).toBeFalsy();
});

test('Name contains unsupported character', () => {
  expect(validateGreengrassCoreDeviceName('@')).toBeFalsy();
});

test('Name is longer than 128 characters', () => {
  const name: string[] = [];
  for (let i = 0; i < 129; i++) name.push('a');

  expect(validateGreengrassCoreDeviceName(name.join(''))).toBeFalsy();
});

test('Name is valid', () => {
  const name: string[] = [];
  for (let i = 0; i <= 9; i++) name.push(`${i}`);
  for (let i = 'a'.charCodeAt(0); i <= 'z'.charCodeAt(0); i++) name.push(String.fromCharCode(i));
  for (let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) name.push(String.fromCharCode(i));
  name.push(...['-', '_', ':']);

  expect(validateGreengrassCoreDeviceName(name.join(''))).toBeTruthy();
});
