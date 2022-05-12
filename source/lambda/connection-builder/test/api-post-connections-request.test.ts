// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  consoleErrorSpy,
  mockDynamoDbHandler,
  mockIoTHandler,
  mockIoTSiteWiseHandler,
  mockLambdaHandler,
  mockValue,
  sendAnonymousMetricsSpy
} from './mock';
import { LambdaError } from '../../lib/errors';
import { IoTMessageTypes } from '../../lib/types/iot-handler-types';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';
import { ValidationsLimit } from '../../lib/validations';
import { handler } from '../index';

describe('Unit tests of POST /connections', () => {
  const body: ConnectionDefinition = {
    connectionName: 'mock-connection-name',
    control: ConnectionControl.DEPLOY,
    protocol: MachineProtocol.OPCDA,
    siteName: 'mock-site',
    area: 'mock-area',
    process: 'mock-process',
    machineName: 'mock-machine',
    sendDataToIoTSiteWise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    opcDa: {
      serverName: 'mock-server-name',
      machineIp: '10.10.10.10',
      interval: 1,
      iterations: 1,
      tags: ['tag']
    },
    greengrassCoreDeviceName: 'mock-greengrass-core'
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    body: JSON.stringify({}),
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/connections',
    resource: '/connections'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getConnection.mockReset();
    mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
    mockLambdaHandler.invokeGreengrassDeployer.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test failure to validate', async () => {
    const error = new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).not.toHaveBeenCalled();
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to deploy a connection', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(error);
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({});
    mockLambdaHandler.invokeGreengrassDeployer.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to request to ${body.control} the connection: ${body.connectionName}. It takes time since it's running in the background.`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.greengrassCoreDeviceName);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledTimes(1);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledWith(body);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to deploy due to the existing connection', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` already exists.`,
      name: 'ConnectionBuilderError',
      statusCode: 409
    });
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({ connectionName: body.connectionName });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
  });

  test('Test failure to deploy due to not existing Greengrass core device', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    const greengrassCoreDeviceNotFoundError = new LambdaError({
      message: 'Greengrass core device for the connection might not exist.',
      name: 'ConnectionBuilderError',
      statusCode: 400
    });
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(error);
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockLambdaHandler.invokeGreengrassDeployer.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 400,
      body: JSON.stringify({
        errorMessage: greengrassCoreDeviceNotFoundError.message
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.greengrassCoreDeviceName);
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      greengrassCoreDeviceNotFoundError.message
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'Error occurred: ',
      greengrassCoreDeviceNotFoundError
    );
  });

  test('Test failure to deploy due to invoking Greengrass deployer failure', async () => {
    const connectionNotFoundError = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    const error = new LambdaError({
      message: `Failed to ${body.control} the connection.`,
      name: 'LambdaHandlerError'
    });
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(connectionNotFoundError);
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({});
    mockLambdaHandler.invokeGreengrassDeployer.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.greengrassCoreDeviceName);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledTimes(1);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledWith(body);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to delete a connection', async () => {
    body.control = ConnectionControl.DELETE;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName: body.greengrassCoreDeviceName
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({});
    mockLambdaHandler.invokeGreengrassDeployer.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to request to ${body.control} the connection: ${body.connectionName}. It takes time since it's running in the background.`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.greengrassCoreDeviceName);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledTimes(1);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledWith(body);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to delete due to the connection not found', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to update a connection', async () => {
    body.control = ConnectionControl.UPDATE;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName: body.greengrassCoreDeviceName
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({});
    mockLambdaHandler.invokeGreengrassDeployer.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to request to ${body.control} the connection: ${body.connectionName}. It takes time since it's running in the background.`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.greengrassCoreDeviceName);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledTimes(1);
    expect(mockLambdaHandler.invokeGreengrassDeployer).toHaveBeenCalledWith(body);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to update due to the connection not found', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
  });

  test('Test failure to update due to the other error', async () => {
    event.body = '{';

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getConnection).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockLambdaHandler.invokeGreengrassDeployer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[connection-builder]',
      'Error occurred: ',
      SyntaxError('Unexpected end of JSON input')
    );
  });
});

describe('Unit tests of OPC DA connection controls', () => {
  const body: ConnectionDefinition = {
    connectionName: 'mock-connection',
    control: ConnectionControl.START,
    protocol: MachineProtocol.OPCDA
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    body: JSON.stringify(body),
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/connections',
    resource: '/connections'
  };
  const opcDa = { mock: 'opc-da-mock-data' };
  const greengrassCoreDeviceName = 'mock-greengrass-core';

  beforeEach(() => {
    mockDynamoDbHandler.getConnection.mockReset();
    mockDynamoDbHandler.updateConnection.mockReset();
    mockIoTHandler.publishIoTTopicMessage.mockReset();
    sendAnonymousMetricsSpy.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to start a connection', async () => {
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      control: body.control
    });
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to start a connection due to getting a connection failure', async () => {
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({
        errorMessage: `An error occurred while processing the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      Error('Failure')
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'Error occurred: ',
      new LambdaError({
        message: `An error occurred while processing the connection: ${body.connectionName}`,
        name: 'ConnectionBuilderError',
        statusCode: 500
      })
    );
  });

  test('Test success to stop a connection', async () => {
    body.control = ConnectionControl.STOP;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      control: body.control
    });
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to stop a connection due to updating the connection failure', async () => {
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockDynamoDbHandler.updateConnection.mockRejectedValueOnce(Error('Failure'));
    mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({
        errorMessage: `An error occurred while processing the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      control: body.control
    });
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      Error('Failure')
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'Error occurred: ',
      new LambdaError({
        message: `An error occurred while processing the connection: ${body.connectionName}`,
        name: 'ConnectionBuilderError',
        statusCode: 500
      })
    );
  });

  test('Test success to check the connection connectivity', async () => {
    body.control = ConnectionControl.PUSH;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to check the connection connectivity due to the connection not found', async () => {
    const error = new LambdaError({
      message: `\`${body.connectionName}\` does not exist.`,
      name: 'DynamoDBHandlerError',
      statusCode: 404
    });
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      error
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to get the connection configuration', async () => {
    body.control = ConnectionControl.PULL;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get the connection configuration due to publishing IoT topic message failure', async () => {
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcDa
    });
    mockIoTHandler.publishIoTTopicMessage.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({
        errorMessage: `An error occurred while processing the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.JOB,
      data: { ...body, greengrassCoreDeviceName, opcDa }
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      Error('Failure')
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'Error occurred: ',
      new LambdaError({
        message: `An error occurred while processing the connection: ${body.connectionName}`,
        name: 'ConnectionBuilderError',
        statusCode: 500
      })
    );
  });
});

describe('Unit tests of OPC UA connection controls', () => {
  const body: ConnectionDefinition = {
    connectionName: 'mock-connection',
    control: ConnectionControl.START,
    protocol: MachineProtocol.OPCUA
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    body: JSON.stringify(body),
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/connections',
    resource: '/connections'
  };
  const opcUa = { serverName: 'mock-server-name', mock: 'opc-ua-mock-data', source: 'opc-ua-mock-source' };
  const greengrassCoreDeviceName = 'mock-greengrass-core-device';
  const iotSiteWiseGatewayId = 'mock-sitewise-id';

  beforeEach(() => {
    mockDynamoDbHandler.getConnection.mockReset();
    mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
    mockDynamoDbHandler.updateConnection.mockReset();
    mockIoTHandler.publishIoTTopicMessage.mockReset();
    mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration.mockReset();
    mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
    mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockReset();
    sendAnonymousMetricsSpy.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to start a connection', async () => {
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      control: body.control,
      opcUa: { serverName: 'mock-server-name', mock: 'opc-ua-mock-data' }
    });
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      source: opcUa.source
    });
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to start a connection due to adding existing source to gateway capability configuration failure', async () => {
    const error = new LambdaError({
      message: 'Failed to add IoT SiteWise gateway capability configuration',
      name: 'AddExistingSourceToGatewayCapabilityConfigurationError'
    });
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      source: opcUa.source
    });
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      error
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to stop a connection', async () => {
    body.control = ConnectionControl.STOP;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockResolvedValueOnce(opcUa.source);
    mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.updateConnection).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      control: body.control,
      opcUa
    });
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to stop a connection due to deleting capability configuration source', async () => {
    const error = new LambdaError({
      message: `Failed to delete IoT SiteWise gateway capability configuration source for the name: ${opcUa.serverName}`,
      name: 'DeleteGatewayCapabilityConfigurationSourceError'
    });
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
    mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockResolvedValueOnce(opcUa.source);
    mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      error
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to check the connection connectivity', async () => {
    body.control = ConnectionControl.PUSH;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockResolvedValueOnce(opcUa.source);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.INFO,
      data: { connectivityConfiguration: opcUa.source }
    });
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to check the connection connectivity due to getting gateway capability configuration source by the server name', async () => {
    const error = new LambdaError({
      message: `Failed to get IoT SiteWise gateway capability configuration source for the name: ${opcUa.serverName}`,
      name: 'GetGatewayCapabilityConfigurationSourceByServerNameError'
    });
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName.mockRejectedValueOnce(error);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).toHaveBeenCalledWith({
      gatewayId: iotSiteWiseGatewayId,
      serverName: opcUa.serverName
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      `Error to process connection [${body.connectionName}] to [${body.control}]: `,
      error
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[connection-builder]', 'Error occurred: ', error);
  });

  test('Test success to get the connection configuration', async () => {
    body.control = ConnectionControl.PULL;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.INFO,
      data: {
        serverName: opcUa.serverName,
        mock: opcUa.mock
      }
    });
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      { EventType: body.control, protocol: body.protocol },
      process.env.SOLUTION_UUID
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test not sending anonymous metric', async () => {
    delete process.env.SEND_ANONYMOUS_METRIC;
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({
      connectionName: body.connectionName,
      greengrassCoreDeviceName,
      opcUa: { ...opcUa }
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({ iotSiteWiseGatewayId });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connectionName: body.connectionName,
        control: body.control,
        message: `Success to ${body.control} the connection: ${body.connectionName}`
      })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(body.connectionName);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(greengrassCoreDeviceName);
    expect(mockDynamoDbHandler.updateConnection).not.toHaveBeenCalled();
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.publishIoTTopicMessage).toHaveBeenCalledWith({
      connectionName: body.connectionName,
      type: IoTMessageTypes.INFO,
      data: {
        serverName: opcUa.serverName,
        mock: opcUa.mock
      }
    });
    expect(mockIoTSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
