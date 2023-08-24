// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import {
  ConnectionControl,
  LogType,
  MachineProtocol,
  OpcDaDefinition,
  OpcUaDefinition,
  OsiPiDefinition
} from './solution-common-types';
<<<<<<< HEAD
=======

import { ModbusTcpDefinition } from './modbus-types';
>>>>>>> main

export type PageItems = GetConnectionResponse[] | LogItem[] | GreengrassCoreDeviceItem[];

export interface GetConnectionsItem {
  connectionName: string;
  protocol: MachineProtocol;
  status: ConnectionControl;
  sendDataToIoTSiteWise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
  sendDataToTimestream: boolean;
  sendDataToHistorian: boolean;
  machineName?: string;
  logLevel: string;
<<<<<<< HEAD
=======
  historianKinesisDatastreamName: string;
>>>>>>> main
}

export interface GetConnectionsResponse {
  connections: GetConnectionsItem[];
  nextToken?: string;
}

export interface PaginationResponse {
  items: PageItems;
  nextToken?: string;
}

export interface GetConnectionResponse {
  control: ConnectionControl;
  connectionName: string;
  greengrassCoreDeviceName: string;
  protocol: MachineProtocol;
  timestamp: string;
  sendDataToIoTSiteWise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
  sendDataToTimestream: boolean;
  sendDataToHistorian: boolean;
  area?: string;
  machineName?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  osiPi?: OsiPiDefinition;
<<<<<<< HEAD
  process?: string;
  siteName?: string;
  logLevel: string;
=======
  modbusTcp?: ModbusTcpDefinition;
  process?: string;
  siteName?: string;
  logLevel: string;
  historianKinesisDatastreamName?: string;
>>>>>>> main
}

export interface UpdateConnectionsRequest {
  connectionName: string;
  control: ConnectionControl;
  area?: string;
  greengrassCoreDeviceName?: string;
  machineName?: string;
  logLevel?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  osiPi?: OsiPiDefinition;
<<<<<<< HEAD
=======
  modbusTcp?: ModbusTcpDefinition;
>>>>>>> main
  process?: string;
  sendDataToIoTSiteWise?: boolean;
  sendDataToIoTTopic?: boolean;
  sendDataToKinesisDataStreams?: boolean;
  sendDataToTimestream?: boolean;
  sendDataToHistorian?: boolean;
  historianKinesisDatastreamName?: string;
  siteName?: string;
}

export interface BuildUpdateExpressionRequest {
  apiParams: DocumentClient.UpdateItemInput;
  updateInput: Omit<UpdateConnectionsRequest, 'connectionName'>;
}

export interface LogItem {
  connectionName: string;
  timestamp: number;
  logType: LogType;
  message: string;
  ttl?: number;
}

export interface GetLogsResponse {
  logs: LogItem[];
  nextToken?: string;
}

export enum CreatedBy {
  SYSTEM = 'System',
  USER = 'User'
}

export interface GreengrassCoreDeviceItem {
  name: string;
  createdBy: CreatedBy;
  numberOfConnections: number;
  iotThingArn: string;
  iotSiteWiseGatewayId?: string;
  osPlatform: string;
}

export interface GetGreengrassCoreDevicesResponse {
  greengrassCoreDevices: GreengrassCoreDeviceItem[];
  nextToken?: string;
}

export interface UpdateGreengrassCoreDeviceRequest {
  name: string;
  increment: boolean;
}
