// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const mockBatchWrite = jest.fn();
jest.mock('aws-sdk/clients/dynamodb', () => ({
  DocumentClient: jest.fn(() => ({ batchWrite: mockBatchWrite }))
}));

jest.mock('../../lib/utils', () => ({
  getAwsSdkOptions: jest.fn().mockReturnValue({})
}));

export const consoleWarnSpy = jest.spyOn(console, 'warn');
export const consoleErrorSpy = jest.spyOn(console, 'error');
