// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CapabilityConfigurationSource } from './iot-sitewise-handler-types';

export enum ConnectionControl {
  DEPLOY = 'deploy',
  START = 'start',
  STOP = 'stop',
  UPDATE = 'update',
  DELETE = 'delete',
  PUSH = 'push',
  PULL = 'pull'
}

export enum MachineProtocol {
  OPCDA = 'opcda',
  OPCUA = 'opcua'
}

export enum LogType {
  INFO = 'info',
  ERROR = 'error'
}

/**
 * The connection definition to control a connection. This will be sent through the API Gateway body.
 * Refer to https://docs.aws.amazon.com/solutions/latest/machine-to-cloud-connectivity-framework/api-specification.html
 * @interface ConnectionDefinition
 */
export interface ConnectionDefinition {
  connectionName: string;
  control: ConnectionControl;
  protocol: MachineProtocol;
  area?: string;
  gatewayId?: string;
  greengrassCoreDeviceName?: string;
  machineName?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  process?: string;
  sendDataToIoTSiteWise?: boolean;
  sendDataToIoTTopic?: boolean;
  sendDataToKinesisDataStreams?: boolean;
  sendDataToTimestream?: boolean;
  siteName?: string;
}

export interface CommonDefinition {
  machineIp: string;
  serverName: string;
}

export interface OpcDaDefinition extends CommonDefinition {
  interval: number;
  iterations: number;
  listTags?: string[];
  tags?: string[];
}

export interface OpcUaDefinition extends CommonDefinition {
  port?: number;
  source?: CapabilityConfigurationSource;
}
