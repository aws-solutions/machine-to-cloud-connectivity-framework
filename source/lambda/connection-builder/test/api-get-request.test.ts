// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, mockDynamoDbHandler, mockGreengrassV2Handler, mockValue } from './mock';
import { handler } from '../index';

describe('Unit tests of GET /connections', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/connections',
    resource: '/connections'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getConnections.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get connections', async () => {
    mockDynamoDbHandler.getConnections.mockResolvedValueOnce({ connections: [] });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ connections: [] })
    });
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get connections with next token', async () => {
    event.queryStringParameters = {
      nextToken: encodeURI(JSON.stringify({ connectionName: 'mock-next-token-connection-name' }))
    };
    mockDynamoDbHandler.getConnections.mockResolvedValueOnce({
      connections: [{ connectionName: 'mock-connection-name' }],
      nextToken: encodeURI(JSON.stringify({ connectionName: 'mock-connection-name' }))
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        connections: [{ connectionName: 'mock-connection-name' }],
        nextToken: encodeURI(JSON.stringify({ connectionName: 'mock-connection-name' }))
      })
    });
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledWith(
      encodeURI(JSON.stringify({ connectionName: 'mock-next-token-connection-name' }))
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get connections', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getConnections.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnections).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /connections/{connectionName}', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/connections/mock-connection-name',
    pathParameters: { connectionName: 'mock-connection-name' },
    resource: '/connections/{connectionName}'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getConnection.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get a connection detail', async () => {
    mockDynamoDbHandler.getConnection.mockResolvedValueOnce({ connectionName: 'mock-connection-name' });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ connectionName: 'mock-connection-name' })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.connectionName)
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get a connection detail', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getConnection.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getConnection).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.connectionName)
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /sitewise/{serverName}', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/sitewise/mock-server-name',
    pathParameters: { serverName: 'mock-server-name' },
    resource: '/sitewise/{serverName}'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getOpcUaConnectionByServerName.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get a connection with the server name', async () => {
    mockDynamoDbHandler.getOpcUaConnectionByServerName.mockResolvedValueOnce({
      connectionName: 'mock-connection-name'
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ connectionName: 'mock-connection-name' })
    });
    expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.serverName)
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get a connection with the server name', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getOpcUaConnectionByServerName.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getOpcUaConnectionByServerName).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.serverName)
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /logs', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/logs',
    resource: '/logs'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getLogs.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get logs', async () => {
    mockDynamoDbHandler.getLogs.mockResolvedValueOnce({ logs: [] });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ logs: [] })
    });
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get logs with next token', async () => {
    event.queryStringParameters = {
      nextToken: encodeURI(
        JSON.stringify({
          connectionName: 'mock-next-token-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    };
    mockDynamoDbHandler.getLogs.mockResolvedValueOnce({
      logs: [
        {
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime(),
          message: JSON.stringify({ message: 'Hello, world' })
        }
      ],
      nextToken: encodeURI(
        JSON.stringify({
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        logs: [
          {
            connectionName: 'mock-connection-name',
            timestamp: new Date(1).getTime(),
            message: JSON.stringify({ message: 'Hello, world' })
          }
        ],
        nextToken: encodeURI(
          JSON.stringify({
            connectionName: 'mock-connection-name',
            timestamp: new Date(1).getTime()
          })
        )
      })
    });
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledWith(
      encodeURI(
        JSON.stringify({
          connectionName: 'mock-next-token-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get logs', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getLogs.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogs).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /logs/{connectionName}', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/logs/mock-connection-name',
    pathParameters: { connectionName: 'mock-connection-name' },
    resource: '/logs/{connectionName}'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getLogsByConnection.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get logs by connection', async () => {
    mockDynamoDbHandler.getLogsByConnection.mockResolvedValueOnce({ logs: [] });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ logs: [] })
    });
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.connectionName),
      undefined
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get logs by connection with next token', async () => {
    event.queryStringParameters = {
      nextToken: encodeURI(
        JSON.stringify({
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    };
    mockDynamoDbHandler.getLogsByConnection.mockResolvedValueOnce({
      logs: [
        {
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime(),
          message: JSON.stringify({ message: 'Hello, world' })
        }
      ],
      nextToken: encodeURI(
        JSON.stringify({
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        logs: [
          {
            connectionName: 'mock-connection-name',
            timestamp: new Date(1).getTime(),
            message: JSON.stringify({ message: 'Hello, world' })
          }
        ],
        nextToken: encodeURI(
          JSON.stringify({
            connectionName: 'mock-connection-name',
            timestamp: new Date(1).getTime()
          })
        )
      })
    });
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.connectionName),
      encodeURI(
        JSON.stringify({
          connectionName: 'mock-connection-name',
          timestamp: new Date(1).getTime()
        })
      )
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get logs by connection', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getLogsByConnection.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getLogsByConnection).toHaveBeenCalledWith(
      decodeURIComponent(event.pathParameters.connectionName),
      undefined
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /greengrass', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/greengrass',
    resource: '/greengrass'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getGreengrassCoreDevices.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get Greengrass core devices from DynamoDB', async () => {
    mockDynamoDbHandler.getGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice] })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get Greengrass core devices from DynamoDB with next token', async () => {
    event.queryStringParameters = {
      nextToken: encodeURI(JSON.stringify({ name: 'mock-next-token' }))
    };
    mockDynamoDbHandler.getGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice] })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledWith(event.queryStringParameters.nextToken);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get Greengrass core devices from DynamoDB', async () => {
    delete event.queryStringParameters;
    mockDynamoDbHandler.getGreengrassCoreDevices.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledWith(undefined);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});

describe('Unit tests of GET /greengrass/user', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'GET',
    path: '/greengrass/user',
    resource: '/greengrass/user'
  };

  beforeEach(() => {
    mockDynamoDbHandler.getGreengrassCoreDevices.mockReset();
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to get user created Greengrass core devices', async () => {
    const greengrassCoreDeviceName = 'mock-available';

    mockDynamoDbHandler.getGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice]
    });
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: greengrassCoreDeviceName
        }
      ]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        greengrassCoreDevices: [
          { coreDeviceThingName: greengrassCoreDeviceName, status: mockValue.greengrassGreengrassCoreDevice.status }
        ]
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledWith(undefined);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get user created Greengrass core devices when no available Greengrass core devices on Greengrass', async () => {
    mockDynamoDbHandler.getGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice]
    });
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({ greengrassCoreDevices: [] })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledWith(undefined);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get user created Greengrass core devices with DynamoDB next token', async () => {
    const greengrassCoreDeviceName = 'mock-available';

    mockDynamoDbHandler.getGreengrassCoreDevices
      .mockResolvedValueOnce({
        greengrassCoreDevices: [mockValue.dynamoDbGreengrassCoreDevice],
        nextToken: encodeURI(JSON.stringify({ name: mockValue.dynamoDbGreengrassCoreDevice }))
      })
      .mockResolvedValueOnce({
        greengrassCoreDevices: [
          {
            ...mockValue.dynamoDbGreengrassCoreDevice,
            name: 'other-greengrass-core'
          }
        ]
      });
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: greengrassCoreDeviceName
        }
      ]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        greengrassCoreDevices: [
          { coreDeviceThingName: greengrassCoreDeviceName, status: mockValue.greengrassGreengrassCoreDevice.status }
        ]
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenCalledTimes(2);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenNthCalledWith(1, undefined);
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).toHaveBeenNthCalledWith(
      2,
      encodeURI(JSON.stringify({ name: mockValue.dynamoDbGreengrassCoreDevice }))
    );
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get user created Greengrass core devices', async () => {
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockRejectedValueOnce(Error('Failure'));

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevices).not.toHaveBeenCalled();
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith('[connection-builder]', 'Error occurred: ', Error('Failure'));
  });
});
