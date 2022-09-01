// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildPerLineTags } from '../utils';

test('Test success to build OPC DA tags with the provided value', () => {
  const value = 'Random.String\nRandom.Int4\n';
  expect(buildPerLineTags(value)).toEqual(['Random.String', 'Random.Int4']);
});

test('Test success to build and trim OPC DA tags with the provided value', () => {
  const value = ' Random.String  \n Random.Int4 \n  Random.Int2';
  expect(buildPerLineTags(value)).toEqual(['Random.String', 'Random.Int4', 'Random.Int2']);
});

test('Test success to return empty string when the provided value is undefined', () => {
  expect(buildPerLineTags(undefined)).toEqual([]);
});

test('Test success to return empty string when the provided value is empty', () => {
  expect(buildPerLineTags(' ')).toEqual([]);
});
