// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CapabilityConfigurationSource, GetDefaultSourceRequest } from '../../lib/types/iot-sitewise-handler-types';
import * as utils from '../../lib/utils';

export const mockValues = {
  area: 'area',
  componentName: {
    opcDaConnector: 'm2c2-mock-connection',
    publisher: 'm2c2-mock-connection-publisher'
  },
  connectionName: 'mock-connection',
  deploymentId: 'mock-deployment-id',
  machineIp: '127.0.0.1',
  machineName: 'machine',
  logLevel: undefined,
  opcDaServerName: 'mock-opcda-server',
  opcUaServerName: 'mock-opcua-server',
  process: 'process',
  siteName: 'site'
};

export const mockDynamoDbHandler = {
  addConnection: jest.fn(),
  deleteConnection: jest.fn(),
  getConnection: jest.fn(),
  getGreengrassCoreDevice: jest.fn(),
  getOpcUaConnectionByServerName: jest.fn(),
  updateConnection: jest.fn(),
  updateGreengrassCoreDevice: jest.fn()
};
jest.mock('../../lib/aws-handlers/dynamodb-handler', () => jest.fn(() => ({ ...mockDynamoDbHandler })));

export const mockGreengrassV2Handler = {
  createComponent: jest.fn(),
  createDeployment: jest.fn(),
  deleteComponent: jest.fn(),
  getDeployment: jest.fn()
};
jest.mock('../../lib/aws-handlers/greengrass-v2-handler', () => jest.fn(() => ({ ...mockGreengrassV2Handler })));

export const mockIoTHandler = {
  publishIoTTopicMessage: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-handler', () => jest.fn(() => ({ ...mockIoTHandler })));

export const mockIoTSiteWiseHandler = {
  addExistingSourceToGatewayCapabilityConfiguration: jest.fn(),
  addGatewayCapabilityConfigurationSource: jest.fn(),
  deleteGatewayCapabilityConfigurationSource: jest.fn(),
  getGatewayCapabilityConfigurationSourceByServerName: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-sitewise-handler', () =>
  jest.fn(() => ({
    ...mockIoTSiteWiseHandler,
    getDefaultSource: (params: GetDefaultSourceRequest): CapabilityConfigurationSource => {
      const { connectionName, endpointUri, name } = params;
      return {
        name,
        endpoint: {
          certificateTrust: {
            type: 'TrustAny'
          },
          endpointUri,
          securityPolicy: 'NONE',
          messageSecurityMode: 'NONE',
          identityProvider: {
            type: 'Anonymous'
          },
          nodeFilterRules: [
            {
              action: 'INCLUDE',
              definition: {
                type: 'OpcUaRootPath',
                rootPath: '/'
              }
            }
          ]
        },
        measurementDataStreamPrefix: '',
        destination: {
          type: 'StreamManager',
          streamName: `m2c2_${connectionName}_stream`,
          streamBufferSize: 10
        }
      };
    },
    getEndpointUri: (machineIp: string) => `opc.tcp://${machineIp}`
  }))
);

export const sendAnonymousMetricsSpy = jest.spyOn(utils, 'sendAnonymousMetric');
export const sleepSpy = jest.spyOn(utils, 'sleep');
export const consoleErrorSpy = jest.spyOn(console, 'error');
