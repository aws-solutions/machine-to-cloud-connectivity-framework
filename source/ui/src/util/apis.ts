// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { ApiProps } from './types';
import { API_NAME } from './utils';

/**
 * Requests API to the backend.
 * @param params The API parameters
 * @returns The response from the API call.
 */
export async function requestApi(params: ApiProps): Promise<unknown> {
  const { method, path, options } = params;
  return API[method](API_NAME, path, { ...options });
}
