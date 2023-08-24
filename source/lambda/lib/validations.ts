// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaError } from './errors';
import {
  GreengrassCoreDeviceControl,
  GreengrassCoreDeviceOsPlatform,
  PostGreengrassRequestBodyInput
} from './types/connection-builder-types';
import { CreatedBy } from './types/dynamodb-handler-types';
import {
  ConnectionControl,
  ConnectionDefinition,
  MachineProtocol,
  OpcDaDefinition,
  OpcUaDefinition,
  OsiPiAuthMode,
  OsiPiDefinition
} from './types/solution-common-types';
import { ModbusTcpDefinition, ModbusTcpSecondaryDefinition } from './types/modbus-types';

const EMPTY_TYPES = [undefined, null];
export const ValidationsLimit = {
  MAX_CHARACTERS: 30,
  MAX_GREENGRASS_CORE_NAME_CHARACTERS: 128,
  MAX_INTERVAL: 30,
  MIN_INTERVAL: 0.5,
  MIN_ITERATION: 1,
  MAX_ITERATION: 30,
  MIN_PORT: 1,
  MAX_PORT: 65535,
  MAX_OPCUA_SERVER_NAME_CHARACTERS: 256,
  MIN_OSIPI_REQUEST_FREQUENCY: 1, //1 sec
  MAX_OSIPI_REQUEST_FREQUENCY: 3600, //1 hr
  MIN_OSIPI_CATCHUP_FREQUENCY: 0.1, //10ms
  MAX_OSIPI_CATCHUP_FREQUENCY: 3600, //1 hr
  MIN_OSIPI_REQUEST_DURATION: 1, //1 sec
  MAX_OSIPI_REQUEST_DURATION: 3600, //1 hr
  MIN_OSIPI_QUERY_OFFSET: 0, //now
  MAX_OSIPI_QUERY_OFFSET: 86400 //1 day
};

/**
 * Validates the connection definition.
 * The function calls `validateDetailedConnectionDefinition` for `deploy` and `update` connections.
 * For more information about the connection definition, see `ConnectionDefinition`.
 * @param connectionDefinition The connection definition
 * @throws `ValidationError` when the connection definition is invalid
 */
export function validateConnectionDefinition(connectionDefinition: ConnectionDefinition): void {
  const { connectionName, control, greengrassCoreDeviceName, protocol } = connectionDefinition;
  const controlValues = Object.values(ConnectionControl);
  const protocolValues = Object.values(MachineProtocol);

  /**
   * Due to the constraints of the Lambda function name, the connection name only allows alphanumeric characters, hyphens, and underscores.
   * In addition, the solution preserve about 25 characters for the Lambda function name, it only allows 30 characters for a safety purpose
   * although the Lambda function name allows 64 characters.
   */
  validateAlphaNumericHyphenUnderscoreString(connectionName, 'connectionName', ValidationsLimit.MAX_CHARACTERS);

  if (typeof control !== 'string' || !controlValues.includes(control)) {
    throw new LambdaError({
      message: `"control" is missing or invalid from the connection definition. It should be one of these: ${controlValues}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!protocolValues.includes(protocol)) {
    throw new LambdaError({
      message: `"protocol" (${protocol}) is invalid from the connection definition. It should be one of these: ${protocolValues}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  // Only `deploy` connection requires to check Greengrass core device name.
  if (
    control === ConnectionControl.DEPLOY &&
    (typeof greengrassCoreDeviceName !== 'string' || !/^[a-zA-Z0-9-_:]{1,128}$/.test(greengrassCoreDeviceName))
  ) {
    throw new LambdaError({
      message: `"greengrassCoreDeviceName" is invalid from the connection definition. Please provide existing Greengrass core device in the system.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  // Only `deploy` and `update` connections require to check more values.
  if ([ConnectionControl.DEPLOY, ConnectionControl.UPDATE].includes(control)) {
    validateDetailedConnectionDefinition(connectionDefinition);
  }
}

/**
 * Validates if the detailed connection definition is valid.
 * @param connectionDefinition The connection definition
 * @throws `ValidationError` when the connection definition is invalid
 */
function validateDetailedConnectionDefinition(connectionDefinition: ConnectionDefinition) {
  const {
    siteName,
    area,
    process,
    machineName,
    protocol,
    sendDataToIoTSiteWise,
    sendDataToIoTTopic,
    sendDataToKinesisDataStreams,
    sendDataToTimestream,
    sendDataToHistorian
  } = connectionDefinition;

  // Validates if sending data to at least one destination
  validateDestinationValue(sendDataToIoTSiteWise, 'sendDataToIoTSiteWise');
  validateDestinationValue(sendDataToIoTTopic, 'sendDataToIoTTopic');
  validateDestinationValue(sendDataToKinesisDataStreams, 'sendDataToKinesisDataStreams');
  validateDestinationValue(sendDataToTimestream, 'sendDataToTimestream');
  validateDestinationValue(sendDataToHistorian, 'sendDataToHistorian');

  if (
    !sendDataToIoTSiteWise &&
    !sendDataToIoTTopic &&
    !sendDataToKinesisDataStreams &&
    !sendDataToTimestream &&
    !sendDataToHistorian
  ) {
    throw new LambdaError({
      message:
        'At least one data destination should be set: sendDataToIoTSiteWise, sendDataToIoTTopic, sendDataToKinesisDataStreams, sendDataToTimestream, sendDataToHistorian.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  // Validates asset hierarchy values. All values are required and string.
  validateAlphaNumericHyphenUnderscoreString(siteName, 'siteName', ValidationsLimit.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(area, 'area', ValidationsLimit.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(process, 'process', ValidationsLimit.MAX_CHARACTERS);
  validateAlphaNumericHyphenUnderscoreString(machineName, 'machineName', ValidationsLimit.MAX_CHARACTERS);

  // Since protocol validation is done previously, it simple checks with if/else.
  if (protocol === MachineProtocol.OPCDA) {
    // OPC DA
    validateOpcDaConnectionDefinition(connectionDefinition.opcDa);
  } else if (protocol === MachineProtocol.OPCUA) {
    // OPC UA
    validateOpcUaConnectionDefinition(connectionDefinition.opcUa);
  } else if (protocol === MachineProtocol.OSIPI) {
    // OSI PI
    validateOsiPiConnectionDefinition(connectionDefinition.osiPi);
<<<<<<< HEAD
=======
  } else if (protocol === MachineProtocol.MODBUSTCP) {
    // Modbus TCP
    validateModbusTcpConnectionDefinition(connectionDefinition.modbusTcp);
>>>>>>> main
  }
}

/**
 * Validates if the value only contains alphanumeric characters, hyphens, and underscores.
 * In addition, it validates the maximum length of the string.
 * @param value The string value
 * @param name The string value name
 * @param maxLength The maximum length for the string value
 * @throws `ValidationError` when the string value is invalid
 */
function validateAlphaNumericHyphenUnderscoreString(value: string, name: string, maxLength: number) {
  if (typeof value !== 'string' || value.trim().length > maxLength || !/^[a-zA-Z0-9-_]+$/.test(value)) {
    throw new LambdaError({
      message: `"${name}" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${maxLength} characters.`,
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
function validateOpcDaConnectionDefinition(opcDa: OpcDaDefinition) {
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
  const ipRegExp = /^(?!0)(?!.*\.$)((?!0\d)(1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
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
  if (
    !Number.isInteger(iterations) ||
    iterations < ValidationsLimit.MIN_ITERATION ||
    iterations > ValidationsLimit.MAX_ITERATION
  ) {
    throw new LambdaError({
      message: `"iterations" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_ITERATION} and ${ValidationsLimit.MAX_ITERATION}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (
    typeof interval !== 'number' ||
    interval < ValidationsLimit.MIN_INTERVAL ||
    interval > ValidationsLimit.MAX_INTERVAL
  ) {
    throw new LambdaError({
      message: `"interval" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_INTERVAL} and ${ValidationsLimit.MAX_INTERVAL}.`,
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
 * Validates that port is in right range
 * @param port the port number
 */
function validatePort(port: number) {
  if (!EMPTY_TYPES.includes(port)) {
    if (!Number.isInteger(port) || port < ValidationsLimit.MIN_PORT || port > ValidationsLimit.MAX_PORT) {
      throw new LambdaError({
        message: `"port" is invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_PORT} and ${ValidationsLimit.MAX_PORT}.`,
        name: 'ValidationError',
        statusCode: 400
      });
    }
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

  if (listTagsLength > 0) validateTagItems(listTags, 'listTags');
  if (tagsLength > 0) validateTagItems(tags, 'tags');
}

/**
 * Validates tags.
 * @param tags The specific tags
 * @throws `ValidationError` when list tags or tags are invalid
 */
function validateTags(tags: string[]) {
  if (EMPTY_TYPES.includes(tags)) {
    throw new LambdaError({
      message: 'Tags are missing. At least one tag must be specified: tags.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!Array.isArray(tags)) {
    throw new LambdaError({
      message: `"tags" is invalid from the connection definition. It should be a string array.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const tagsLength = tags ? tags.length : 0;

  if (tagsLength === 0) {
    throw new LambdaError({
      message: `"tags" is empty. At least one tag is required.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (tagsLength > 0) validateTagItems(tags, 'tags');
}
/**
 * Validates items in tags array.
 * @param tags The tags array
 * @param name The name of the tags
 * @throws `ValidationError` when any item in tags is invalid
 */
function validateTagItems(tags: string[], name: string) {
  for (const tag of tags) {
    validateStringValue(tag, `Tag in ${name}`);
  }
}

/**
 * Validates the OPC UA connection definition.
 * @param opcUa The OPC UA connection definition
 * @throws `ValidationError` when the OPC UA connection definition is invalid
 */
function validateOpcUaConnectionDefinition(opcUa: OpcUaDefinition) {
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

  if (
    typeof serverName !== 'string' ||
    serverName.trim() === '' ||
    serverName.trim().length > ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS
  ) {
    throw new LambdaError({
      message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string up to ${ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (!EMPTY_TYPES.includes(port)) {
    validatePort(port);
  }
}

/**
 * Validates the Modbus TCP connection definition.
 * @param modbusTcp The Modbus TCP connection definition
 * @throws `ValidationError` when the Modbus TCP connection definition is invalid
 */
function validateModbusTcpConnectionDefinition(modbusTcp: ModbusTcpDefinition) {
  // Since the type of array is also `object`, it checks if the value is an array.
  if (typeof modbusTcp !== 'object' || Array.isArray(modbusTcp) || Object.keys(modbusTcp).length === 0) {
    throw new LambdaError({
      message: '"modbusTcp" is missing or invalid from the connection definition. See the implementation guide.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const { host, hostPort, hostTag, modbusSecondariesConfig } = modbusTcp;

  validateStringValue(host, 'host');
  validatePort(hostPort);
  validateStringValue(hostTag, 'hostTag');

  if (modbusSecondariesConfig.length === 0) {
    throw new LambdaError({
      message: '"modbusTcp" secondary config cannot be empty',
      name: 'ValidationError',
      statusCode: 400
    });
  } else {
    for (const modbusSecondaryConfig of modbusSecondariesConfig) {
      validatemodbusSecondaryConfig(modbusSecondaryConfig);
    }
  }
}

/**
 * Validates individual secondary configs
 * @param modbusSecondaryConfig the individual secondary config for modbus
 */
function validatemodbusSecondaryConfig(modbusSecondaryConfig: ModbusTcpSecondaryDefinition) {
  let failureCondition = '';
  if (!Number.isInteger(modbusSecondaryConfig.frequencyInSeconds)) {
    failureCondition = 'Frequency in seconds must be number';
  }

  if (!Number.isInteger(modbusSecondaryConfig.secondaryAddress)) {
    failureCondition = 'Secondary address must be number';
  }

  // read coils
  failureCondition = validateReadCoils(modbusSecondaryConfig, failureCondition);

  // discrete inputs
  failureCondition = validateDiscreteInputs(modbusSecondaryConfig, failureCondition);

  // holding registers
  failureCondition = validateHoldingRegisters(modbusSecondaryConfig, failureCondition);

  // input registers
  failureCondition = validateInputRegisters(modbusSecondaryConfig, failureCondition);

  if (failureCondition.length > 0) {
    throw new LambdaError({
      message: `"modbusTcp" secondary definition failed validation: ${failureCondition}`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 *
 * @param modbusSecondaryConfig
 * @param failureCondition
 */
function validateInputRegisters(modbusSecondaryConfig: ModbusTcpSecondaryDefinition, failureCondition: string) {
  if (modbusSecondaryConfig.commandConfig.readInputRegisters !== undefined) {
    if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readInputRegisters.address)) {
      failureCondition = 'Read input registers address must be a number';
    }
    if (modbusSecondaryConfig.commandConfig.readInputRegisters.count !== undefined) {
      if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readInputRegisters.count)) {
        failureCondition = 'Read input registers count must be a number';
      }
    }
  }
  return failureCondition;
}

/**
 *
 * @param modbusSecondaryConfig
 * @param failureCondition
 */
function validateHoldingRegisters(modbusSecondaryConfig: ModbusTcpSecondaryDefinition, failureCondition: string) {
  if (modbusSecondaryConfig.commandConfig.readHoldingRegisters !== undefined) {
    if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readHoldingRegisters.address)) {
      failureCondition = 'Read holding registers address must be a number';
    }
    if (modbusSecondaryConfig.commandConfig.readHoldingRegisters.count !== undefined) {
      if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readHoldingRegisters.count)) {
        failureCondition = 'Read holding registers count must be a number';
      }
    }
  }
  return failureCondition;
}

/**
 *
 * @param modbusSecondaryConfig
 * @param failureCondition
 */
function validateDiscreteInputs(modbusSecondaryConfig: ModbusTcpSecondaryDefinition, failureCondition: string) {
  if (modbusSecondaryConfig.commandConfig.readDiscreteInputs !== undefined) {
    if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readDiscreteInputs.address)) {
      failureCondition = 'Read discrete inputs address must be a number';
    }
    if (modbusSecondaryConfig.commandConfig.readDiscreteInputs.count !== undefined) {
      if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readDiscreteInputs.count)) {
        failureCondition = 'Read discrete inputs count must be a number';
      }
    }
  }
  return failureCondition;
}

/**
 *
 * @param modbusSecondaryConfig
 * @param failureCondition
 */
function validateReadCoils(modbusSecondaryConfig: ModbusTcpSecondaryDefinition, failureCondition: string) {
  if (modbusSecondaryConfig.commandConfig.readCoils !== undefined) {
    if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readCoils.address)) {
      failureCondition = 'Read coils address must be a number';
    }
    if (modbusSecondaryConfig.commandConfig.readCoils.count !== undefined) {
      if (!Number.isInteger(modbusSecondaryConfig.commandConfig.readCoils.count)) {
        failureCondition = 'Read coils count must be a number';
      }
    }
  }
  return failureCondition;
}

// TODO: this needs to be unit tested, was skipped when osi pi was implemented
/**
 * Validates the OSI PI connection definition.
 * @param osiPi The OSI PI connection definition
 * @throws `ValidationError` when the OSI PI connection definition is invalid
 */
function validateOsiPiConnectionDefinition(osiPi: OsiPiDefinition) {
  // Since the type of array is also `object`, it checks if the value is an array.
  if (typeof osiPi !== 'object' || Array.isArray(osiPi) || Object.keys(osiPi).length === 0) {
    throw new LambdaError({
      message: '"osiPi" is missing or invalid from the connection definition. See the implementation guide.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const {
    apiUrl,
    serverName,
    authMode,
    username,
    password,
    requestFrequency,
    catchupFrequency,
    maxRequestDuration,
    queryOffset,
    tags
  } = osiPi;

  validateUrl(apiUrl);
  if (authMode === OsiPiAuthMode.BASIC) {
    validateStringValue(username, 'username');
    validateStringValue(password, 'password');
  }
  validateStringValue(serverName, 'serverName');
  validateOsiPiQueryValues(requestFrequency, catchupFrequency, maxRequestDuration);
  validateOsiPiQueryOffsetValue(queryOffset);
  validateTags(tags);
}

/**
 * Checks if string is a valid URL
 * @param urlStr The url to validate
 */
function validateUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new LambdaError({
        message: `"apiUrl" protocol is invalid. It should be either 'https' or 'http'.`,
        name: 'ValidationError',
        statusCode: 400
      });
    }
  } catch (_) {
    throw new LambdaError({
      message: `"apiUrl" is empty or malformed.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the osi pi query values.
 * @param requestFrequency The api query frequency
 * @param catchupFrequency The api query frequency when catching up to live data
 * @param maxRequestDuration The maximum duration that a single api request can cover
 * @throws `ValidationError` when any property is invalid
 */
function validateOsiPiQueryValues(requestFrequency: number, catchupFrequency: number, maxRequestDuration: number) {
  if (
    !Number.isInteger(requestFrequency) ||
    requestFrequency < ValidationsLimit.MIN_OSIPI_REQUEST_FREQUENCY ||
    requestFrequency > ValidationsLimit.MAX_OSIPI_REQUEST_FREQUENCY
  ) {
    throw new LambdaError({
      message: `"requestFrequency" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_OSIPI_REQUEST_FREQUENCY} and ${ValidationsLimit.MAX_OSIPI_REQUEST_FREQUENCY}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (
    typeof catchupFrequency !== 'number' ||
    catchupFrequency < ValidationsLimit.MIN_OSIPI_CATCHUP_FREQUENCY ||
    catchupFrequency > ValidationsLimit.MAX_OSIPI_CATCHUP_FREQUENCY
  ) {
    throw new LambdaError({
      message: `"catchupFrequency" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_OSIPI_CATCHUP_FREQUENCY} and ${ValidationsLimit.MAX_OSIPI_CATCHUP_FREQUENCY}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (
    typeof maxRequestDuration !== 'number' ||
    maxRequestDuration < ValidationsLimit.MIN_OSIPI_REQUEST_DURATION ||
    maxRequestDuration > ValidationsLimit.MAX_OSIPI_REQUEST_DURATION
  ) {
    throw new LambdaError({
      message: `"maxRequestDuration" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_OSIPI_REQUEST_DURATION} and ${ValidationsLimit.MAX_OSIPI_REQUEST_DURATION}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (maxRequestDuration <= requestFrequency) {
    throw new LambdaError({
      message: `"maxRequestDuration" must be greater than "requestFrequency"`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (catchupFrequency > requestFrequency) {
    throw new LambdaError({
      message: `"catchupFrequency" must be less than or equal to "requestFrequency"`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the osi pi query offset value.
 * @param queryOffset The offset from current time to query at
 * @throws `ValidationError` when any property is invalid
 */
function validateOsiPiQueryOffsetValue(queryOffset: number) {
  if (
    !Number.isInteger(queryOffset) ||
    queryOffset < ValidationsLimit.MIN_OSIPI_QUERY_OFFSET ||
    queryOffset > ValidationsLimit.MAX_OSIPI_QUERY_OFFSET
  ) {
    throw new LambdaError({
      message: `"queryOffset" is missing or invalid from the connection definition. It should be a number from ${ValidationsLimit.MIN_OSIPI_QUERY_OFFSET} to ${ValidationsLimit.MAX_OSIPI_QUERY_OFFSET}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the OSI PI connection definition.
 * @param osiPi The OSI PI connection definition
 * @throws `ValidationError` when the OSI PI connection definition is invalid
 */
function validateOsiPiConnectionDefinition(osiPi: OsiPiDefinition) {
  // Since the type of array is also `object`, it checks if the value is an array.
  if (typeof osiPi !== 'object' || Array.isArray(osiPi) || Object.keys(osiPi).length === 0) {
    throw new LambdaError({
      message: '"opcDa" is missing or invalid from the connection definition. See the implementation guide.',
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const {
    apiUrl,
    serverName,
    authMode,
    username,
    password,
    requestFrequency,
    catchupFrequency,
    maxRequestDuration,
    queryOffset,
    tags
  } = osiPi;

  validateUrl(apiUrl);
  if (authMode === OsiPiAuthMode.BASIC) {
    validateStringValue(username, 'username');
    validateStringValue(password, 'password');
  }
  validateStringValue(serverName, 'serverName');
  validateOsiPiQueryValues(requestFrequency, catchupFrequency, maxRequestDuration);
  validateOsiPiQueryOffsetValue(queryOffset);
  validateTags(tags);
}

/**
 * Checks if string is a valid URL
 * @param urlStr The url to validate
 */
function validateUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new LambdaError({
        message: `"apiUrl" protocol is invalid. It should be either 'https' or 'http'.`,
        name: 'ValidationError',
        statusCode: 400
      });
    }
  } catch (_) {
    throw new LambdaError({
      message: `"apiUrl" is empty or malformed.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the osi pi query values.
 * @param requestFrequency The api query frequency
 * @param catchupFrequency The api query frequency when catching up to live data
 * @param maxRequestDuration The maximum duration that a single api request can cover
 * @throws `ValidationError` when any property is invalid
 */
function validateOsiPiQueryValues(requestFrequency: number, catchupFrequency: number, maxRequestDuration: number) {
  if (
    !Number.isInteger(requestFrequency) ||
    requestFrequency < ValidationsLimit.MIN_OSIPI_REQUEST_FREQUENCY ||
    requestFrequency > ValidationsLimit.MAX_OSIPI_REQUEST_FREQUENCY
  ) {
    throw new LambdaError({
      message: `"requestFrequency" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_OSIPI_REQUEST_FREQUENCY} and ${ValidationsLimit.MAX_OSIPI_REQUEST_FREQUENCY}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (
    typeof catchupFrequency !== 'number' ||
    catchupFrequency < ValidationsLimit.MIN_OSIPI_CATCHUP_FREQUENCY ||
    catchupFrequency > ValidationsLimit.MAX_OSIPI_CATCHUP_FREQUENCY
  ) {
    throw new LambdaError({
      message: `"catchupFrequency" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_OSIPI_CATCHUP_FREQUENCY} and ${ValidationsLimit.MAX_OSIPI_CATCHUP_FREQUENCY}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (
    typeof maxRequestDuration !== 'number' ||
    maxRequestDuration < ValidationsLimit.MIN_OSIPI_REQUEST_DURATION ||
    maxRequestDuration > ValidationsLimit.MAX_OSIPI_REQUEST_DURATION
  ) {
    throw new LambdaError({
      message: `"maxRequestDuration" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_OSIPI_REQUEST_DURATION} and ${ValidationsLimit.MAX_OSIPI_REQUEST_DURATION}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (maxRequestDuration <= requestFrequency) {
    throw new LambdaError({
      message: `"maxRequestDuration" must be greater than "requestFrequency"`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  if (catchupFrequency > requestFrequency) {
    throw new LambdaError({
      message: `"catchupFrequency" must be less than or equal to "requestFrequency"`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates the osi pi query offset value.
 * @param queryOffset The offset from current time to query at
 * @throws `ValidationError` when any property is invalid
 */
function validateOsiPiQueryOffsetValue(queryOffset: number) {
  if (
    !Number.isInteger(queryOffset) ||
    queryOffset < ValidationsLimit.MIN_OSIPI_QUERY_OFFSET ||
    queryOffset > ValidationsLimit.MAX_OSIPI_QUERY_OFFSET
  ) {
    throw new LambdaError({
      message: `"queryOffset" is missing or invalid from the connection definition. It should be a number from ${ValidationsLimit.MIN_OSIPI_QUERY_OFFSET} to ${ValidationsLimit.MAX_OSIPI_QUERY_OFFSET}.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}

/**
 * Validates if Greengrass core device POST request input is valid.
 * @param input The Greengrass core device POST request input
 * @throws `ValidationError` when the input is invalid
 */
export function validateGreengrassCoreDeviceRequest(input: PostGreengrassRequestBodyInput): void {
  const { name, control, createdBy, osPlatform } = input;

  // The name can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).
  if (typeof name !== 'string' || !/^[a-zA-Z0-9-_:]{1,128}$/.test(name)) {
    throw new LambdaError({
      message: `"name" can be up to 128 characters. Valid characters: a-z, A-Z, 0-9, colon (:), underscore (_), and hyphen (-).`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const controlValues = Object.values(GreengrassCoreDeviceControl);
  if (!controlValues.includes(control)) {
    throw new LambdaError({
      message: `Only "create" and "delete" controls are valid.`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const createdByValues = Object.values(CreatedBy);
  if (!createdByValues.includes(createdBy)) {
    throw new LambdaError({
      message: `Only "System" and "User" are valid for "createdBy".`,
      name: 'ValidationError',
      statusCode: 400
    });
  }

  const osPlatformValues = Object.values(GreengrassCoreDeviceOsPlatform);
  if (!osPlatformValues.includes(osPlatform)) {
    throw new LambdaError({
      message: `Only "linux" and "windows" are valid for "osPlatform".`,
      name: 'ValidationError',
      statusCode: 400
    });
  }
}
