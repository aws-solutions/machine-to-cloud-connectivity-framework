// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreatedBy,
  GetConnectionResponse,
  GetConnectionsResponse,
  GetGreengrassCoreDevicesResponse,
  GetLogsResponse
} from './dynamodb-handler-types';
import { ListGreengrassCoreDevicesResponse } from './greengrass-v2-handler-types';
import { ConnectionControl } from './solution-common-types';

type StringJson = Record<string, string>;
type StringArrayJson = Record<string, string[]>;
export type APIResponseBodyType =
  | GetConnectionsResponse
  | GetConnectionResponse
  | GetGreengrassCoreDevicesResponse
  | GetLogsResponse
  | ListGreengrassCoreDevicesResponse
  | ProcessConnectionResponse
  | ProcessGreengrassCoreDeviceResponse
  | Record<string, never>;

export interface APIGatewayRequest {
  resource: string;
  path: string;
  httpMethod: string;
  headers: StringJson;
  multiValueHeaders: StringArrayJson;
  queryStringParameters: StringJson;
  multiValueQueryStringParameters: StringArrayJson;
  pathParameters: StringJson;
  stageVariables: StringJson;
  requestContext: Record<string, object>;
  body: string;
  isBase64Encoded: string;
}

export interface APIGatewayResponse {
  statusCode: number;
  body: string;
  headers?: StringJson;
  multiValueHeaders?: StringArrayJson;
  isBase64Encoded?: boolean;
}

export interface ProcessConnectionResponse {
  connectionName: string;
  control: ConnectionControl;
  message: string;
}

export interface GetApiRequestInput {
  path: string;
  pathParameters: StringJson;
  queryStrings: StringJson;
  resource: string;
}

export interface PostApiRequestInput {
  body: string;
  resource: string;
}

export enum GreengrassCoreDeviceControl {
  CREATE = 'create',
  DELETE = 'delete'
}

export enum GreengrassCoreDeviceEventTypes {
  CREATE = 'CreateGreengrassCoreDevice',
  DELETE = 'DeleteGreengrassCoreDevice'
}

export interface PostGreengrassRequestBodyInput {
  name: string;
  control: GreengrassCoreDeviceControl;
  createdBy: CreatedBy;
}

export interface ProcessGreengrassCoreDeviceResponse {
  name: string;
  message: string;
}
