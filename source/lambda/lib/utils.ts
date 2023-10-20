// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { init } from '@paralleldrive/cuid2';
import { LambdaError } from './errors';
import { AnonymousMetricData, AwsSdkOptions } from './types/utils-types';

const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';

/**
 * Generates an unique ID based on the parameter length.
 * @param length The length of the unique ID
 * @returns The unique ID
 */
export function generateUniqueId(length: number = 4) {
  const createId = init({
    length: length
  });
  return createId().toUpperCase();
}

/**
 * Gets the AWS JavaScript SDK options.
 * If the solution ID and version are provided, the options includes the custom user agent.
 * @param input The optional AWS SDK options
 * @returns The custom user agent options for AWS JavaScript SDK
 */
export function getAwsSdkOptions(input?: AwsSdkOptions): AwsSdkOptions {
  const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
  const options: AwsSdkOptions = { ...input };

  if (SOLUTION_ID && SOLUTION_VERSION && SOLUTION_ID.trim() !== '' && SOLUTION_VERSION.trim() !== '') {
    options.customUserAgent = `AwsSolution/${SOLUTION_ID}/${SOLUTION_VERSION}`;
  }

  return options;
}

/**
 * Sends anonymous usage metrics.
 * @param data Data to send a anonymous metric
 * @param uuid The solution UUID
 */
export async function sendAnonymousMetric(data: AnonymousMetricData, uuid: string) {
  try {
    const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
    const body = {
      Solution: SOLUTION_ID,
      Version: SOLUTION_VERSION,
      UUID: uuid,
      TimeStamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      Data: data
    };

    const config = {
      headers: { 'Content-Type': 'application/json' }
    };

    await axios.post(METRICS_ENDPOINT, JSON.stringify(body), config);
  } catch (error) {
    console.error('Error sending an anonymous metric: ', error);
  }
}

/**
 * Sleeps for seconds.
 * @param seconds The seconds to sleep
 * @returns Promise to sleep for seconds
 */
export async function sleep(seconds: number): Promise<PromiseConstructor> {
  return new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });
}

/**
 * Trims all strings in the object or array.
 * @param obj The object to trim all strings
 * @returns The trimmed strings in the object
 * @throws `UtilsInvalidObject` when object is not provided
 */
export function trimAllStringInObjectOrArray(obj: unknown) {
  if (typeof obj !== 'object') {
    throw new LambdaError({
      message: 'Invalid object',
      name: 'UtilsInvalidObject',
      statusCode: 400
    });
  }

  let trimmedObject: unknown;
  if (Array.isArray(obj)) {
    trimmedObject = [];
  } else {
    trimmedObject = {};
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      trimmedObject[key] = trimAllStringInObjectOrArray(obj[key]);
    } else {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
      }

      if (Array.isArray(trimmedObject)) {
        trimmedObject.push(obj[key]);
      } else {
        trimmedObject[key] = obj[key];
      }
    }
  }

  return trimmedObject;
}

/**
 * Validates if the provided version is valid.
 * The valid version consists of a major version number, a minor version number, and a patch version number.
 * (e.g. 1.0.0, v1.0.0)
 * @param version The version to validate
 * @returns If the version is valid or not
 */
export function isValidVersion(version: string): boolean {
  return (
    /^(\d|[1-9]\d*)\.(\d|[1-9]\d*)\.(\d|[1-9]\d*)$/.test(version) ||
    /^v(\d|[1-9]\d*)\.(\d|[1-9]\d*)\.(\d|[1-9]\d*)$/.test(version)
  );
}

/**
 * Extracts the version from the version string.
 * The expected solution version is vX.Y.Z. X, Y, and Z are integer numbers.
 * When the solution version is v1.0.0, the component version would be 1.0.0.
 * If the solution version is not expected format (e.g. customVersion, v.1.0.0, v1, and so on),
 * the Lambda function is going to replace the component version to `1.0.0` by default.
 * @param version
 * @returns The version number
 */
export function extractValidVersion(version: string): string {
  if (isValidVersion(version)) {
    return version.replace(/^v/, '');
  } else {
    return '1.0.0';
  }
}
