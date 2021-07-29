// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaError } from './errors';
import { ConnectionBuilderTypes, ValidationsTypes } from './types';

const EMPTY_TYPES = [undefined, null];

/**
 * Validates the connection definition.
 * The function calls `validateDetailedConnectionDefinition` for `deploy` and `update` connections.
 * For more information about the connection definition, see `ConnectionBuilderTypes.ConnectionDefinition`.
 * @param connectionDefinition The connection definition
 * @throws `ValidationError` when the connection definition is invalid
 */
export function validateConnectionDefinition(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition): void {
  const { connectionName, control, protocol } = connectionDefinition;

  /**
   * Due to the constraints of the Lambda function name, the connection name only allows alphanumeric characters, hypens, and underscores.
   * In addition, the solution preserve about 25 characters for the Lambda function name, it only allows 30 characters for a safety purpose
   * although the Lambda function name allows 64 characters.
   */
  validateAlphaNumericHyphenUnderscoreString(connectionName, 'connectionName', ValidationsTypes.MAX_CHARACTERS);

  if (typeof control !== 'string' || !Object.values(ConnectionBuilderTypes.ConnectionControl).includes(control)) {
    throw new LambdaError({
      message: `"control" is missing or invalid from the connection definition. It should be one of these: ${Object.values(ConnectionBuilderTypes.ConnectionControl)}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!Object.values(ConnectionBuilderTypes.MachineProtocol).includes(protocol)) {
    throw new LambdaError({
      message: `"protocol" is invalid from the connection definition. It should be one of these: ${Object.values(ConnectionBuilderTypes.MachineProtocol)}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  // Only `deploy` and `update` connections require to check more values.
  if (control === ConnectionBuilderTypes.ConnectionControl.DEPLOY || control === ConnectionBuilderTypes.ConnectionControl.UPDATE) {
    validateDetailedConnectionDefinition(connectionDefinition);
  }
}

/**
 * Validates if the detailed connection definition is valid.
 * @param connectionDefinition The connection definition
 * @throws `ValidationError` when the connection definition is invalid
 */
function validateDetailedConnectionDefinition(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition) {
  // Validates if sending data to at least one destination
  const { sendDataToIoTSitewise, sendDataToIoTTopic, sendDataToKinesisDataStreams } = connectionDefinition;
  validateDestinationValue(sendDataToIoTSitewise, 'sendDataToIoTSitewise');
  validateDestinationValue(sendDataToIoTTopic, 'sendDataToIoTTopic');
  validateDestinationValue(sendDataToKinesisDataStreams, 'sendDataToKinesisDataStreams');

  if (!sendDataToIoTSitewise && !sendDataToIoTTopic && !sendDataToKinesisDataStreams) {
    throw new LambdaError({
      message: 'At least one data destination should be set: sendDataToIoTSitewise, sendDataToIoTTopic, sendDataToKinesisDataStreams.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  // Validates asset hierarchy values. All values are required and string.
  const { siteName, area, process, machineName } = connectionDefinition;
  validateAlphaNumericHyphenUnderscoreString(siteName, 'siteName', ValidationsTypes.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(area, 'area', ValidationsTypes.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(process, 'process', ValidationsTypes.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(machineName, 'machineName', ValidationsTypes.MAX_CHARACTERS);

  // Since protocol validation is done previously, it simple checks with if/else.
  const { protocol } = connectionDefinition;
  if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
    // OPC DA
    validateOpcDaConnectionDefinition(connectionDefinition.opcDa);
  } else {
    // OPC UA
    validateOpcUaConnectionDefinition(connectionDefinition.opcUa);
  }
}

/**
 * Validates if the value only contains alphanumeric characters, hyphens, and underscores.
 * In addition, it validates the maximum length of the string.
 * @param value The string value
 * @param name The strinv value name
 * @param maxLength The maximum length for the string value
 * @throws `ValidationError` when the string value is invalid
 */
function validateAlphaNumericHyphenUnderscoreString(value: string, name: string, maxLength: number) {
  if (typeof value !== 'string'
    || value.trim().length > maxLength
    || !/^[a-zA-Z0-9-_]+$/.test(value)) {
    throw new LambdaError({
      message: `"${name}" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hypens, and underscores. The maximum length is ${maxLength} characters.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates if sending data to the destination value is valid.
 * @param value The destination boolean value
 * @param name The destination name
 * @throws `ValidationError` when the sending data to the destination is invalid
 */
function validateDestinationValue(value: boolean, name: string) {
  if (!EMPTY_TYPES.includes(value) && typeof value !== 'boolean') {
    throw new LambdaError({
      message: `"${name}" is invalid from the connection definition. It is optional and should be boolean.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the OPC DA connection definition.
 * @param opcDa The OPC DA connection definition
 * @throws `ValidationError` when the OPC DA connection definition is invalid
 */
function validateOpcDaConnectionDefinition(opcDa: ConnectionBuilderTypes.OpcDaDefinition) {
  // Since the type of array is also `object`, it checks if the value is an array.
  if (typeof opcDa !== 'object' || Array.isArray(opcDa) || Object.keys(opcDa).length === 0) {
    throw new LambdaError({
      message: '"opcDa" is missing or invalid from the connection definition. See the implementation guide.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const { machineIp, serverName, interval, iterations, listTags, tags } = opcDa;
  validateIpAddress(machineIp);
  validateStringValue(serverName, 'serverName');
  validateMachineQueryValues(iterations, interval);
  validateAllTags(listTags, tags);
}

/**
 * Validates the machine IP address.
 * @param ipAddress The IP address
 * @throws `ValidationError` when the IP address is invalid
 */
function validateIpAddress(ipAddress: string) {
  const ipRegExp = /^(?!0)(?!.*\.$)((?!0\d)(1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;  // NOSONAR: typescript:S4784 - For the IP Address check
  if (typeof ipAddress !== 'string' || !ipRegExp.test(ipAddress)) {
    throw new LambdaError({
      message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the machine query values.
 * @param iterations The machine query iterations
 * @param interval The machine query time interval
 * @throws `ValidationError` when the machine query iterations or time interval is invalid
 */
function validateMachineQueryValues(iterations: number, interval: number) {
  if (!Number.isInteger(iterations) || iterations < ValidationsTypes.MIN_ITERATION || iterations > ValidationsTypes.MAX_ITERATION) {
    throw new LambdaError({
      message: `"iterations" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsTypes.MIN_ITERATION} and ${ValidationsTypes.MAX_ITERATION}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (typeof interval !== 'number' || interval < ValidationsTypes.MIN_INTERVAL || interval > ValidationsTypes.MAX_INTERVAL) {
    throw new LambdaError({
      message: `"interval" is missing or invalid from the connection definition. It should be a float number between ${ValidationsTypes.MIN_INTERVAL} and ${ValidationsTypes.MAX_INTERVAL}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the string value.
 * It checks the type of the value and if the string is empty.
 * @param value The string value
 * @param name The name of the string value
 * @throws `ValidationError` when the string value is invalid
 */
function validateStringValue(value: string, name: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new LambdaError({
      message: `"${name}" is missing or invalid from the connection definition. It should be a non-empty string.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates listTags and tags.
 * @param listTags The list tags
 * @param tags The specific tags
 * @throws `ValidationError` when list tags or tags are invalid
 */
function validateAllTags(listTags: string[], tags: string[]) {
  if (EMPTY_TYPES.includes(listTags) && EMPTY_TYPES.includes(tags)) {
    throw new LambdaError({
      message: 'Tags are missing. At least one of these should have at least one tag: listTags, tags.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!EMPTY_TYPES.includes(listTags) && !Array.isArray(listTags)) {
    throw new LambdaError({
      message: `"listTags" is invalid from the connection definition. It should be a string array.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!EMPTY_TYPES.includes(tags) && !Array.isArray(tags)) {
    throw new LambdaError({
      message: `"tags" is invalid from the connection definition. It should be a string array.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const listTagsLength = listTags ? listTags.length : 0;
  const tagsLength = tags ? tags.length : 0;

  if (listTagsLength + tagsLength === 0) {
    throw new LambdaError({
      message: `Both "listTags" and "tags" are empty. At least one of them should have at least one tag.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (listTagsLength > 0) validateTags(listTags, 'listTags');
  if (tagsLength > 0) validateTags(tags, 'tags');
}

/**
 * Validates items in tags array.
 * @param tags The tags array
 * @param name The name of the tags
 * @throws `ValidationError` when any item in tags is invalid
 */
function validateTags(tags: string[], name: string) {
  for (let tag of tags) {
    validateStringValue(tag, `Tag in ${name}`);
  }
}

/**
 * Validates the OPC UA connection definition.
 * @param opcUa The OPC UA connection definition
 * @throws `ValidationError` when the OPC UA connection definition is invalid
 */
function validateOpcUaConnectionDefinition(opcUa: ConnectionBuilderTypes.OpcUaDefinition) {
  // Since the type of array is also `object`, it checks if the value is an array.
  if (typeof opcUa !== 'object' || Array.isArray(opcUa) || Object.keys(opcUa).length === 0) {
    throw new LambdaError({
      message: '"opcUa" is missing or invalid from the connection definition. See the implementation guide.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const { machineIp, serverName, port } = opcUa;
  validateIpAddress(machineIp);

  if (typeof serverName !== 'string' || serverName.trim() === '' || serverName.trim().length > ValidationsTypes.MAX_OPCUA_SERVER_NAME_CHARACTERS) {
    throw new LambdaError({
      message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string up to ${ValidationsTypes.MAX_OPCUA_SERVER_NAME_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!EMPTY_TYPES.includes(port)) {
    if (!Number.isInteger(port) || port < ValidationsTypes.MIN_PORT || port > ValidationsTypes.MAX_PORT) {
      throw new LambdaError({
        message: `"port" is invalid from the connection definition. It should be an integer number between ${ValidationsTypes.MIN_PORT} and ${ValidationsTypes.MAX_PORT}.`,
        name: 'ValidationError',
        statusCode: 400
      });
    }
  }
}