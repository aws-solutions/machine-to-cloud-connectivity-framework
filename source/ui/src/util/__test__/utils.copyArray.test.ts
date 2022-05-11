// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { copyArray } from '../utils';

test('Test copyArray() function', () => {
  expect(copyArray([])).toEqual([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(() => copyArray('invalid' as any)).toThrow(Error('Invalid array'));
  expect(
    copyArray([
      [1, 2, 3],
      [4, 5, 6]
    ])
  ).toEqual([
    [1, 2, 3],
    [4, 5, 6]
  ]);
  expect(copyArray([{ a: 'b' }])).toEqual([{ a: 'b' }]);

  // The change of the copied object object shouldn't impact the original one.
  let original: unknown[] = [1, 2, 3];
  let copiedArray: unknown[] = copyArray(original);
  copiedArray[0] = 4;
  expect(original).toEqual([1, 2, 3]);
  expect(copiedArray).toEqual([4, 2, 3]);

  original = [
    [1, 2, 3],
    [4, 5, 6]
  ];
  copiedArray = copyArray(original);
  (copiedArray[0] as unknown[])[2] = 5;
  expect(original).toEqual([
    [1, 2, 3],
    [4, 5, 6]
  ]);
  expect(copiedArray).toEqual([
    [1, 2, 5],
    [4, 5, 6]
  ]);
});
