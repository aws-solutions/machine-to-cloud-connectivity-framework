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
  protocol: MachineProtocol.OPCDA,
  greengrassCoreDeviceName: 'mock-greengrass-core'
};
const errorMessage = 'An error occurred while deleting Greengrass v2 components.';
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
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockReset();
  mockGreengrassV2Handler.createDeployment.mockReset();
  mockGreengrassV2Handler.deleteComponent.mockReset();
  mockGreengrassV2Handler.getDeployment.mockReset();
  mockIoTHandler.publishIoTTopicMessage.mockReset();
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
  sendAnonymousMetricsSpy.mockReset();
  sleepSpy.mockReset();
});

test('Test success to delete OPC DA connection', async () => {
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.DELETE
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledWith({
    name: event.greengrassCoreDeviceName,
    increment: false
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.opcDaConnector, mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(2);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenNthCalledWith(1, mockValues.componentName.opcDaConnector);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenNthCalledWith(2, mockValues.componentName.publisher);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.JOB,
    data: {
      connectionName: event.connectionName,
      control: ConnectionControl.STOP
    }
  });
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    { EventType: event.control, protocol: event.protocol },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test failure to delete OPC DA connection due to deleting component failure', async () => {
  const error = new Error('Failure');

  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValue(undefined);
  mockGreengrassV2Handler.deleteComponent.mockRejectedValueOnce(error);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith('[greengrass-deployer]', `${errorMessage} Error: `, error);
  expect(mockDynamoDbHandler.deleteConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.DELETE
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.createDeployment).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledWith(mockValues.componentName.opcDaConnector);
  expect(mockGreengrassV2Handler.getDeployment).not.toHaveBeenCalled();
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(2);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    type: IoTMessageTypes.JOB,
    data: {
      connectionName: event.connectionName,
      control: ConnectionControl.STOP
    }
  });
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: errorMessage
    }
  });
  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  expect(sleepSpy).not.toHaveBeenCalled();
});

test('Test success to delete OPC UA connection when the connection is running', async () => {
  event.protocol = MachineProtocol.OPCUA;

  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      serverName: mockValues.opcUaServerName
    }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockResolvedValueOnce(undefined);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.DELETE
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledWith({
    name: event.greengrassCoreDeviceName,
    increment: false
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledWith(mockValues.componentName.publisher);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: mockValues.opcUaServerName
  });
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    { EventType: event.control, protocol: event.protocol },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test success to delete OPC UA connection when the connection is stopped', async () => {
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
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.DELETE
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledWith({
    name: event.greengrassCoreDeviceName,
    increment: false
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [mockValues.componentName.publisher],
    newComponents: [],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledWith(mockValues.componentName.publisher);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    { EventType: event.control, protocol: event.protocol },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test failure to delete OPC UA connection due to deleting gateway capability configuration source failure', async () => {
  const error = new LambdaError({
    message: `Failed to delete IoT SiteWise gateway capability configuration source for the name: ${mockValues.opcUaServerName}`,
    name: 'DeleteGatewayCapabilityConfigurationSourceError'
  });

  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    opcUa: { serverName: mockValues.opcUaServerName }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockRejectedValueOnce(error);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith('[greengrass-deployer]', `${errorMessage} Error: `, error);
  expect(mockDynamoDbHandler.deleteConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.DELETE
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.createDeployment).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.deleteComponent).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.getDeployment).not.toHaveBeenCalled();
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: error.message
    }
  });
  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  expect(sleepSpy).not.toHaveBeenCalled();
});
