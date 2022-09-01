// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

export type ErrorMessage = { errorMessage: string };
export type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type KeyStringValue = Record<string, string | undefined>;
type ApiMethod = 'get' | 'post';
type GreengrassCoreDeviceStatus = 'HEALTHY' | 'UNHEALTHY';
type LoggingLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE';

export enum ConnectionControl {
  DEPLOY = 'deploy',
  START = 'start',
  STOP = 'stop',
  UPDATE = 'update',
  DELETE = 'delete',
  PUSH = 'push',
  PULL = 'pull'
}

export enum LogType {
  INFO = 'info',
  ERROR = 'error'
}

export enum MachineProtocol {
  OPCDA = 'opcda',
  OPCUA = 'opcua',
  OSIPI = 'osipi'
}

export enum MessageModalType {
  MESSAGE,
  CONFIRM
}

export enum PaginationType {
  PREV,
  NEXT
}

export enum CreatedBy {
  SYSTEM = 'System',
  USER = 'User'
}

export enum GreengrassCoreDeviceControl {
  CREATE = 'create',
  DELETE = 'delete'
}

export enum OsiPiAuthMode {
  ANONYMOUS = 'ANONYMOUS',
  BASIC = 'BASIC'
  //TODO: Figure out how to support Kerberos auth
  // KERBEROS = 'KERBEROS'
}

export interface AmplifyConfigurationInput {
  apiEndpoint: string;
  identityPoolId: string;
  loggingLevel: LoggingLevel;
  region: string;
  s3Bucket: string;
  userPoolId: string;
  webClientId: string;
}

export interface AmplifyConfigurationResponse {
  API: {
    endpoints: { name: string; endpoint: string; region: string }[];
  };
  Auth: {
    identityPoolId: string;
    region: string;
    userPoolId: string;
    userPoolWebClientId: string;
  };
  Storage: {
    AWSS3: {
      bucket: string;
      region: string;
    };
  };
}

export interface ConnectionDefinition {
  control: ConnectionControl;
  connectionName: string;
  protocol: MachineProtocol;
  area?: string;
  greengrassCoreDeviceName?: string;
  machineName?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  osiPi?: OsiPiDefinition;
  process?: string;
  sendDataToIoTSiteWise?: boolean;
  sendDataToIoTTopic?: boolean;
  sendDataToKinesisDataStreams?: boolean;
  sendDataToTimestream?: boolean;
  siteName?: string;
  logLevel?: string;
}

export interface CommonDefinition {
  machineIp: string;
  serverName: string;
}

export interface OpcDaDefinition extends CommonDefinition {
  interval: number | string;
  iterations: number | string;
  listTags?: string[];
  tags?: string[];
}

export interface OpcUaDefinition extends CommonDefinition {
  port?: number | string;
}

export interface OsiPiDefinition {
  apiUrl: string;
  serverName: string;
  authMode: OsiPiAuthMode;
  verifySSL: boolean;
  username?: string;
  password?: string;
  tags: string[];
  requestFrequency: number | string;
  catchupFrequency: number | string;
  maxRequestDuration: number | string;
  queryOffset: number | string;
}

export interface ListConnectionsItem {
  connectionName: string;
  machineName: string;
  protocol: MachineProtocol;
  status: ConnectionControl;
  sendDataToIoTSiteWise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
}

export interface ListConnectionsResponse {
  connections: ListConnectionsItem[];
  nextToken?: string;
}

export interface ControlConnectionResponse {
  connectionName: string;
  control: ConnectionControl;
  result: string;
}

export interface CreateUpdateConnectionResponse {
  connectionName: string;
  control: ConnectionControl.DEPLOY | ConnectionControl.UPDATE;
  message: string;
}

export interface ModalProps {
  show: boolean;
  hide: () => void;
}

export interface ConnectionLogsModalProps extends ModalProps {
  connectionName: string;
}

export interface MessageModalProps extends ModalProps {
  message: string | React.ReactNode;
  modalType: MessageModalType;
  confirmAction?: () => void | Promise<void>;
}

export interface GetConnectionResponse {
  connectionName: string;
  greengrassCoreDeviceName: string;
  protocol: MachineProtocol;
  sendDataToIoTSiteWise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
  sendDataToTimestream: boolean;
  area?: string;
  machineName?: string;
  logLevel?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  osiPi?: OsiPiDefinition;
  process?: string;
  siteName?: string;
  opcDaListTags?: string;
  opcDaTags?: string;
  osiPiTags?: string;
}

export interface FormProps {
  connection: GetConnectionResponse;
  onChange: (event: React.ChangeEvent<FormControlElement>) => void;
  errors: KeyStringValue;
}

export interface OpcUaFormProps extends FormProps {
  region: string;
}

export interface ListLogsItem {
  connectionName: string;
  timestamp: number;
  logType: LogType;
  message: string;
}

export interface ListLogsResponse {
  logs: ListLogsItem[];
  nextToken?: string;
}

export interface AlphaNumericValidationProps {
  value: string;
  maxLength: number;
  errors: KeyStringValue;
  errorKeyName: string;
  errorMessage: string;
}

export interface ErrorProps {
  message?: string;
  response?: {
    data: ErrorMessage | unknown;
  };
}

export interface ApiProps {
  method: ApiMethod;
  path: string;
  options?: Record<string, unknown>;
}

export interface ListGreengrassCoreDevicesResponse {
  greengrassCoreDevices: ListGreengrassCoreDevicesItem[];
  nextToken?: string;
}

export interface ListGreengrassCoreDevicesItem {
  name: string;
  createdBy: CreatedBy;
  numberOfConnections: number;
}

export interface UserGreengrassCoreDeviceResponse {
  greengrassCoreDevices: UserGreengrassCoreDevice[];
}

export interface UserGreengrassCoreDevice {
  coreDeviceThingName: string;
  status: GreengrassCoreDeviceStatus;
}

export interface GreengrassCoreDevicePostResponse {
  name: string;
  message: string;
}

export interface GreengrassCoreDeviceDomIds {
  category: string;
  greengrassCoreDeviceName: string;
}
