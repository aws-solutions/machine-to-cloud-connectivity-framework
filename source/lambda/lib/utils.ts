// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { customAlphabet } from 'nanoid';
import { LambdaError } from './errors';
import { ConnectionBuilderTypes, UtilsTypes } from './types';

const { SOLUTION_ID, SOLUTION_VERSION } = process.env;
const UPPER_ALPHA_NUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';
const GREENGRASS_LAMBDA_RUNTIME = 'python3.7';

/**
 * Generates an unique ID based on the parameter length.
 * @param length The length of the unique ID
 * @returns The unique ID
 */
export function generateUniqueId(length: number = 4) {
  const nanoid = customAlphabet(UPPER_ALPHA_NUMERIC, length);
  return nanoid();
}

/**
 * Gets the AWS JavaScript SDK options.
 * If the solution ID and version are provided, the options includes the custom user agent.
 * @param input The optional AWS SDK options
 * @returns The custom user agent options for AWS JavaScript SDK
 */
export function getAwsSdkOptions(input?: UtilsTypes.AwsSdkOptions): UtilsTypes.AwsSdkOptions {
  const options: UtilsTypes.AwsSdkOptions = { ...input };

  if (SOLUTION_ID && SOLUTION_VERSION
    && SOLUTION_ID.trim() !== '' && SOLUTION_VERSION.trim() !== '') {
    options.customUserAgent = `AwsSolution/${SOLUTION_ID}/${SOLUTION_VERSION}`;
  }

  return options;
}

/**
 * Gets the Lambda runtime based on the machine protocol.
 * @param protocol The machine protocol
 * @returns The Lambda runtime of the machine protocol
 */
export function getLambdaRuntime(protocol: ConnectionBuilderTypes.MachineProtocol): string {

  switch (protocol) {
    case ConnectionBuilderTypes.MachineProtocol.OPCDA:
    case ConnectionBuilderTypes.MachineProtocol.OPCUA:
      return GREENGRASS_LAMBDA_RUNTIME;
    default:
      throw new LambdaError({
        message: 'Unsupported protocol.',
        name: 'UtilsLambdaRuntimError'
      });
  }
}

/**
 * Sends anonymous usage metrics.
 * @param data Data to send a anonymous metric
 */
export async function sendAnonymousMetric(data: any, uuid: string) {
  try {
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
export function trimAllStringInObjectOrArray(obj: any) {
  if (typeof obj !== 'object') {
    throw new LambdaError({
      message: 'Invalid object',
      name: 'UtilsInvalidObject',
      statusCode: 400
    });
  }

  let trimedObject: any;
  if (!Array.isArray(obj)) {
    trimedObject = {};
  } else {
    trimedObject = [];
  }

  for (let key in obj) {
    if (typeof obj[key] === 'object') {
      trimedObject[key] = trimAllStringInObjectOrArray(obj[key]);
    } else if (typeof obj[key] === 'string') {
      const trimedStr = obj[key].trim();

      if (Array.isArray(obj)) {
        trimedObject.push(trimedStr);
      } else {
        trimedObject[key] = trimedStr;
      }
    } else {
      trimedObject[key] = obj[key];
    }
  }

  return trimedObject;
}