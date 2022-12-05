// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  setupFiles: ['./test/jest-environment-variables.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/test/*.ts'],
  coverageReporters: ['text', ['lcov', { projectRoot: '../../' }]],
  testTimeout: 20000
};
