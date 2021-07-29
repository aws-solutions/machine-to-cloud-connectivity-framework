// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Auth from '@aws-amplify/auth';
import { I18n, Logger } from '@aws-amplify/core';
import {
  AlphaNumericValidationProps,
  AmplifyConfigurationInput, AmplifyConfigurationResponse,
  GetConnectionResponse, ConnectionControl, ConnectionDefinition,
  KeyStringValue, MachineProtocol,
  OpcDaDefinition, OpcUaDefinition
} from './Types';

// Logger for Utils
const logger = new Logger('Utils');

// Constant variables
const IP_REGEX = /^(?!0)(?!.*\.$)((?!0\d)(1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/; // NOSONAR: typescript:S4784 - This is for IP address check
const MAX_CHARACTERS = 30;
const MAX_ITERATIONS = 30;
const MIN_ITERATIONS = 1;
const MAX_TIME_INTERVAL = 30;
const MIN_TIME_INTERVAL = 0.5;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MAX_OPCUA_SERVER_NAME_CHARACTERS = 256;

// API name
export const API_NAME = 'M2C2Api';

/**
 * Gets the Amplify configuration for the application.
 * @param config The simple Amplify configuration key/values
 * @returns The Amplify configuration
 */
export function getAmplifyConfiguration(config: AmplifyConfigurationInput): AmplifyConfigurationResponse {
  return {
    API: {
      endpoints: [
        {
          name: API_NAME,
          endpoint: config.apiEndpoint,
          region: config.region
        }
      ]
    },
    Auth: {
      region: config.region,
      userPoolId: config.userPoolId,
      userPoolWebClientId: config.webClientId,
      identityPoolId: config.identityPoolId
    }
  };
}

/**
 * Signs out the user.
 */
export async function signOut() {
  try {
    await Auth.signOut();
    window.location.reload();
  } catch (error) {
    logger.error('Error while signing out the user.', error);
  }
}

/**
 * Builds the connection definition to send to the backend.
 * @param params The connection definition
 * @return The connection definition format required by the backend
 */
export function buildConnectionDefinition(params: ConnectionDefinition): ConnectionDefinition {
  const { control, connectionName, protocol } = params;
  const connectionDefintion: ConnectionDefinition = {
    control,
    connectionName,
    protocol
  };

  if ([ConnectionControl.DEPLOY, ConnectionControl.UPDATE].includes(params.control)) {
    connectionDefintion.area = params.area;
    connectionDefintion.machineName = params.machineName;
    connectionDefintion.process = params.process;
    connectionDefintion.siteName = params.siteName;

    connectionDefintion.sendDataToIoTSitewise = params.sendDataToIoTSitewise;
    connectionDefintion.sendDataToIoTTopic = params.sendDataToIoTTopic;
    connectionDefintion.sendDataToKinesisDataStreams = params.sendDataToKinesisDataStreams;

    if (params.protocol === MachineProtocol.OPCDA) {
      connectionDefintion.opcDa = params.opcDa;
      connectionDefintion.opcDa!.interval = Number(connectionDefintion.opcDa!.interval);
      connectionDefintion.opcDa!.iterations = Number(connectionDefintion.opcDa!.iterations);
    } else if (params.protocol === MachineProtocol.OPCUA) {
      connectionDefintion.opcUa = params.opcUa;

      if (connectionDefintion.opcUa!.port === undefined || String(connectionDefintion.opcUa!.port).trim() === '') {
        delete connectionDefintion.opcUa!.port;
      } else {
        connectionDefintion.opcUa!.port = Number(connectionDefintion.opcUa!.port);
      }
    }
  }

  return connectionDefintion;
}

// The initial connection
export const INIT_CONNECTION: GetConnectionResponse = {
  area: '',
  connectionName: '',
  machineName: '',
  opcDa: {
    machineIp: '',
    serverName: '',
    interval: '',
    iterations: '',
    listTags: [],
    tags: []
  },
  opcUa: {
    machineIp: '',
    serverName: '',
    port: ''
  },
  process: '',
  protocol: MachineProtocol.OPCDA,
  sendDataToIoTSitewise: false,
  sendDataToIoTTopic: false,
  sendDataToKinesisDataStreams: true,
  siteName: '',
  listTags: '',
  tags: ''
};

/**
 * Gets the error message from the error.
 * It follows Amplify API error structure first and go upper levels.
 * @param error The error to get the error message
 * @returns The error message or error object
 */
export function getErrorMessage(error: any): any {
  if (error.response && error.response.data) {
    if (error.response.data.errorMessage) {
      // When it's from M2C2 API, it returns `errorMessage`.
      return error.response.data.errorMessage;
    } else {
      // When it's the other Amplify API error, it returns response data.
      return error.response.data;
    }
  } else if (error.message) {
    return error.message;
  }

  return error;
}

/**
 * Validates the connection defintion. If not valid, returns errors.
 * @param params The connection definition
 * @returns The errors if any validation fails
 */
export function validateConnectionDefinition(params: ConnectionDefinition): KeyStringValue {
  const errors: KeyStringValue = {};
  const { connectionName, area, machineName, process, siteName } = params;

  /**
   * Checks the connection name to meet the Lambda function name constraints.
   * The connection name only allows alphanumeric characters, hypens, and underscores.
   * The maximum characters are 30 characters since the solution preserve characters.
   */
  validateAlphaNumericHyphenUnderscoreStrinng({
    value: connectionName,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'connectionName',
    errorMessage: I18n.get('invalid.connection.name')
  });
  validateAlphaNumericHyphenUnderscoreStrinng({
    value: siteName as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'siteName',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Site name')
  });
  validateAlphaNumericHyphenUnderscoreStrinng({
    value: area as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'area',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Area')
  });
  validateAlphaNumericHyphenUnderscoreStrinng({
    value: process as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'process',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Process')
  });
  validateAlphaNumericHyphenUnderscoreStrinng({
    value: machineName as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'machineName',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Machine name')
  });

  /**
   * Checks send data to IoT Sitewise, IoT topic and stream manager.
   * One of those should be set to be sent.
   */
  if (!params.sendDataToIoTSitewise && !params.sendDataToIoTTopic && !params.sendDataToKinesisDataStreams) {
    errors.sendDataTo = I18n.get('invalid.send.data.to');
  }

  if (params.protocol === MachineProtocol.OPCDA) {
    validateOpcDa(params.opcDa!, errors);
  } else if (params.protocol === MachineProtocol.OPCUA) {
    validateOpcUa(params.opcUa!, errors);
  }

  return errors;
}

/**
 * Validates if the value only contains alphanumeric characters, hyphens, and underscores.
 * In addition, it validates the maximum length of the string.
 * @param props The validation check props
 */
function validateAlphaNumericHyphenUnderscoreStrinng(props: AlphaNumericValidationProps) {
  if (typeof props.value !== 'string'
    || props.value.trim().length > props.maxLength
    || !/^[a-zA-Z0-9-_]+$/.test(props.value)) {
    props.errors[props.errorKeyName] = props.errorMessage;
  }
}

/**
 * Validates the OPC DA connection definition.
 * @param opcDa The OPC DA connection definition
 * @param errors The errors
 */
function validateOpcDa(opcDa: OpcDaDefinition, errors: KeyStringValue) {
  // Iterations
  const iterations = Number(opcDa.iterations as string);
  if (isNaN(iterations) || !Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    errors.iterations = I18n.get('invalid.iterations');
  }

  // Time interval
  const timeInterval = Number(opcDa.interval as string);
  if (isNaN(timeInterval) || timeInterval < MIN_TIME_INTERVAL || timeInterval > MAX_TIME_INTERVAL) {
    errors.interval = I18n.get('invalid.time.interval');
  }

  // Server name
  if (opcDa.serverName.trim() === '') {
    errors.opcDa_serverName = I18n.get('invalid.server.name');
  }

  // Machine IP
  if (!IP_REGEX.test(opcDa.machineIp)) {
    errors.opcDa_machineIp = I18n.get('invalid.machine.ip');
  }

  // Tags
  if ((!opcDa.listTags || opcDa.listTags.length === 0) && (!opcDa.tags || opcDa.tags.length === 0)) {
    errors.tags = I18n.get('invalid.tags');
  }
}

/**
 * Validates the OPC UA connection definition.
 * @param opcUa The OPC UA connection definition
 * @param errors The errors
 */
function validateOpcUa(opcUa: OpcUaDefinition, errors: KeyStringValue) {
  // Server name
  if (opcUa.serverName.trim() === '' || opcUa.serverName.trim().length > MAX_OPCUA_SERVER_NAME_CHARACTERS) {
    errors.opcUa_serverName = I18n.get('invalid.server.name');
  }

  // Machine IP
  if (!IP_REGEX.test(opcUa.machineIp)) {
    errors.opcUa_machineIp = I18n.get('invalid.machine.ip');
  }

  // Port
  if (opcUa.port !== undefined) {
    if (typeof opcUa.port !== 'string' || (typeof opcUa.port === 'string' && opcUa.port.trim() !== '')) {
      const port = Number(opcUa.port);
      if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
        errors.port = I18n.get('invalid.port');
      }
    }
  }
}

/**
 * Copies the original object and returns the deep copied object.
 * @param original The original object
 * @returns The deep copied object
 */
export function copyObject(original: any): any {
  if (typeof original !== 'object') {
    throw Error('Invalid object');
  }

  let copiedObject: any;
  if (!Array.isArray(original)) {
    copiedObject = {};
  } else {
    copiedObject = copyArray(original);
  }

  for (let key in original) {
    if (typeof original[key] === 'object' && !Array.isArray(original[key])) {
      copiedObject[key] = copyObject(original[key]);
    } else if (Array.isArray(original[key])) {
      copiedObject[key] = copyArray(original[key]);
    } else {
      copiedObject[key] = original[key];
    }
  }

  return copiedObject;
}

/**
 * Copies the original array and returns the deep copied array.
 * @param original The original array
 * @returns The deep copied array
 */
export function copyArray(original: any[]): any {
  if (!Array.isArray(original)) {
    throw Error('Invalid array');
  }

  const copiedArray: any[] = [];

  for (let item of original) {
    let copiedItem = item;

    if (typeof item === 'object' && !Array.isArray(item)) {
      copiedItem = copyObject(item);
    } else if (Array.isArray(item)) {
      copiedItem = copyArray(item);
    }

    copiedArray.push(copiedItem);
  }

  return copiedArray;
}