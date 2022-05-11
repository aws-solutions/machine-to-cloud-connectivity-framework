// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CreatedBy } from '../../lib/types/dynamodb-handler-types';
import * as utils from '../../lib/utils';

export const mockDynamoDbHandler = {
  addGreengrassCoreDevice: jest.fn(),
  deleteGreengrassCoreDevice: jest.fn(),
  getConnection: jest.fn(),
  getConnections: jest.fn(),
  getGreengrassCoreDevice: jest.fn(),
  getGreengrassCoreDevices: jest.fn(),
  getLogs: jest.fn(),
  getLogsByConnection: jest.fn(),
  getOpcUaConnectionByServerName: jest.fn(),
  updateConnection: jest.fn()
};
jest.mock('../../lib/aws-handlers/dynamodb-handler', () => jest.fn(() => ({ ...mockDynamoDbHandler })));

export const mockGreengrassV2Handler = {
  deleteGreengrassCoreDevice: jest.fn(),
  listGreengrassCoreDevices: jest.fn()
};
jest.mock('../../lib/aws-handlers/greengrass-v2-handler', () => jest.fn(() => ({ ...mockGreengrassV2Handler })));

export const mockIoTHandler = {
  attachThingPrincipal: jest.fn(),
  createThing: jest.fn(),
  deleteThing: jest.fn(),
  detachThingPrincipal: jest.fn(),
  getThing: jest.fn(),
  publishIoTTopicMessage: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-handler', () => jest.fn(() => ({ ...mockIoTHandler })));

export const mockIoTSiteWiseHandler = {
  addExistingSourceToGatewayCapabilityConfiguration: jest.fn(),
  createGreengrassV2Gateway: jest.fn(),
  deleteGatewayCapabilityConfigurationSource: jest.fn(),
  deleteGreengrassV2Gateway: jest.fn(),
  getGatewayCapabilityConfigurationSourceByServerName: jest.fn(),
  listGreengrassV2Gateways: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-sitewise-handler', () => jest.fn(() => ({ ...mockIoTSiteWiseHandler })));

export const mockLambdaHandler = {
  invokeGreengrassDeployer: jest.fn()
};
jest.mock('../../lib/aws-handlers/lambda-handler', () => jest.fn(() => ({ ...mockLambdaHandler })));

export const mockS3Handler = {
  deleteObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn()
};
jest.mock('../../lib/aws-handlers/s3-handler', () => jest.fn(() => ({ ...mockS3Handler })));

export const sendAnonymousMetricsSpy = jest.spyOn(utils, 'sendAnonymousMetric');
export const consoleErrorSpy = jest.spyOn(console, 'error');
export const mockValue = {
  headers: {
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Access-Control-Allow-Origin': '*'
  },
  dynamoDbGreengrassCoreDevice: {
    name: 'mock-greengrass-core',
    createdBy: CreatedBy.SYSTEM,
    numberOfConnections: 0,
    iotSiteWiseGatewayId: 'mock-sitewise-id',
    iotThingArn: 'arn:of:iot:thing'
  },
  greengrassGreengrassCoreDevice: {
    coreDeviceThingName: 'mock-greengrass-core',
    status: 'HEALTH'
  },
  iotThingArn: 'arn:of:iot:thing',
  s3Body: 'THING_NAME_PLACEHOLDER',
  iotSiteWiseGateways: [
    { gatewayId: 'mock-gateway-id', coreDeviceThingName: 'mock-greengrass' },
    { gatewayId: 'mock-gateway-other-id', coreDeviceThingName: 'mock-greengrass-other' }
  ]
};
