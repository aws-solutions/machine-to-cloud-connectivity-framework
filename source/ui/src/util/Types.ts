// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

/**
 * The Amplify configuration input type.
 * The configuration will be generated while launching the solution.
 * @interface AmplifyConfigurationInput
 */
export interface AmplifyConfigurationInput {
  apiEndpoint: string;
  identityPoolId: string;
  loggingLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE';
  region: string;
  userPoolId: string;
  webClientId: string;
}

/**
 * The Amplify configuration response type for the web application
 * @interface AmplifyConfigurationResponse
 */
export interface AmplifyConfigurationResponse {
  API: {
    endpoints: { name: string, endpoint: string, region: string }[];
  };
  Auth: {
    identityPoolId: string;
    region: string;
    userPoolId: string;
    userPoolWebClientId: string;
  };
}

/**
 * The connection definition
 * @interface ConnectionDefinition
 */
export interface ConnectionDefinition {
  control: ConnectionControl;
  connectionName: string;
  protocol: MachineProtocol;
  area?: string;
  machineName?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  process?: string;
  sendDataToIoTSitewise?: boolean;
  sendDataToIoTTopic?: boolean;
  sendDataToKinesisDataStreams?: boolean;
  siteName?: string;
}

/**
 * Common connection definition
 * @interface CommonDefinition
 */
export interface CommonDefinition {
  machineIp: string;
  serverName: string;
}

/**
 * OPC DA connection definition
 * @interface OpcDaDefinition
 * @extends CommonDefinition
 */
export interface OpcDaDefinition extends CommonDefinition {
  interval: number | string;
  iterations: number | string;
  listTags?: string[];
  tags?: string[];
}

/**
 * OPC UA connection definition
 * @interface OpcUaDefinition
 * @extends CommonDefinition
 */
export interface OpcUaDefinition extends CommonDefinition {
  port?: number | string;
}

/**
 * @enum The connection control types
 */
export enum ConnectionControl {
  DEPLOY = 'deploy',
  START = 'start',
  STOP = 'stop',
  UPDATE = 'update',
  DELETE = 'delete',
  PUSH = 'push',
  PULL = 'pull'
}

/**
 * The list connections item type
 * @interface ListConnectionsItem
 */
export interface ListConnectionsItem {
  connectionName: string;
  protocol: MachineProtocol;
  status: ConnectionControl;
  sendDataToIoTSitewise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
  machineName?: string;
}

/**
 * The list connections response type
 * @interface ListConnectionsResponse
 */
export interface ListConnectionsResponse {
  connections: ListConnectionsItem[];
  nextToken?: string;
}

/**
 * The control connection response type.
 * @interface ControlConnectionResponse
 */
export interface ControlConnectionResponse {
  connectionName: string;
  control: ConnectionControl;
  result: string;
}

/**
 * The create and update connection response type
 * @interface CreateUpdateConnectionResponse
 */
export interface CreateUpdateConnectionResponse {
  connectionName: string;
  control: ConnectionControl.DEPLOY | ConnectionControl.UPDATE;
  message: string;
}

/**
 * The default modal properties
 * @interface ModalProps
 */
interface ModalProps {
  show: boolean;
  hide: Function;
}

/**
 * The message modal properties
 * @interface MessageModalProps
 * @extends ModalProps
 */
export interface MessageModalProps extends ModalProps {
  message: string | React.ReactNode;
  modalType: MessageModalType;
  confirmAction?: Function;
}

/**
 * @enum The message modal types
 */
export enum MessageModalType {
  MESSAGE,
  CONFIRM
}

/**
 * The connection modal properties
 * @interface ConnectionModalProps
 * @extends ModalProps
 */
export interface ConnectionModalProps extends ModalProps {
  initConnection: GetConnectionResponse;
  isUpdating: boolean;
  setIsUpdating: Function;
  connectionName?: string;
}

/**
 * A connection response
 * @interface GetConnectionResponse
 */
export interface GetConnectionResponse {
  connectionName: string;
  protocol: MachineProtocol;
  sendDataToIoTSitewise: boolean;
  sendDataToIoTTopic: boolean;
  sendDataToKinesisDataStreams: boolean;
  area?: string;
  machineName?: string;
  opcDa?: OpcDaDefinition;
  opcUa?: OpcUaDefinition;
  process?: string;
  siteName?: string;
  listTags?: string;
  tags?: string;
}

/**
 * @enum The connection protocols
 */
export enum MachineProtocol {
  OPCDA = 'opcda',
  OPCUA = 'opcua'
}

/**
 * The form properties for the each protocols.
 * @interface FormProps
 */
export interface FormProps {
  connection: GetConnectionResponse;
  onChange: Function;
  errors: KeyStringValue;
}

/**
 * The form properties for the OPC UA protocol.
 * @interface OpcUaFormProps
 * @extends FormProps
 */
export interface OpcUaFormProps extends FormProps {
  region: string;
}

/**
 * @type The HTML form control element type
 */
export type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * The general key, value JSON object type which allows undefined value
 * @interface KeyStringValue
 */
export interface KeyStringValue {
  [key: string]: string | undefined;
}

/**
 * The machine logs modal properties
 * @interface ConnectionLogsModalProps
 * @extends ModalProps
 */
export interface ConnectionLogsModalProps extends ModalProps {
  connectionName: string;
}

/**
 * @enum Log type
 */
export enum LogType {
  INFO = 'info',
  ERROR = 'error'
}

/**
 * The list logs item type
 * @interface ListLogsItem
 */
export interface ListLogsItem {
  connectionName: string;
  timestamp: number;
  logType: LogType;
  message: string;
}

/**
 * The list logs response type
 * @interface ListLogsResponse
 */
export interface ListLogsResponse {
  logs: ListLogsItem[];
  nextToken?: string;
}

/**
 * The alphanumeric characters, hyphens, and underscores validation type
 * @interface AlphaNumericValidationProps
 */
export interface AlphaNumericValidationProps {
  value: string;
  maxLength: number;
  errors: KeyStringValue;
  errorKeyName: string;
  errorMessage: string;
}

/**
 * @enum The pagination type
 */
export enum PaginationType {
  PREV,
  NEXT
}