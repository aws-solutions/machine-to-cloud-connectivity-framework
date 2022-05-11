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
import IoTSiteWiseHandler from '../../lib/aws-handlers/iot-sitewise-handler';
import { LambdaError } from '../../lib/errors';
import { IoTMessageTypes } from '../../lib/types/iot-handler-types';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';

const iotSiteWiseHandler = new IoTSiteWiseHandler();
const event: ConnectionDefinition = {
  connectionName: mockValues.connectionName,
  control: ConnectionControl.UPDATE,
  protocol: MachineProtocol.OPCDA,
  siteName: mockValues.siteName,
  area: mockValues.area,
  process: mockValues.process,
  machineName: mockValues.machineName,
  sendDataToIoTSiteWise: true,
  sendDataToIoTTopic: true,
  sendDataToKinesisDataStreams: true,
  sendDataToTimestream: true,
  opcDa: {
    interval: 5,
    iterations: 10,
    machineIp: mockValues.machineIp,
    serverName: mockValues.opcDaServerName,
    listTags: ['Random.*']
  },
  greengrassCoreDeviceName: 'mock-greengrass-core'
};
const opcDaComponent = {
  area: event.area,
  connectionName: event.connectionName,
  machineName: event.machineName,
  process: event.process,
  siteName: event.siteName,
  streamName: `m2c2_${event.connectionName}_stream`
};
const publisherComponent = {
  area: event.area,
  connectionName: event.connectionName,
  machineName: event.machineName,
  process: event.process,
  siteName: event.siteName,
  streamName: `m2c2_${event.connectionName}_stream`,
  sendDataToIoTTopic: 'Yes',
  sendDataToIoTSiteWise: 'Yes',
  sendDataToKinesisStreams: 'Yes',
  sendDataToTimestream: 'Yes'
};
const defaultSource = iotSiteWiseHandler.getDefaultSource({
  connectionName: event.connectionName,
  endpointUri: iotSiteWiseHandler.getEndpointUri('localhost'),
  name: mockValues.opcUaServerName
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
defaultSource.measurementDataStreamPrefix = 'mock' as any;
const getGreengrassCoreDevice = {
  iotSiteWiseGatewayId: 'mock-gateway-id',
  iotThingArn: 'arn:of:thing'
};

beforeEach(() => {
  consoleErrorSpy.mockReset();
  mockDynamoDbHandler.getConnection.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValue(getGreengrassCoreDevice);
  mockDynamoDbHandler.getOpcUaConnectionByServerName.mockReset();
  mockDynamoDbHandler.updateConnection.mockReset();
  mockGreengrassV2Handler.createDeployment.mockReset();
  mockGreengrassV2Handler.getDeployment.mockReset();
  mockIoTHandler.publishIoTTopicMessage.mockReset();
  mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockReset();
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
  mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration.mockReset();
  sendAnonymousMetricsSpy.mockReset();
  sleepSpy.mockReset();
});

test('Test success to update running OPC DA connection with list tags', async () => {
  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({ control: ConnectionControl.START });
  mockDynamoDbHandler.updateConnection.mockResolvedValue(undefined);
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValue(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(2);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    opcDa: event.opcDa,
    opcUa: undefined,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [],
    updatedComponents: {
      [`m2c2-${event.connectionName}`]: JSON.stringify({ connectionMetadata: opcDaComponent }),
      [`m2c2-${event.connectionName}-publisher`]: JSON.stringify({ connectionMetadata: publisherComponent })
    }
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
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
      numberOfTags: 0
    },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(3);
  expect(sleepSpy).toHaveBeenNthCalledWith(1, 5);
  expect(sleepSpy).toHaveBeenNthCalledWith(2, 30);
  expect(sleepSpy).toHaveBeenNthCalledWith(3, 3);
});

test('Test success to update stopped OPC DA connection with tags', async () => {
  delete event.opcDa.listTags;
  event.opcDa.tags = ['Random.String', 'Random.Int4'];
  event.sendDataToIoTSiteWise = false;
  event.sendDataToIoTTopic = false;
  event.sendDataToKinesisDataStreams = false;
  event.sendDataToTimestream = false;
  publisherComponent.sendDataToIoTSiteWise = '';
  publisherComponent.sendDataToIoTTopic = '';
  publisherComponent.sendDataToKinesisStreams = '';
  publisherComponent.sendDataToTimestream = '';

  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({ control: ConnectionControl.STOP });
  mockDynamoDbHandler.updateConnection.mockResolvedValue(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(2);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    control: ConnectionControl.STOP,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    opcDa: event.opcDa,
    opcUa: undefined,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [],
    updatedComponents: {
      [`m2c2-${event.connectionName}`]: JSON.stringify({ connectionMetadata: opcDaComponent }),
      [`m2c2-${event.connectionName}-publisher`]: JSON.stringify({ connectionMetadata: publisherComponent })
    }
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol,
      interval: event.opcDa.interval,
      iterations: event.opcDa.iterations,
      numberOfLists: 0,
      numberOfTags: event.opcDa.tags.length
    },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test success to update running OPC UA connection when current server name and new server name is same', async () => {
  delete event.opcDa;
  event.protocol = MachineProtocol.OPCUA;
  event.opcUa = {
    machineIp: mockValues.machineIp,
    serverName: mockValues.opcUaServerName
  };
  event.sendDataToIoTSiteWise = true;
  event.sendDataToIoTTopic = false;
  event.sendDataToKinesisDataStreams = true;
  event.sendDataToTimestream = false;
  publisherComponent.sendDataToIoTSiteWise = 'Yes';
  publisherComponent.sendDataToIoTTopic = '';
  publisherComponent.sendDataToKinesisStreams = 'Yes';
  publisherComponent.sendDataToTimestream = '';

  const newSourceConfiguration = { ...defaultSource };
  newSourceConfiguration.endpoint.endpointUri = iotSiteWiseHandler.getEndpointUri(event.opcUa.machineIp);
  newSourceConfiguration.name = event.opcUa.serverName;

  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: mockValues.connectionName,
    control: ConnectionControl.START,
    opcUa: {
      machineIp: 'localhost',
      serverName: defaultSource.name
    }
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValue(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration.mockResolvedValue(undefined);
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockResolvedValue(undefined);
  mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockResolvedValue(defaultSource);
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(3);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE,
    opcUa: {
      ...event.opcUa,
      serverName: event.opcUa.serverName
    }
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(3, {
    connectionName: event.connectionName,
    control: ConnectionControl.START,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    opcDa: undefined,
    opcUa: event.opcUa,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [],
    updatedComponents: {
      [`m2c2-${event.connectionName}-publisher`]: JSON.stringify({ connectionMetadata: publisherComponent })
    }
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledWith({
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    source: newSourceConfiguration
  });
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: event.opcUa.serverName
  });
  expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledTimes(1);
  expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledWith({
    gatewayId: getGreengrassCoreDevice.iotSiteWiseGatewayId,
    serverName: defaultSource.name
  });
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol
    },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test success to update stopped OPC UA connection when current server name and new server name is different', async () => {
  event.opcUa.serverName = 'new-server-name';

  const newSourceConfiguration = { ...defaultSource };
  newSourceConfiguration.endpoint.endpointUri = iotSiteWiseHandler.getEndpointUri(event.opcUa.machineIp);
  newSourceConfiguration.name = event.opcUa.serverName;

  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: mockValues.connectionName,
    control: ConnectionControl.STOP,
    opcUa: {
      machineIp: 'localhost',
      serverName: defaultSource.name,
      source: {
        ...defaultSource
      }
    }
  });
  mockDynamoDbHandler.getOpcUaConnectionByServerName.mockResolvedValueOnce({});
  mockDynamoDbHandler.updateConnection.mockResolvedValue(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledWith(event.opcUa.serverName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(3);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE,
    opcUa: {
      ...event.opcUa,
      serverName: event.opcUa.serverName,
      source: newSourceConfiguration
    }
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(3, {
    connectionName: event.connectionName,
    control: ConnectionControl.STOP,
    area: event.area,
    greengrassCoreDeviceName: event.greengrassCoreDeviceName,
    machineName: event.machineName,
    opcDa: undefined,
    opcUa: event.opcUa,
    process: event.process,
    sendDataToIoTSiteWise: event.sendDataToIoTSiteWise,
    sendDataToIoTTopic: event.sendDataToIoTTopic,
    sendDataToKinesisDataStreams: event.sendDataToKinesisDataStreams,
    sendDataToTimestream: event.sendDataToTimestream,
    siteName: event.siteName
  });
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.createDeployment).toHaveBeenCalledWith({
    iotThingArn: getGreengrassCoreDevice.iotThingArn,
    deletedComponents: [],
    newComponents: [],
    updatedComponents: {
      [`m2c2-${event.connectionName}-publisher`]: JSON.stringify({ connectionMetadata: publisherComponent })
    }
  });
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledTimes(1);
  expect(mockGreengrassV2Handler.getDeployment).toHaveBeenCalledWith(mockValues.deploymentId);
  expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
  expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
    {
      EventType: event.control,
      protocol: event.protocol
    },
    process.env.SOLUTION_UUID
  );
  expect(sleepSpy).toHaveBeenCalledTimes(1);
  expect(sleepSpy).toHaveBeenCalledWith(5);
});

test('Test failure to update OPC UA connection due to duplicated server name', async () => {
  const newSourceConfiguration = { ...defaultSource };
  newSourceConfiguration.endpoint.endpointUri = iotSiteWiseHandler.getEndpointUri(event.opcUa.machineIp);
  newSourceConfiguration.name = event.opcUa.serverName;
  const errorMessage = `The server name should be unique. The server name is already used by the other connection: ${event.opcUa.serverName}`;

  mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
    connectionName: mockValues.connectionName,
    control: ConnectionControl.STOP,
    opcUa: {
      machineIp: 'localhost',
      serverName: defaultSource.name,
      source: {
        ...defaultSource
      }
    }
  });
  mockDynamoDbHandler.getOpcUaConnectionByServerName.mockResolvedValueOnce({
    connectionName: 'duplicated-server-name'
  });
  mockDynamoDbHandler.updateConnection.mockResolvedValue(undefined);
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: errorMessage,
      name: 'DuplicatedServerNameError',
      statusCode: 400
    })
  );

  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith('[greengrass-deployer]', errorMessage);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(event.connectionName);
  expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledWith(event.opcUa.serverName);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(2);
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(1, {
    connectionName: event.connectionName,
    control: ConnectionControl.UPDATE
  });
  expect(mockDynamoDbHandler.updateConnection).toHaveBeenNthCalledWith(2, {
    connectionName: event.connectionName,
    control: ConnectionControl.STOP
  });
  expect(mockGreengrassV2Handler.createDeployment).not.toHaveBeenCalled();
  expect(mockGreengrassV2Handler.getDeployment).not.toHaveBeenCalled();
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
  expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
    connectionName: event.connectionName,
    type: IoTMessageTypes.ERROR,
    data: {
      error: errorMessage
    }
  });
  expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
  expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  expect(sleepSpy).not.toHaveBeenCalled();
});
