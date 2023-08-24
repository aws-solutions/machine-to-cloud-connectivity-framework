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
import { ComponentType } from '../../lib/types/greengrass-v2-handler-types';
import { IoTMessageTypes } from '../../lib/types/iot-handler-types';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';

const event: ConnectionDefinition = {
  connectionName: mockValues.connectionName,
  control: ConnectionControl.DEPLOY,
  protocol: MachineProtocol.OPCDA,
  siteName: mockValues.siteName,
  area: mockValues.area,
  process: mockValues.process,
  machineName: mockValues.machineName,
  logLevel: mockValues.logLevel,
  sendDataToIoTSiteWise: false,
  sendDataToIoTTopic: true,
  sendDataToKinesisDataStreams: false,
  sendDataToTimestream: false,
  sendDataToHistorian: false,
  opcDa: {
    interval: 5,
    iterations: 10,
    machineIp: mockValues.machineIp,
    serverName: mockValues.opcDaServerName,
    listTags: ['Random.*'],
    tags: ['Random.String']
  },
  greengrassCoreDeviceName: 'mock-greengrass-core'
};
const errorMessage = 'An error occurred while creating Greengrass v2 components.';
const getGreengrassCoreDevice = {
  iotSiteWiseGatewayId: 'mock-gateway-id',
  iotThingArn: 'arn:of:thing'
};

beforeEach(() => {
  consoleErrorSpy.mockReset();
  mockDynamoDbHandler.addConnection.mockReset();
  mockDynamoDbHandler.deleteConnection.mockReset();
  mockDynamoDbHandler.getConnection.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValue(getGreengrassCoreDevice);
  mockDynamoDbHandler.updateConnection.mockReset();
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockReset();
  mockGreengrassV2Handler.createComponent.mockReset();
  mockGreengrassV2Handler.createDeployment.mockReset();
  mockGreengrassV2Handler.deleteComponent.mockReset();
  mockGreengrassV2Handler.getDeployment.mockReset();
  mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource.mockReset();
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
  mockIoTHandler.publishIoTTopicMessage.mockReset();
  sendAnonymousMetricsSpy.mockReset();
  sleepSpy.mockReset();
});

test('Test success to deploy OPC DA connection with list tags and tags', async () => {
  mockDynamoDbHandler.addConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createComponent
    .mockResolvedValueOnce({ componentName: mockValues.componentName.opcDaConnector })
    .mockResolvedValueOnce({ componentName: mockValues.componentName.publisher });
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledWith(event);
  expect(mockDynamoDbHandler.deleteConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    logLevel: event.logLevel,
    opcDa: event.opcDa,
    opcUa: undefined,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    sendDataToHistorian: event.sendDataToHistorian,
    siteName: event.siteName
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledWith({
    name: event.greengrassCoreDeviceName,
    increment: true
  });
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenCalledTimes(2);
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenNthCalledWith(1, {
    area: event.area,
    componentType: ComponentType.COLLECTOR,
    connectionName: event.connectionName,
    machineName: event.machineName,
    process: event.process,
    logLevel: event.logLevel,
    siteName: event.siteName,
    protocol: event.protocol
  });
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenNthCalledWith(2, {
    area: event.area,
    componentType: ComponentType.PUBLISHER,
    connectionName: event.connectionName,
    machineName: event.machineName,
    process: event.process,
    logLevel: event.logLevel,
    protocol: event.protocol,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    sendDataToHistorian: event.sendDataToHistorian,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [mockValues.componentName.opcDaConnector, mockValues.componentName.publisher],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.deleteComponent).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.JOB,
    data: {
      ...event,
      control: ConnectionControl.START
    }
  });
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol,
      interval: event.opcDa.interval,
      iterations: event.opcDa.iterations,
      numberOfLists: event.opcDa.listTags.length,
      numberOfTags: event.opcDa.tags.length
    },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(2);
  expect(sleepSpy).toHaveBeenNthCalledWith(1, 5);
  expect(sleepSpy).toHaveBeenNthCalledWith(2, 30);
}, 60000);

test('Test success to deploy OPC DA connection without list tags and tags', async () => {
  // This would happen in the real world because of validation checks. This is only for more coverage.
  delete event.opcDa.listTags;
  delete event.opcDa.tags;

  mockDynamoDbHandler.addConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createComponent
    .mockResolvedValueOnce({ componentName: mockValues.componentName.opcDaConnector })
    .mockResolvedValueOnce({ componentName: mockValues.componentName.publisher });
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol,
      interval: event.opcDa.interval,
      iterations: event.opcDa.iterations,
      numberOfLists: 0,
      numberOfTags: 0
    },
    process.env.SOLUTION_UUID
  );
}, 60000);

test('Test failure to deploy OPC DA connection due to creating component failure', async () => {
  const error = new Error('Failure');
  mockDynamoDbHandler.addConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createComponent.mockRejectedValueOnce(error);
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValue(undefined);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[greengrass-deployer]', `${errorMessage} Error: `, error);
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[greengrass-deployer]', 'Trying to roll back...');
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledWith(event);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenCalledWith({
    area: event.area,
    componentType: ComponentType.COLLECTOR,
    connectionName: event.connectionName,
    machineName: event.machineName,
    logLevel: event.logLevel,
    process: event.process,
    siteName: event.siteName,
    protocol: event.protocol
  });
  expect(mockGreengrassV2Handler.createDeployment).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(2);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenNthCalledWith(1, mockValues.componentName.opcDaConnector);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenNthCalledWith(2, mockValues.componentName.publisher);
  expect(mockGreengrassV2Handler.getDeployment).not.toHaveBeenCalled();
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(2);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: errorMessage
    }
  });
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    type: IoTMessageTypes.JOB,
    data: {
      connectionName: event.connectionName,
      control: ConnectionControl.STOP
    }
  });
  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  expect(sleepSpy).not.toHaveBeenCalled();
});

test('Test success to deploy OPC UA connection', async () => {
  delete event.opcDa;
  event.opcUa = {
    machineIp: mockValues.machineIp,
    serverName: mockValues.opcUaServerName
  };
  event.protocol = MachineProtocol.OPCUA;

  mockDynamoDbHandler.addConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateGreengrassCoreDevice.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createComponent.mockResolvedValueOnce({ componentName: mockValues.componentName.publisher });
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource.mockResolvedValueOnce(undefined);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledWith(event);
  expect(mockDynamoDbHandler.deleteConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    logLevel: event.logLevel,
    opcDa: undefined,
    opcUa: event.opcUa,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    sendDataToHistorian: event.sendDataToHistorian,
    siteName: event.siteName
  });
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledWith({
    name: event.greengrassCoreDeviceName,
    increment: true
  });
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createComponent).toHaveBeenCalledWith({
    area: event.area,
    componentType: ComponentType.PUBLISHER,
    connectionName: event.connectionName,
    machineName: event.machineName,
    process: event.process,
    logLevel: event.logLevel,
    protocol: event.protocol,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    sendDataToHistorian: event.sendDataToHistorian,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [mockValues.componentName.publisher],
    updatedComponents: {},
    secretManagement: []
  });
  expect(mockGreengrassV2Handler.deleteComponent).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: event.opcUa.serverName,
    machineIp: event.opcUa.machineIp,
    port: event.opcUa.port
  });
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol
    },
    process.env.SOLUTION_UUID
  );
});

test('Test failure to create OPC UA connection due to adding gateway capability configuration source failure', async () => {
  const error = new LambdaError({
    message: `Failed to add IoT SiteWise gateway capability configuration source for the connection: ${event.connectionName}`,
    name: 'AddGatewayCapabilityConfigurationSourceError'
  });

  mockDynamoDbHandler.addConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      serverName: mockValues.opcUaServerName
    }
  });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource.mockRejectedValueOnce(error);
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockResolvedValueOnce(undefined);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'GreengrassDeployerError'
    })
  );

  expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[greengrass-deployer]', `${errorMessage} Error: `, error);
  expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[greengrass-deployer]', 'Trying to roll back...');
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.addConnection).toHaveBeenCalledWith(event);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.deleteConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createComponent).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.createDeployment).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.deleteComponent).toHaveBeenCalledWith(mockValues.componentName.publisher);
  expect(mockGreengrassV2Handler.getDeployment).not.toHaveBeenCalled();
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: error.message
    }
  });
  expect(mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.addGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: event.opcUa.serverName,
    machineIp: event.opcUa.machineIp,
    port: event.opcUa.port
  });
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: event.opcUa.serverName
  });
  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
});
