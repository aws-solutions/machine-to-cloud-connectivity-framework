// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ErrorsType } from './types';

/**
 * @class LambdaError to throw when an error happens on the Lambda functions
 * @param error The error message (required), name (optional), and status code (optional).
 */
export class LambdaError extends Error {
  public readonly statusCode: number;
  constructor(error: ErrorsType.ErrorInput) {
    super(error.message);
    this.name = error.name || 'LambdaError';
    this.statusCode = error.statusCode || 500;
  }
}