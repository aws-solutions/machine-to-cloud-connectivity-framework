// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CapabilityConfigurationSource } from './iot-sitewise-handler-types';
import { ModbusTcpDefinition } from './modbus-types';

export enum ConnectionControl {
  DEPLOY = 'deploy',
  START = 'start',
  STOP = 'stop',
  UPDATE = 'update',
  DELETE = 'delete',
  PUSH = 'push',
  PULL = 'pull',
  FAIL = 'fail'
}

export enum MachineProtocol {
  OPCDA = 'opcda',
  OPCUA = 'opcua',
<<<<<<< HEAD
  OSIPI = 'osipi'
=======
  OSIPI = 'osipi',
  MODBUSTCP = 'modbustcp'
>>>>>>> main
}

export enum LogType {
  INFO = 'info',
  ERROR = 'error'
}

export enum OsiPiAuthMode {
  ANONYMOUS = 'Anonymous',
  BASIC = 'BASIC'
  //TODO: Figure out how to support Kerberos auth
  // KERBEROS = 'KERBEROS'
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
  siteName?: string;
  historianKinesisDatastreamName?: string;
  osPlatform?: string;
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

export interface OsiPiDefinition {
  apiUrl: string;
  serverName: string;
  authMode: OsiPiAuthMode;
  verifySSL: boolean;
  username?: string;
  password?: string;
  credentialSecretArn?: string;
  tags: string[];
  requestFrequency: number;
  catchupFrequency: number;
  maxRequestDuration: number;
  queryOffset: number;
}
