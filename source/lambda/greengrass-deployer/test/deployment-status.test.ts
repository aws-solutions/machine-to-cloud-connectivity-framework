// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  consoleErrorSpy,
  mockDynamoDbHandler,
  mockGreengrassV2Handler,
  mockIoTHandler,
  mockIoTSiteWiseHandler,
  mockValues,
  sendAnonymousMetricsSpy,
  sleepSpy
} from './mock';
import { handler } from '../index';
import { LambdaError } from '../../lib/errors';
import { IoTMessageTypes } from '../../lib/types/iot-handler-types';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';

const event: ConnectionDefinition = {
  connectionName: mockValues.connectionName,
  control: ConnectionControl.DELETE,
  protocol: MachineProtocol.OPCUA,
  greengrassCoreDeviceName: 'mock-greengrass-core'
};
const errorMessage = 'The greengrass deployment has been canceled or failed.';
const getGreengrassCoreDevice = {
  iotSiteWiseGatewayId: 'mock-gateway-id',
  iotThingArn: 'arn:of:thing'
};

beforeEach(() => {
  consoleErrorSpy.mockReset();
  mockDynamoDbHandler.deleteConnection.mockReset();
  mockDynamoDbHandler.getConnection.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValue(getGreengrassCoreDevice);
  mockDynamoDbHandler.updateConnection.mockReset();
  mockGreengrassV2Handler.createDeployment.mockReset();
  mockGreengrassV2Handler.deleteComponent.mockReset();
  mockGreengrassV2Handler.getDeployment.mockReset();
  mockIoTHandler.publishIoTTopicMessage.mockReset();
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
  sendAnonymousMetricsSpy.mockReset();
  sleepSpy.mockReset();
});

test('Test when deployment status changes from ACTIVE to COMPLETED', async () => {
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    control: ConnectionControl.STOP,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      serverName: mockValues.opcUaServerName
    }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment
    .mockResolvedValueOnce({ deploymentStatus: 'ACTIVE' })
    .mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(2);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenNthCalledWith(1, mockValues.deploymentId);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenNthCalledWith(2, mockValues.deploymentId);
  expect(sleepSpy).toHaveBeenCalledTimes(2);
  expect(sleepSpy).toHaveBeenNthCalledWith(1, 5);
  expect(sleepSpy).toHaveBeenNthCalledWith(2, 5);
});

test('Test when deployment status is CANCELED', async () => {
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    control: ConnectionControl.STOP,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      serverName: mockValues.opcUaServerName
    }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'CANCELED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: errorMessage
    }
  });
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test when deployment status is FAILED', async () => {
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    control: ConnectionControl.STOP,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      serverName: mockValues.opcUaServerName
    }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'FAILED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: errorMessage
    }
  });
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});
