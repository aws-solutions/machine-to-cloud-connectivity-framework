// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DynamoDBHandler from '../lib/aws-handlers/dynamodb-handler';
import GreengrassV2Handler from '../lib/aws-handlers/greengrass-v2-handler';
import { LambdaError } from '../lib/errors';
import { APIResponseBodyType, GetApiRequestInput } from '../lib/types/connection-builder-types';
import { GreengrassCoreDeviceItem, ListGreengrassCoreDevicesResponse } from '../lib/types/greengrass-v2-handler-types';

const dynamoDbHandler = new DynamoDBHandler();
const greengrassV2Handler = new GreengrassV2Handler();

/**
 * Handles API GET request.
 * @param params The parameters to execute GET API
 * @returns The GET API result
 */
export async function handleGetRequest(params: GetApiRequestInput): Promise<APIResponseBodyType> {
  const { path, pathParameters, queryStrings, resource } = params;

  switch (resource) {
    case '/connections':
      return dynamoDbHandler.getConnections(queryStrings.nextToken);
    case '/connections/{connectionName}':
      return dynamoDbHandler.getConnection(decodeURIComponent(pathParameters.connectionName));
    case '/sitewise/{serverName}':
      return dynamoDbHandler.getOpcUaConnectionByServerName(decodeURIComponent(pathParameters.serverName));
    case '/logs':
      return dynamoDbHandler.getLogs(queryStrings.nextToken);
    case '/logs/{connectionName}':
      return dynamoDbHandler.getLogsByConnection(
        decodeURIComponent(pathParameters.connectionName),
        queryStrings.nextToken
      );
    case '/greengrass':
      return dynamoDbHandler.getGreengrassCoreDevices(queryStrings.nextToken);
    case '/greengrass/user':
      return getUserGreengrassCoreDevices();
    default:
      throw new LambdaError({
        message: `Path not found: GET ${path}`,
        name: 'ConnectionBuilderError',
        statusCode: 404
      });
  }
}

/**
 * Gets Greengrass core devices which user created.
 * @returns The Greengrass core devices created by user
 */
async function getUserGreengrassCoreDevices(): Promise<ListGreengrassCoreDevicesResponse> {
  const greengrassCoreDevicesSet = new Set<string>();
  const { greengrassCoreDevices } = await greengrassV2Handler.listGreengrassCoreDevices();

  for (const greengrassCoreDevice of greengrassCoreDevices) {
    greengrassCoreDevicesSet.add(greengrassCoreDevice.coreDeviceThingName);
  }

  let nextToken: string;
  do {
    const response = await dynamoDbHandler.getGreengrassCoreDevices(nextToken);

    for (const dynamoDbItem of response.greengrassCoreDevices) {
      greengrassCoreDevicesSet.delete(dynamoDbItem.name);
    }

    nextToken = response.nextToken;
  } while (typeof nextToken !== 'undefined');

  return {
    greengrassCoreDevices: greengrassCoreDevices.filter((greengrassCoreDevice: GreengrassCoreDeviceItem) =>
      greengrassCoreDevicesSet.has(greengrassCoreDevice.coreDeviceThingName)
    )
  };
}
