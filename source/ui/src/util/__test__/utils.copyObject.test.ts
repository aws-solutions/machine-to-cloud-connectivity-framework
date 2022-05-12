// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { copyObject } from '../utils';

type UnknownRecord = Record<string, unknown>;
type UnknownArrayRecord = Record<string, unknown[]>;

test('Test copyObject() function', () => {
  expect(copyObject({})).toEqual({});
  expect(copyObject({ a: 'a' })).toEqual({ a: 'a' });
  expect(copyObject({ a: 1 })).toEqual({ a: 1 });
  expect(copyObject({ a: true })).toEqual({ a: true });
  expect(copyObject({ a: ['a'] })).toEqual({ a: ['a'] });
  expect(copyObject({ a: 'a', b: 'b' })).toEqual({ a: 'a', b: 'b' });
  expect(copyObject({ a: { b: 'b' } })).toEqual({ a: { b: 'b' } });
  expect(copyObject({ a: { b: { c: 'c' } } })).toEqual({ a: { b: { c: 'c' } } });
  const func = () => console.log('func');
  expect(copyObject({ a: func })).toEqual({ a: func });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(() => copyObject([] as any)).toThrowError(Error('Invalid object'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(() => copyObject('invalid' as any)).toThrowError(Error('Invalid object'));

  // The change of the copied object object shouldn't impact the original one.
  let original: Record<string, unknown> = { a: 'a' };
  let copiedObject: Record<string, unknown> = copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: 'a' });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: ['a'] };
  copiedObject = copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: ['a'] });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: { b: 'b' } };
  copiedObject = copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: { b: 'b' } });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: { b: 'b' } };
  copiedObject = copyObject(original);
  (copiedObject.a as UnknownRecord).b = 'c';
  expect(original).toEqual({ a: { b: 'b' } });
  expect(copiedObject).toEqual({ a: { b: 'c' } });

  original = { a: { b: { c: 'c' } } };
  copiedObject = copyObject(original);
  ((copiedObject.a as UnknownRecord).b as UnknownRecord).c = 'd';
  expect(original).toEqual({ a: { b: { c: 'c' } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'd' } } });

  original = { a: { b: { c: 'c', d: ['d1', 'd2'] } } };
  copiedObject = copyObject(original);
  ((copiedObject.a as UnknownRecord).b as UnknownRecord).c = 'd';
  ((copiedObject.a as UnknownRecord).b as UnknownArrayRecord).d.pop();
  copiedObject.e = 'e';
  expect(original).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2'] } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'd', d: ['d1'] } }, e: 'e' });

  original = { a: { b: { c: 'c', d: ['d1', 'd2'] } } };
  copiedObject = copyObject(original);
  ((copiedObject.a as UnknownRecord).b as UnknownArrayRecord).d.push('d3');
  expect(original).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2'] } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2', 'd3'] } } });

  original = { a: func };
  copiedObject = copyObject(original);
  const newFunc = () => console.log('newFunc');
  copiedObject.a = newFunc;
  expect(original).toEqual({ a: func });
  expect(copiedObject).toEqual({ a: newFunc });
});
