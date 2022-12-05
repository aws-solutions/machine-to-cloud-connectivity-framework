// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Auth } from '@aws-amplify/auth';
import { Logger } from '@aws-amplify/core';
import {
  AmplifyConfigurationInput,
  AmplifyConfigurationResponse,
  ConnectionControl,
  ConnectionDefinition,
  ErrorMessage,
  ErrorProps,
  GetConnectionResponse,
  ListConnectionsResponse,
  ListGreengrassCoreDevicesResponse,
  ListLogsResponse,
  MachineProtocol,
  ModbusTcpDefinition,
  OpcDaDefinition,
  OpcUaDefinition,
  OsiPiAuthMode,
  OsiPiDefinition,
  PaginationType
} from './types';

// Logger for Utils
const logger = new Logger('Utils');

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
    },
    Storage: {
      AWSS3: {
        bucket: config.s3Bucket,
        region: config.region
      }
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
 * @returns The connection definition format required by the backend
 */
export function buildConnectionDefinition(params: ConnectionDefinition): ConnectionDefinition {
  const { connectionName, control, greengrassCoreDeviceName, protocol } = params;
  const connectionDefinition: ConnectionDefinition = {
    connectionName,
    control,
    greengrassCoreDeviceName,
    protocol
  };

  if ([ConnectionControl.DEPLOY, ConnectionControl.UPDATE].includes(params.control)) {
    connectionDefinition.area = params.area;
    connectionDefinition.machineName = params.machineName;
    connectionDefinition.process = params.process;
    connectionDefinition.siteName = params.siteName;

    connectionDefinition.logLevel = params.logLevel;

    connectionDefinition.sendDataToIoTSiteWise = params.sendDataToIoTSiteWise;
    connectionDefinition.sendDataToIoTTopic = params.sendDataToIoTTopic;
    connectionDefinition.sendDataToKinesisDataStreams = params.sendDataToKinesisDataStreams;
    connectionDefinition.sendDataToTimestream = params.sendDataToTimestream;
    connectionDefinition.sendDataToHistorian = params.sendDataToHistorian;
    connectionDefinition.historianKinesisDatastreamName = params.historianKinesisDatastreamName;

    if (params.protocol === MachineProtocol.OPCDA) {
      connectionDefinition.opcDa = params.opcDa as OpcDaDefinition;
      connectionDefinition.opcDa.interval = Number(connectionDefinition.opcDa.interval);
      connectionDefinition.opcDa.iterations = Number(connectionDefinition.opcDa.iterations);
    } else if (params.protocol === MachineProtocol.OPCUA) {
      connectionDefinition.opcUa = params.opcUa as OpcUaDefinition;

      if (connectionDefinition.opcUa.port === undefined || String(connectionDefinition.opcUa.port).trim() === '') {
        delete connectionDefinition.opcUa.port;
      } else {
        connectionDefinition.opcUa.port = Number(connectionDefinition.opcUa.port);
      }
    } else if (params.protocol === MachineProtocol.OSIPI) {
      connectionDefinition.osiPi = params.osiPi as OsiPiDefinition;
      connectionDefinition.osiPi.requestFrequency = Number(connectionDefinition.osiPi.requestFrequency);
      connectionDefinition.osiPi.catchupFrequency = Number(connectionDefinition.osiPi.catchupFrequency);
      connectionDefinition.osiPi.maxRequestDuration = Number(connectionDefinition.osiPi.maxRequestDuration);
      connectionDefinition.osiPi.queryOffset = Number(connectionDefinition.osiPi.queryOffset);
    } else if (params.protocol === MachineProtocol.MODBUSTCP) {
      connectionDefinition.modbusTcp = params.modbusTcp as ModbusTcpDefinition;
      connectionDefinition.modbusTcp.hostPort = Number(connectionDefinition.modbusTcp.hostPort);
      connectionDefinition.modbusTcp.modbusSlavesConfig = JSON.parse(
        connectionDefinition.modbusTcp.modbusSlavesConfigSerialized
      );
    }
  }

  return connectionDefinition;
}

// The initial connection
export const INIT_CONNECTION: GetConnectionResponse = {
  area: '',
  connectionName: '',
  greengrassCoreDeviceName: '',
  machineName: '',
  logLevel: 'INFO',
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
  osiPi: {
    apiUrl: '',
    serverName: '',
    authMode: OsiPiAuthMode.ANONYMOUS,
    verifySSL: true,
    username: '',
    password: '',
    tags: [],
    requestFrequency: 5,
    catchupFrequency: 0.1,
    maxRequestDuration: 60,
    queryOffset: 0
  },
  modbusTcp: {
    host: '',
    hostPort: 502,
    hostTag: '',
    modbusSlavesConfigSerialized: JSON.stringify(
      [
        {
          slaveAddress: 1,
          frequencyInSeconds: 30,
          commandConfig: {
            readCoils: {
              address: 1,
              count: 1
            },
            readDiscreteInputs: {
              address: 1
            },
            readHoldingRegisters: {
              address: 1
            },
            readInputRegisters: {
              address: 1
            }
          }
        }
      ],
      undefined,
      4
    ),
    modbusSlavesConfig: [
      {
        slaveAddress: 1,
        frequencyInSeconds: 30,
        commandConfig: {
          readCoils: {
            address: 1,
            count: 1
          },
          readDiscreteInputs: {
            address: 1
          },
          readHoldingRegisters: {
            address: 1
          },
          readInputRegisters: {
            address: 1
          }
        }
      }
    ]
  },
  process: '',
  protocol: MachineProtocol.OPCDA,
  sendDataToIoTSiteWise: false,
  sendDataToIoTTopic: false,
  sendDataToKinesisDataStreams: true,
  sendDataToTimestream: false,
  sendDataToHistorian: false,
  historianKinesisDatastreamName: '',
  siteName: '',
  opcDaListTags: '',
  opcDaTags: '',
  osiPiTags: ''
};

/**
 * Gets the error message from the error.
 * It follows Amplify API error structure first and go upper levels.
 * @param error The error to get the error message
 * @returns The error message or error object
 */
export function getErrorMessage(error: ErrorProps | unknown): unknown {
  const newError = error as ErrorProps;

  if (typeof newError.response?.data !== 'undefined') {
    const data = newError.response.data as ErrorMessage;

    if (typeof data.errorMessage !== 'undefined') {
      // When it's from M2C2 API, it returns `errorMessage`.
      return data.errorMessage;
    } else {
      // When it's the other Amplify API error, it returns response data.
      return newError.response.data;
    }
  } else if (newError.message) {
    return newError.message;
  }

  return error;
}

/**
 * Copies the original object and returns the deep copied object.
 * @param original The original object
 * @returns The deep copied object
 */
export function copyObject(original: Record<string, unknown>): Record<string, unknown> {
  if (typeof original !== 'object' || Array.isArray(original)) {
    throw Error('Invalid object');
  }

  const copiedObject: Record<string, unknown> = {};
  for (const key in original) {
    if (typeof original[key] === 'object' && !Array.isArray(original[key])) {
      copiedObject[key] = copyObject(original[key] as Record<string, unknown>);
    } else if (Array.isArray(original[key])) {
      copiedObject[key] = copyArray(original[key] as unknown[]);
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
export function copyArray(original: unknown[]): unknown[] {
  if (!Array.isArray(original)) {
    throw Error('Invalid array');
  }

  const copiedArray: unknown[] = [];

  for (const item of original) {
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

/**
 * Builds the tags.
 * @param value The value from the textarea
 * @returns The list of tags
 */
export function buildPerLineTags(value: string | undefined): string[] {
  const arr: string[] = [];

  if (typeof value === 'string' && value.trim() !== '') {
    const splitTags = value.split('\n');

    for (const tag of splitTags) {
      const trimTag = tag.trim();
      if (trimTag !== '') arr.push(trimTag);
    }
  }

  return arr;
}

/**
 * Sets the value of the object key.
 * @param obj The object to set the value
 * @param key The object key
 * @param value The new object value
 * @returns If the key exists, return `true`. Otherwise, return `false`.
 */
export function setValue(obj: Record<string, unknown>, key: string, value: unknown): boolean {
  if (typeof obj !== 'object' || Array.isArray(obj)) return false;

  if (Object.keys(obj).includes(key)) {
    if (
      typeof obj[key] === typeof value ||
      [
        'interval',
        'iterations',
        'requestFrequency',
        'catchupFrequency',
        'maxRequestDuration',
        'queryOffset',
        'hostPort'
      ].includes(key)
    ) {
      obj[key] = value;
      return true;
    }

    return false;
  }

  for (const childKey in obj) {
    if (setValue(obj[childKey] as Record<string, unknown>, key, value)) return true;
  }

  return false;
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
 * Gets a conditional value based on the condition.
 * @param condition The condition, it can be string, boolean, and so on
 * @param trueValue The value to return when the condition is true
 * @param falseValue The value to return when the condition is false
 * @returns The conditional value
 */
export function getConditionalValue<T>(condition: unknown, trueValue: T, falseValue: T): T {
  return condition ? trueValue : falseValue;
}

interface GetPaginationNextTokenRequest {
  pageIndex: number;
  pageToken: string[];
  paginationType?: PaginationType;
}

/**
 * Gets the pagination next token based on the pagination type.
 * @param props The getting pagination next token properties
 * @returns The pagination next token
 */
export function getPaginationNextToken(props: GetPaginationNextTokenRequest): string {
  const { pageIndex, pageToken, paginationType } = props;
  switch (paginationType) {
    case PaginationType.PREV:
      return pageToken[pageIndex - 1];
    case PaginationType.NEXT:
      return pageToken[pageIndex + 1];
    default:
      return '';
  }
}

interface HandlePaginationRequest extends Omit<GetPaginationNextTokenRequest, 'pageIndex'> {
  response: ListConnectionsResponse | ListGreengrassCoreDevicesResponse | ListLogsResponse;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  setPageToken: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Handles pagination.
 * @param props The handling pagination properties
 */
export function handlePagination(props: HandlePaginationRequest): void {
  const { pageToken, paginationType, response, setPageIndex, setPageToken } = props;
  switch (paginationType) {
    case PaginationType.PREV:
      setPageIndex(prevIndex => prevIndex - 1);
      break;
    case PaginationType.NEXT:
      /**
       * Due to inconsistency, it can't compare with the next index item.
       * Therefore, it checks if the page token array has the next token or not.
       */
      if (response.nextToken && !pageToken.includes(response.nextToken)) {
        setPageToken([...pageToken, response.nextToken]);
      }
      setPageIndex(prevIndex => prevIndex + 1);
      break;
    default:
      setPageIndex(0);
      setPageToken(getConditionalValue<string[]>(response.nextToken, ['', response.nextToken as string], ['']));
      break;
  }
}
