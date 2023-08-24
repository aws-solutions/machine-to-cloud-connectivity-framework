// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { v4 } from 'uuid';
import IoTHandler from '../../lib/aws-handlers/iot-handler';
import { LambdaError } from '../../lib/errors';
import {
  IoTEndpointResponse,
  RequestTypes,
  SendAnonymousMetricsRequest,
  StackEventTypes,
  UuidResponse
} from '../../lib/types/custom-resource-types';
import { StackEventMetricData } from '../../lib/types/utils-types';
import { sendAnonymousMetric } from '../../lib/utils';

/**
 * Creates a solution UUID.
 * @param requestType The custom resource request type
 * @returns When it's creation, returns UUID. Otherwise, return an empty object.
 */
export function createUuid(requestType: RequestTypes): UuidResponse {
  if (requestType === RequestTypes.CREATE) {
    return { UUID: v4() };
  }

  return {};
}

/**
 * Sends anonymous metrics.
 * @param params The sending anonymous metrics parameters
 */
export async function sendAnonymousMetrics(params: SendAnonymousMetricsRequest): Promise<void> {
  /**
   * Checks if the string is not empty or not.
   * @param str The string to check
   * @returns `true` when the string is not empty, `false` when the string is empty or not a string
   */
  function isNotEmptyString(str: string): boolean {
    return typeof str === 'string' && str.trim() !== '';
  }

  const { AWS_REGION } = process.env;
  const { requestType, resourceProperties } = params;
  const { ExistingKinesisStream, ExistingTimestreamDatabase, SolutionUUID } = resourceProperties;

  const anonymousMetrics: StackEventMetricData = {
    EventType: StackEventTypes.DEPLOY,
    ExistingKinesisStream: isNotEmptyString(ExistingKinesisStream),
    ExistingTimestreamDatabase: isNotEmptyString(ExistingTimestreamDatabase),
    Region: AWS_REGION
  };

  switch (requestType) {
    case RequestTypes.CREATE:
      anonymousMetrics.EventType = StackEventTypes.DEPLOY;
      break;
    case RequestTypes.UPDATE:
      anonymousMetrics.EventType = StackEventTypes.UPDATE;
      break;
    case RequestTypes.DELETE:
      anonymousMetrics.EventType = StackEventTypes.DELETE;
      break;
    default:
      throw new LambdaError({
        name: 'NotSupportedRequestType',
        message: `Not supported request type: ${requestType}`,
        statusCode: 400
      });
  }

  await sendAnonymousMetric(anonymousMetrics, SolutionUUID);
}

/**
 * Returns IoT endpoints including Data-ATS and CredentialProvider types.
 * @param requestType The custom resource request type
 * @returns When it's creation, returns IoT endpoints. Otherwise, return an empty object.
 */
export async function describeIoTEndpoints(requestType: RequestTypes): Promise<Partial<IoTEndpointResponse>> {
  if (requestType === RequestTypes.CREATE) {
    const iotHandler = new IoTHandler();
    const [credentialProviderEndpoint, dataAtsEndpoint] = await Promise.all([
      iotHandler.describeIoTEndpoint('iot:CredentialProvider'),
      iotHandler.describeIoTEndpoint('iot:Data-ATS')
    ]);

    return {
      CredentialProviderEndpoint: credentialProviderEndpoint,
      DataAtsEndpoint: dataAtsEndpoint
    };
  }

  return {};
}
