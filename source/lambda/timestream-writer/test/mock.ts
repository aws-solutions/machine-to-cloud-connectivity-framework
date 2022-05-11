// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const mockTimestreamHandler = {
  write: jest.fn()
};
jest.mock('../../lib/aws-handlers/timestream-handler', () => jest.fn(() => ({ ...mockTimestreamHandler })));

export const consoleErrorSpy = jest.spyOn(console, 'error');
