// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import {
  AlphaNumericValidationProps,
  ConnectionDefinition,
  KeyStringValue,
  MachineProtocol,
  OpcDaDefinition,
  OpcUaDefinition,
  OsiPiAuthMode,
  OsiPiDefinition
} from './types';

// Constant variables
const IP_REGEX = /^(?!0)(?!.*\.$)((?!0\d)(1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
const MAX_CHARACTERS = 30;
const MAX_ITERATIONS = 30;
const MIN_ITERATIONS = 1;
const MAX_TIME_INTERVAL = 30;
const MIN_TIME_INTERVAL = 0.5;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MAX_OPCUA_SERVER_NAME_CHARACTERS = 256;
const MAX_OSIPI_SERVER_NAME_CHARACTERS = 256;
const MIN_OSIPI_REQUEST_FREQUENCY = 1; //1 sec
const MAX_OSIPI_REQUEST_FREQUENCY = 3600; //1 hour
const MIN_OSIPI_CATCHUP_FREQUENCY = 0.1; //10 ms
const MAX_OSIPI_CATCHUP_FREQUENCY = 3600; //1 hour
const MIN_OSIPI_REQUEST_DURATION = 1; // 1 second
const MAX_OSIPI_REQUEST_DURATION = 3600; //1 hour
const MIN_OSIPI_QUERY_OFFSET = 0; //now
const MAX_OSIPI_QUERY_OFFSET = 86400; //1 day

/**
 * Validates the connection definition. If not valid, returns errors.
 * @param params The connection definition
 * @returns The errors if any validation fails
 */
export function validateConnectionDefinition(params: ConnectionDefinition): KeyStringValue {
  const errors: KeyStringValue = {};
  const { area, connectionName, greengrassCoreDeviceName, machineName, process, siteName } = params;

  /**
   * Checks the Greengrass core device name.
   * It should be string and not empty.
   */
  if (typeof greengrassCoreDeviceName !== 'string' || !greengrassCoreDeviceName.trim()) {
    errors.greengrassCoreDeviceName = I18n.get('invalid.greengrass.core.device.name');
  }

  /**
   * Checks the connection name, site name, area, process, and machine name to meet the Lambda function name constraints.
   * They only allow alphanumeric characters, hyphens, and underscores.
   * The maximum characters are 30 characters since the solution preserve characters.
   */
  validateAlphaNumericHyphenUnderscoreString({
    value: connectionName,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'connectionName',
    errorMessage: I18n.get('invalid.connection.name')
  });
  validateAlphaNumericHyphenUnderscoreString({
    value: siteName as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'siteName',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Site name')
  });
  validateAlphaNumericHyphenUnderscoreString({
    value: area as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'area',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Area')
  });
  validateAlphaNumericHyphenUnderscoreString({
    value: process as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'process',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Process')
  });
  validateAlphaNumericHyphenUnderscoreString({
    value: machineName as string,
    maxLength: MAX_CHARACTERS,
    errors,
    errorKeyName: 'machineName',
    errorMessage: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Machine name')
  });

  /**
   * Checks send data to IoT SiteWise, IoT topic and stream manager.
   * One of those should be set to be sent.
   */
  if (
    !params.sendDataToIoTSiteWise &&
    !params.sendDataToIoTTopic &&
    !params.sendDataToKinesisDataStreams &&
    !params.sendDataToTimestream
  ) {
    errors.sendDataTo = I18n.get('invalid.send.data.to');
  }

  if (params.protocol === MachineProtocol.OPCDA) {
    validateOpcDa(params.opcDa as OpcDaDefinition, errors);
  } else if (params.protocol === MachineProtocol.OPCUA) {
    validateOpcUa(params.opcUa as OpcUaDefinition, errors);
  } else if (params.protocol === MachineProtocol.OSIPI) {
    validateOsiPi(params.osiPi as OsiPiDefinition, errors);
  }

  return errors;
}

/**
 * Validates if the value only contains alphanumeric characters, hyphens, and underscores.
 * In addition, it validates the maximum length of the string.
 * @param props The validation check props
 */
function validateAlphaNumericHyphenUnderscoreString(props: AlphaNumericValidationProps) {
  if (
    typeof props.value !== 'string' ||
    props.value.trim().length > props.maxLength ||
    !/^[a-zA-Z0-9-_]+$/.test(props.value)
  ) {
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
  if (
    isNaN(iterations) ||
    !Number.isInteger(iterations) ||
    iterations < MIN_ITERATIONS ||
    iterations > MAX_ITERATIONS
  ) {
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
 * Validates the OSI PI connection definition.
 * @param osiPi The OSI PI connection definition
 * @param errors The errors
 */
function validateOsiPi(osiPi: OsiPiDefinition, errors: KeyStringValue) {
  if (!isValidUrl(osiPi.apiUrl)) {
    errors.osiPi_apiUrl = I18n.get('invalid.url');
  }

  // Server name
  if (osiPi.serverName.trim() === '' || osiPi.serverName.trim().length > MAX_OSIPI_SERVER_NAME_CHARACTERS) {
    errors.opcUa_serverName = I18n.get('invalid.server.name');
  }

  if (osiPi.authMode === OsiPiAuthMode.BASIC) {
    if (osiPi.username == undefined || osiPi.username.trim() === '') {
      errors.osiPi_username = I18n.get('invalid.username');
    }

    if (osiPi.password == undefined || osiPi.password.trim() === '') {
      errors.osiPi_password = I18n.get('invalid.password');
    }
  }

  let existingQueryError = false;

  const requestFrequency = Number(osiPi.requestFrequency as string);
  if (
    isNaN(requestFrequency) ||
    requestFrequency < MIN_OSIPI_REQUEST_FREQUENCY ||
    requestFrequency > MAX_OSIPI_REQUEST_FREQUENCY
  ) {
    errors.osiPi_requestFrequency = I18n.get('invalid.osiPi.requestFrequency');
    existingQueryError = true;
  }

  const catchupFrequency = Number(osiPi.catchupFrequency as string);
  if (
    isNaN(catchupFrequency) ||
    catchupFrequency < MIN_OSIPI_CATCHUP_FREQUENCY ||
    catchupFrequency > MAX_OSIPI_CATCHUP_FREQUENCY
  ) {
    errors.osiPi_catchupFrequency = I18n.get('invalid.osiPi.requestFrequency');
    existingQueryError = true;
  }

  const maxRequestDuration = Number(osiPi.maxRequestDuration as string);
  if (
    isNaN(maxRequestDuration) ||
    maxRequestDuration < MIN_OSIPI_REQUEST_DURATION ||
    maxRequestDuration > MAX_OSIPI_REQUEST_DURATION
  ) {
    errors.osiPi_maxRequestDuration = I18n.get('invalid.osiPi.maxRequestDuration');
    existingQueryError = true;
  }

  if (!existingQueryError) {
    if (maxRequestDuration <= requestFrequency) {
      errors.osiPi_maxRequestDuration = I18n.get('invalid.osiPi.maxRequestDurationVsRequestFrequency');
    }
    if (catchupFrequency > requestFrequency) {
      errors.osiPi_catchupFrequency = I18n.get('invalid.osiPi.catchupFrequencyVsRequestFrequency');
    }
  }

  const queryOffset = Number(osiPi.queryOffset as string);
  if (isNaN(queryOffset) || queryOffset < MIN_OSIPI_QUERY_OFFSET || queryOffset > MAX_OSIPI_QUERY_OFFSET) {
    errors.osiPi_queryOffset = I18n.get('invalid.osiPi.queryOffset');
  }

  // Tags
  if (!osiPi.tags || osiPi.tags.length === 0) {
    errors.osiPi_Tags = I18n.get('invalid.tags');
  }
}

/**
 * Validates the Greengrass core device name.
 * @param name Greengrass core device name
 * @returns If Greengrass core device name is valid
 */
export function validateGreengrassCoreDeviceName(name: string): boolean {
  return typeof name === 'string' && /^[a-zA-Z0-9-_:]{1,128}$/.test(name);
}

/**
 *
 * @param urlStr The URL to validate
 * @returns If the URL is in a valid format
 */
function isValidUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}
