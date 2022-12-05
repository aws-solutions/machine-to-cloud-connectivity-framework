// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  roots: ['<rootDir>/test'],
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  setupFiles: ['./test/jest-environment-variables.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/test/*.ts'],
  coverageReporters: ['text', ['lcov', { projectRoot: '../../' }]]
};
