// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsDynamoDB } from './mock';
import DynamoDBHandler from '../aws-handlers/dynamodb-handler';
import { LambdaError } from '../errors';
import { ConnectionControl, MachineProtocol } from '../types/solution-common-types';
import { CreatedBy, GreengrassCoreDeviceItem } from '../types/dynamodb-handler-types';

const dynamoDbHandler = new DynamoDBHandler();

/**
 * Creates fake connection DynamoDB table items.
 * @param loop The number of items to create
 * @returns The fake connection DynamoDB table items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createFakeConnectionItems = (loop: number): any[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];
  for (let i = 1; i <= loop; i++) {
    items.push({
      connectionName: `connection-${i}`,
      machineName: `connection-${i}-machine`,
      protocol: i % 2 === 0 ? 'opcda' : 'opcua',
      control: i % 2 === 0 ? 'start' : 'stop',
      logLevel: undefined,
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: false,
      sendDataToTimestream: true
    });
  }

  return items;
};

/**
 * Converts the fake connection DynamoDB table items to `getConnections()` response.
 * @param items The connection DynamoDB table items
 * @returns The converted connection DynamoDB table items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertFakeConnectionItems = (items: any[]): any[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connections: any[] = [];
  for (const item of items) {
    connections.push({
      connectionName: item.connectionName,
      machineName: item.machineName,
      logLevel: undefined,
      protocol: item.protocol,
      status: item.control,
      sendDataToIoTSiteWise: item.sendDataToIoTSiteWise,
      sendDataToIoTTopic: item.sendDataToIoTTopic,
      sendDataToKinesisDataStreams: item.sendDataToKinesisDataStreams,
      sendDataToTimestream: item.sendDataToTimestream
    });
  }

  return connections;
};

/**
 * Creates fake logs DynamoDB table items.
 * @param loop The number of items to create
 * @param sameName To create same connection ID logs
 * @returns The fake logs DynamoDB table items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFakeLogItems(loop: number, sameName?: boolean): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];
  for (let i = 1; i <= loop; i++) {
    items.push({
      connectionName: sameName ? 'connection-1' : `connection-${i}`,
      timestamp: sameName ? 1 + i : 1,
      logType: i % 2 === 0 ? 'info' : 'error',
      message: 'Hello world!'
    });
  }

  return items;
}

/**
 * Creates fake Greengrass core devices DynamoDB table items.
 * @param loop The number of items to create
 * @returns The fake Greengrass core devices DynamoDB table items
 */
function createFakeGreengrassCoreDeviceItems(loop: number): GreengrassCoreDeviceItem[] {
  const items: GreengrassCoreDeviceItem[] = [];

  for (let i = 0; i < loop; i++) {
    items.push({
      name: `greengrass-${i}`,
      createdBy: i % 2 === 0 ? CreatedBy.SYSTEM : CreatedBy.USER,
      numberOfConnections: i,
      iotThingArn: `arn:of:iot:thing-${i}`,
      iotSiteWiseGatewayId: `sitewise-gateway-${i}`
    });
  }

  return items;
}

describe('Unit tests of getConnections() function', () => {
  beforeEach(() => mockAwsDynamoDB.scan.mockReset());

  test('Test without `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeConnectionItems(2);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const response = await dynamoDbHandler.getConnections();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      connections: convertFakeConnectionItems(fakeItems)
    });
  });

  test('Test without `nextToken`, and the result contains the next token', async () => {
    const fakeItems = createFakeConnectionItems(3);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems,
          LastEvaluatedKey: { connectionName: 'connection-3' }
        });
      }
    }));

    const response = await dynamoDbHandler.getConnections();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      connections: convertFakeConnectionItems(fakeItems),
      nextToken: encodeURI(JSON.stringify({ connectionName: 'connection-2' }))
    });
  });

  test('Test with `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeConnectionItems(1);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const nextToken = encodeURI(JSON.stringify({ connectionName: 'connection-2' }));
    const response = await dynamoDbHandler.getConnections(nextToken);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1,
      ExclusiveStartKey: JSON.parse(decodeURI(nextToken))
    });
    expect(response).toEqual({
      connections: convertFakeConnectionItems(fakeItems)
    });
  });
});

describe('Unit tests of getConnection() function', () => {
  beforeEach(() => mockAwsDynamoDB.get.mockReset());

  test('Test to get a connection successfully', async () => {
    const fakeItems = createFakeConnectionItems(1);
    mockAwsDynamoDB.get.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Item: fakeItems[0]
        });
      }
    }));

    const response = await dynamoDbHandler.getConnection('connection-1');
    expect(mockAwsDynamoDB.get).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: 'connection-1' }
    });
    expect(response).toEqual(fakeItems[0]);
  });

  test('Test when there is no item', async () => {
    mockAwsDynamoDB.get.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({});
      }
    }));

    try {
      await dynamoDbHandler.getConnection('connection-1');
    } catch (error) {
      expect(error).toEqual(
        new LambdaError({
          message: '`connection-1` does not exist.',
          name: 'DynamoDBHandlerError',
          statusCode: 404
        })
      );
    }

    expect(mockAwsDynamoDB.get).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: 'connection-1' }
    });
  });
});

describe('Unit tests of updateConnection() function', () => {
  const fakeTime = 1;
  const fakeTimestamp = new Date(fakeTime).toISOString();

  beforeEach(() => {
    mockAwsDynamoDB.update.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fakeTime));
  });

  test('Test to update the connection with the default input', async () => {
    mockAwsDynamoDB.update.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const input = {
      connectionName: 'connection-1',
      control: ConnectionControl.START
    };
    await dynamoDbHandler.updateConnection(input);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: input.connectionName },
      UpdateExpression: 'set #timestamp = :timestamp, #control = :control',
      ExpressionAttributeValues: {
        ':control': input.control,
        ':timestamp': fakeTimestamp
      },
      ExpressionAttributeNames: {
        '#control': 'control',
        '#timestamp': 'timestamp'
      }
    });
  });

  test('Test to update the connection with OPC UA with source', async () => {
    mockAwsDynamoDB.update.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source: any = { mock: 'data' };
    const input = {
      connectionName: 'connection-1',
      control: ConnectionControl.START,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-server-name',
        source
      }
    };
    await dynamoDbHandler.updateConnection(input);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: input.connectionName },
      UpdateExpression: 'set #timestamp = :timestamp, #control = :control, #opcUa = :opcUa',
      ExpressionAttributeValues: {
        ':control': input.control,
        ':timestamp': fakeTimestamp,
        ':opcUa': input.opcUa
      },
      ExpressionAttributeNames: {
        '#control': 'control',
        '#timestamp': 'timestamp',
        '#opcUa': 'opcUa'
      }
    });
  });

  test('Test to update the connection with OPC UA without source', async () => {
    mockAwsDynamoDB.update.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const input = {
      connectionName: 'connection-1',
      control: ConnectionControl.START,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-server-name'
      }
    };
    await dynamoDbHandler.updateConnection(input);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: input.connectionName },
      UpdateExpression: 'set #timestamp = :timestamp, #control = :control, #opcUa = :opcUa',
      ExpressionAttributeValues: {
        ':control': input.control,
        ':timestamp': fakeTimestamp,
        ':opcUa': input.opcUa
      },
      ExpressionAttributeNames: {
        '#control': 'control',
        '#timestamp': 'timestamp',
        '#opcUa': 'opcUa'
      }
    });
  });
});

describe('Unit tests of addConnection() function', () => {
  const fakeTime = 1;
  const fakeTimestamp = new Date(fakeTime).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectionDefinition: any = {
    connectionName: 'connection-1',
    control: ConnectionControl.DEPLOY,
    opcDa: { fake: 'OPC DA Data' },
    opcUa: { fake: 'OPC UA Data' },
    protocol: MachineProtocol.OPCDA
  };

  beforeEach(() => {
    mockAwsDynamoDB.put.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fakeTime));
  });

  test('Test with the default OPC DA required connection definition', async () => {
    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCDA,
        area: undefined,
        machineName: undefined,
        process: undefined,
        logLevel: undefined,
        sendDataToIoTSiteWise: false,
        sendDataToIoTTopic: false,
        sendDataToKinesisDataStreams: true,
        sendDataToTimestream: false,
        siteName: undefined,
        timestamp: fakeTimestamp,
        opcDa: { fake: 'OPC DA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      machineName: undefined,
      logLevel: undefined
    });
  });

  test('Test with hierarchy values for OPC UA', async () => {
    connectionDefinition.protocol = MachineProtocol.OPCUA;
    connectionDefinition.area = 'area';
    connectionDefinition.machineName = 'machine';
    connectionDefinition.process = 'process';
    connectionDefinition.siteName = 'site';
    connectionDefinition.logLevel = undefined;

    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCUA,
        area: 'area',
        machineName: 'machine',
        process: 'process',
        logLevel: undefined,
        sendDataToIoTSiteWise: false,
        sendDataToIoTTopic: false,
        sendDataToKinesisDataStreams: true,
        sendDataToTimestream: false,
        siteName: 'site',
        timestamp: fakeTimestamp,
        opcUa: { fake: 'OPC UA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      machineName: 'machine',
      logLevel: undefined
    });
  });

  test('Test with `sendDataToIoTSiteWise`', async () => {
    connectionDefinition.sendDataToIoTSiteWise = true;
    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCUA,
        area: 'area',
        machineName: 'machine',
        process: 'process',
        logLevel: undefined,
        sendDataToIoTSiteWise: true,
        sendDataToIoTTopic: false,
        sendDataToKinesisDataStreams: true,
        sendDataToTimestream: false,
        siteName: 'site',
        timestamp: fakeTimestamp,
        opcUa: { fake: 'OPC UA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      machineName: 'machine',
      logLevel: undefined
    });
  });

  test('Test with `sendDataToIoTTopic`', async () => {
    connectionDefinition.sendDataToIoTTopic = true;
    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCUA,
        area: 'area',
        machineName: 'machine',
        process: 'process',
        logLevel: undefined,
        sendDataToIoTSiteWise: true,
        sendDataToIoTTopic: true,
        sendDataToKinesisDataStreams: true,
        sendDataToTimestream: false,
        siteName: 'site',
        timestamp: fakeTimestamp,
        opcUa: { fake: 'OPC UA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      machineName: 'machine',
      logLevel: undefined
    });
  });

  test('Test with `sendDataToKinesisDataStreams`', async () => {
    connectionDefinition.sendDataToKinesisDataStreams = false;
    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCUA,
        area: 'area',
        machineName: 'machine',
        process: 'process',
        logLevel: undefined,
        sendDataToIoTSiteWise: true,
        sendDataToIoTTopic: true,
        sendDataToKinesisDataStreams: false,
        sendDataToTimestream: false,
        siteName: 'site',
        timestamp: fakeTimestamp,
        opcUa: { fake: 'OPC UA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: false,
      sendDataToTimestream: false,
      machineName: 'machine',
      logLevel: undefined
    });
  });

  test('Test with `sendDataToTimestream`', async () => {
    connectionDefinition.sendDataToTimestream = true;
    mockAwsDynamoDB.put.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const response = await dynamoDbHandler.addConnection(connectionDefinition);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Item: {
        connectionName: 'connection-1',
        control: ConnectionControl.DEPLOY,
        protocol: MachineProtocol.OPCUA,
        area: 'area',
        machineName: 'machine',
        process: 'process',
        logLevel: undefined,
        sendDataToIoTSiteWise: true,
        sendDataToIoTTopic: true,
        sendDataToKinesisDataStreams: false,
        sendDataToTimestream: true,
        siteName: 'site',
        timestamp: fakeTimestamp,
        opcUa: { fake: 'OPC UA Data' }
      }
    });
    expect(response).toEqual({
      connectionName: connectionDefinition.connectionName,
      protocol: connectionDefinition.protocol,
      status: connectionDefinition.control,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: false,
      sendDataToTimestream: true,
      machineName: 'machine',
      logLevel: undefined
    });
  });

  test('It throws an error when the protocol is unsupported', async () => {
    connectionDefinition.protocol = 'invalid';

    await expect(() => dynamoDbHandler.addConnection(connectionDefinition)).rejects.toEqual(
      new LambdaError({
        message: `Unsupported protocol: ${connectionDefinition.protocol}`,
        name: 'DynamoDBHandlerError',
        statusCode: 400
      })
    );
    expect(mockAwsDynamoDB.put).not.toHaveBeenCalled();
  });
});

describe('Unit tests of deleteConnection() function', () => {
  beforeEach(() => mockAwsDynamoDB.put.mockReset());

  test('Test to delete a connection', async () => {
    mockAwsDynamoDB.delete.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await dynamoDbHandler.deleteConnection('connection-1');
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Key: { connectionName: 'connection-1' }
    });
  });
});

describe('Unit tests of getLogs() function', () => {
  beforeEach(() => mockAwsDynamoDB.scan.mockReset());

  test('Test without `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeLogItems(2);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const response = await dynamoDbHandler.getLogs();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      logs: fakeItems
    });
  });

  test('Test without `nextToken`, and the result contains the next token', async () => {
    const fakeItems = createFakeLogItems(3);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems,
          LastEvaluatedKey: { connectionName: 'connection-3', timestamp: 1 }
        });
      }
    }));

    const response = await dynamoDbHandler.getLogs();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      logs: fakeItems,
      nextToken: encodeURI(JSON.stringify({ connectionName: 'connection-2', timestamp: 1 }))
    });
  });

  test('Test with `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeLogItems(1);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const nextToken = encodeURI(JSON.stringify({ connectionName: 'connection-2', timestamp: 1 }));
    const response = await dynamoDbHandler.getLogs(nextToken);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1,
      ExclusiveStartKey: JSON.parse(decodeURI(nextToken))
    });
    expect(response).toEqual({
      logs: fakeItems
    });
  });
});

describe('Unit tests of getLogsByConnection() function', () => {
  beforeEach(() => mockAwsDynamoDB.query.mockReset());

  test('Test without `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeLogItems(2, true);
    mockAwsDynamoDB.query.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const response = await dynamoDbHandler.getLogsByConnection('connection-1');
    expect(mockAwsDynamoDB.query).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.query).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      KeyConditionExpression: 'connectionName = :connectionName',
      ExpressionAttributeValues: { ':connectionName': 'connection-1' },
      ScanIndexForward: false,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      logs: fakeItems
    });
  });

  test('Test without `nextToken`, and the result contains the next token', async () => {
    const fakeItems = createFakeLogItems(3, true);
    mockAwsDynamoDB.query.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems,
          LastEvaluatedKey: { connectionName: 'connection-1', timestamp: 4 }
        });
      }
    }));

    const response = await dynamoDbHandler.getLogsByConnection('connection-1');
    expect(mockAwsDynamoDB.query).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.query).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      KeyConditionExpression: 'connectionName = :connectionName',
      ExpressionAttributeValues: {
        ':connectionName': 'connection-1'
      },
      ScanIndexForward: false,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      logs: fakeItems,
      nextToken: encodeURI(JSON.stringify({ connectionName: 'connection-1', timestamp: 3 }))
    });
  });

  test('Test with `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeLogItems(1);
    mockAwsDynamoDB.query.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const nextToken = encodeURI(JSON.stringify({ connectionName: 'connection-1', timestamp: 3 }));
    const response = await dynamoDbHandler.getLogsByConnection('connection-1', nextToken);
    expect(mockAwsDynamoDB.query).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.query).toHaveBeenCalledWith({
      TableName: process.env.LOGS_DYNAMODB_TABLE,
      KeyConditionExpression: 'connectionName = :connectionName',
      ExpressionAttributeValues: {
        ':connectionName': 'connection-1'
      },
      ScanIndexForward: false,
      Limit: parseInt(process.env.PAGE_SIZE) + 1,
      ExclusiveStartKey: JSON.parse(decodeURI(nextToken))
    });
    expect(response).toEqual({
      logs: fakeItems
    });
  });
});

describe('Unit tests of getOpcUaConnectionByServerName() function', () => {
  const fakeConnections = [
    { connectionName: 'connection-1', protocol: 'opcua', opcUa: { serverName: 'mock-server-name-1' } },
    { connectionName: 'connection-2', protocol: 'opcda', opcDa: { it: 'does not have opcUa' } },
    { connectionName: 'connection-3', protocol: 'opcua', opcUa: { serverName: 'mock-server-name-2' } }
  ];
  const nextFakeConnections = [
    { connectionName: 'connection-3', protocol: 'opcua', opcUa: { serverName: 'mock-server-name-2' } },
    { connectionName: 'connection-4', protocol: 'opcua', opcUa: { serverName: 'mock-server-name-3' } }
  ];

  beforeEach(() => {
    jest.resetModules();
    mockAwsDynamoDB.scan.mockReset();
  });

  test('Test to return an OPC UA connection', async () => {
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Items: [...fakeConnections] });
      }
    }));

    const response = await dynamoDbHandler.getOpcUaConnectionByServerName('mock-server-name-1');
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual(fakeConnections[0]);
  });

  test('Test to return an OPC UA connection after next token', async () => {
    mockAwsDynamoDB.scan
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            Items: [...fakeConnections],
            LastEvaluatedKey: { connectionName: 'connection-3' }
          });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({ Items: [...nextFakeConnections] });
        }
      }));

    const response = await dynamoDbHandler.getOpcUaConnectionByServerName('mock-server-name-3');
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(2);
    expect(mockAwsDynamoDB.scan).toHaveBeenNthCalledWith(1, {
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(mockAwsDynamoDB.scan).toHaveBeenNthCalledWith(2, {
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1,
      ExclusiveStartKey: { connectionName: 'connection-2' }
    });
    expect(response).toEqual(nextFakeConnections[1]);
  });

  test('Test to return no OPC UA connection', async () => {
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ Items: [...fakeConnections] });
      }
    }));

    const response = await dynamoDbHandler.getOpcUaConnectionByServerName('mock-server-name-4');
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.CONNECTION_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({});
  });
});

describe('Unit tests of getGreengrassCoreDevices() function', () => {
  beforeEach(() => mockAwsDynamoDB.scan.mockReset());

  test('Test without `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeGreengrassCoreDeviceItems(2);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const response = await dynamoDbHandler.getGreengrassCoreDevices();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      greengrassCoreDevices: fakeItems
    });
  });

  test('Test without `nextToken`, and the result contains the next token', async () => {
    const fakeItems = createFakeGreengrassCoreDeviceItems(1);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems,
          LastEvaluatedKey: { greengrassCoreDevice: fakeItems[0].name }
        });
      }
    }));

    const response = await dynamoDbHandler.getGreengrassCoreDevices();
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1
    });
    expect(response).toEqual({
      greengrassCoreDevices: fakeItems,
      nextToken: encodeURI(JSON.stringify({ greengrassCoreDevice: fakeItems[0].name }))
    });
  });

  test('Test with `nextToken`, and the result does not contain the next token', async () => {
    const fakeItems = createFakeGreengrassCoreDeviceItems(2);
    mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Items: fakeItems
        });
      }
    }));

    const nextToken = encodeURI(JSON.stringify({ greengrassCoreDevice: 'greengrass-mock' }));
    const response = await dynamoDbHandler.getGreengrassCoreDevices(nextToken);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Limit: parseInt(process.env.PAGE_SIZE) + 1,
      ExclusiveStartKey: JSON.parse(decodeURI(nextToken))
    });
    expect(response).toEqual({
      greengrassCoreDevices: fakeItems
    });
  });
});

describe('Unit tests of getGreengrassCoreDevice() function', () => {
  beforeEach(() => mockAwsDynamoDB.get.mockReset());

  test('Test to get a connection successfully', async () => {
    const fakeItems = createFakeGreengrassCoreDeviceItems(1);
    mockAwsDynamoDB.get.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          Item: fakeItems[0]
        });
      }
    }));

    const response = await dynamoDbHandler.getGreengrassCoreDevice(fakeItems[0].name);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name: fakeItems[0].name }
    });
    expect(response).toEqual(fakeItems[0]);
  });

  test('Test when there is no item', async () => {
    mockAwsDynamoDB.get.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({});
      }
    }));

    const greengrassCoreDeviceName = 'greengrass-mock';
    const response = await dynamoDbHandler.getGreengrassCoreDevice(greengrassCoreDeviceName);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.get).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name: greengrassCoreDeviceName }
    });
    expect(response).toBeUndefined();
  });
});

describe('Unit tests of addGreengrassCoreDevice() function', () => {
  const input: Omit<GreengrassCoreDeviceItem, 'numberOfConnections'> = {
    name: 'mock-greengrass-core',
    createdBy: CreatedBy.SYSTEM,
    iotThingArn: 'arn:of:iot:thing',
    iotSiteWiseGatewayId: 'mock-sitewise-gateway'
  };

  beforeEach(() => mockAwsDynamoDB.put.mockReset());

  test('Test success to add Greengrass core device', async () => {
    mockAwsDynamoDB.put.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await dynamoDbHandler.addGreengrassCoreDevice(input);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Item: {
        ...input,
        numberOfConnections: 0
      }
    });
  });

  test('Test failure to add Greengrass core device', async () => {
    mockAwsDynamoDB.put.mockImplementation(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(dynamoDbHandler.addGreengrassCoreDevice(input)).rejects.toEqual('Failure');
    expect(mockAwsDynamoDB.put).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.put).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Item: {
        ...input,
        numberOfConnections: 0
      }
    });
  });
});

describe('Unit tests of deleteGreengrassCoreDevice() function', () => {
  const name = 'mock-greengrass-core';

  beforeEach(() => mockAwsDynamoDB.delete.mockReset());

  test('Test success to delete Greengrass core device', async () => {
    mockAwsDynamoDB.delete.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await dynamoDbHandler.deleteGreengrassCoreDevice(name);
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name }
    });
  });

  test('Test failure to delete Greengrass core device', async () => {
    mockAwsDynamoDB.delete.mockImplementation(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(dynamoDbHandler.deleteGreengrassCoreDevice(name)).rejects.toEqual('Failure');
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.delete).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name }
    });
  });
});

describe('Unit tests of updateGreengrassCoreDevice() function', () => {
  const name = 'mock-greengrass-core';

  beforeEach(() => mockAwsDynamoDB.update.mockReset());

  test('Test success to increase the number of connections of the Greengrass core device', async () => {
    mockAwsDynamoDB.update.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await dynamoDbHandler.updateGreengrassCoreDevice({ name, increment: true });
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name },
      UpdateExpression: 'set numberOfConnections = numberOfConnections + :num',
      ExpressionAttributeValues: { ':num': 1 }
    });
  });

  test('Test success to decrease the number of connections of the Greengrass core device', async () => {
    mockAwsDynamoDB.update.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await dynamoDbHandler.updateGreengrassCoreDevice({ name, increment: false });
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name },
      UpdateExpression: 'set numberOfConnections = numberOfConnections - :num',
      ExpressionAttributeValues: { ':num': 1 }
    });
  });

  test('Test failure to update the Greengrass core device', async () => {
    mockAwsDynamoDB.update.mockImplementation(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(dynamoDbHandler.updateGreengrassCoreDevice({ name, increment: false })).rejects.toEqual('Failure');
    expect(mockAwsDynamoDB.update).toHaveBeenCalledTimes(1);
    expect(mockAwsDynamoDB.update).toHaveBeenCalledWith({
      TableName: process.env.GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE,
      Key: { name },
      UpdateExpression: 'set numberOfConnections = numberOfConnections - :num',
      ExpressionAttributeValues: { ':num': 1 }
    });
  });
});

test('Test the default PAGE_SIZE', async () => {
  delete process.env.PAGE_SIZE;
  mockAwsDynamoDB.scan.mockReset();

  const fakeItems = createFakeConnectionItems(2);
  mockAwsDynamoDB.scan.mockImplementationOnce(() => ({
    promise() {
      return Promise.resolve({
        Items: fakeItems
      });
    }
  }));

  const newDynamoDbHandler = new DynamoDBHandler();
  const response = await newDynamoDbHandler.getConnections();
  expect(mockAwsDynamoDB.scan).toHaveBeenCalledTimes(1);
  expect(mockAwsDynamoDB.scan).toHaveBeenCalledWith({
    TableName: process.env.CONNECTION_DYNAMODB_TABLE,
    Limit: 50 + 1
  });
  expect(response).toEqual({
    connections: convertFakeConnectionItems(fakeItems)
  });
});
