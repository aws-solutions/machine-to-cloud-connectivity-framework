// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Auth from '@aws-amplify/auth';
import { I18n, Logger } from '@aws-amplify/core';
import { AmplifyConfigurationInput, ConnectionControl, ConnectionDefinition, MachineProtocol } from '../Types';
import * as Utils from '../Utils';

test('Test getAmplifyConfiguration() function', async () => {
  const config: AmplifyConfigurationInput = {
    apiEndpoint: 'https://mock-url',
    identityPoolId: 'mock-identity-pool-id',
    loggingLevel: 'ERROR',
    region: 'mock-aws-region',
    userPoolId: 'mock-user-pool-id',
    webClientId: 'mock-web-client-id'
  };

  expect(Utils.getAmplifyConfiguration(config)).toEqual({
    API: {
      endpoints: [
        { name: 'M2C2Api', endpoint: config.apiEndpoint, region: config.region }
      ]
    },
    Auth: {
      region: config.region,
      userPoolId: config.userPoolId,
      userPoolWebClientId: config.webClientId,
      identityPoolId: config.identityPoolId
    }
  });
});

describe('signOut()', () => {
  const { location } = window;
  const authSpy = jest.spyOn(Auth, 'signOut');
  const loggerSpy = jest.spyOn(Logger.prototype, 'error');

  beforeAll(() => {
    // @ts-ignore
    delete window.location;
    window.location = {
      ...location,
      reload: jest.fn()
    };
  });
  beforeEach(() => {
    authSpy.mockReset();
    loggerSpy.mockReset();
  });
  afterAll(() => window.location = location);

  test('Success', async () => {
    authSpy.mockResolvedValueOnce(undefined);

    await Utils.signOut();
    expect(authSpy).toHaveBeenCalledTimes(1);
    expect(window.location.reload).toHaveBeenCalled();
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  test('Failure', async () => {
    authSpy.mockRejectedValueOnce('error');

    try {
      await Utils.signOut();
    } catch (error) {
      expect(error).toEqual('error');
    }

    expect(authSpy).toHaveBeenCalledTimes(1);
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith('Error while signing out the user.', 'error');
  });
});

describe('buildConnectionDefinition()', () => {
  const params: ConnectionDefinition = {
    control: ConnectionControl.START,
    connectionName: 'mock-connection-id',
    protocol: MachineProtocol.OPCDA
  };

  test('Test default parameters', () => {
    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: 'opcda'
    });
  });

  test('Test invalid protocol', () => {
    params.control = ConnectionControl.DEPLOY;
    params.protocol = 'invalid' as any;

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: 'invalid'
    });
  });

  test('Test OPC DA protocol', () => {
    params.protocol = MachineProtocol.OPCDA;
    params.opcDa = {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name',
      interval: '1',
      iterations: '1',
      listTags: ['ListTag.*']
    };

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCDA,
      opcDa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
        interval: 1,
        iterations: 1,
        listTags: ['ListTag.*']
      }
    });
  });

  test('Test OPC UA protocol', () => {
    delete params.opcDa;
    params.control = ConnectionControl.UPDATE;
    params.protocol = MachineProtocol.OPCUA;
    params.opcUa = {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name',
      port: '1234'
    };

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCUA,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
        port: 1234
      }
    });
  });

  test('Test OPC UA protocol empty port', () => {
    params.opcUa = {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name',
      port: ''
    };

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCUA,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
      }
    });
  });

  test('Test parameters including sendDataToIoTSitewise', () => {
    params.sendDataToIoTSitewise = false;

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCUA,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
      },
      sendDataToIoTSitewise: false
    });
  });

  test('Test parameters including sendDataToIoTTopic', () => {
    params.sendDataToIoTTopic = true;

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCUA,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
      },
      sendDataToIoTSitewise: false,
      sendDataToIoTTopic: true
    });
  });

  test('Test parameters including sendDataToKinesisDataStreams', () => {
    params.sendDataToKinesisDataStreams = true;

    expect(Utils.buildConnectionDefinition(params)).toEqual({
      control: params.control,
      connectionName: params.connectionName,
      protocol: MachineProtocol.OPCUA,
      opcUa: {
        machineIp: '1.2.3.4',
        serverName: 'mock-opcda-server-name',
      },
      sendDataToIoTSitewise: false,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: true
    });
  });
});

describe('getErrorMessage()', () => {
  test('Test to return `error.response.data.errorMessage`', () => {
    const errorMessage = 'Error from error.response.data.errorMessage';
    const error = {
      response: {
        data: { errorMessage: errorMessage }
      }
    };
    expect(Utils.getErrorMessage(error)).toEqual(errorMessage);
  });

  test('Test to return `error.response.data`', () => {
    const errorMessage = 'Error from error.response.data';
    const error = {
      response: {
        data: { mock: errorMessage }
      }
    };
    expect(Utils.getErrorMessage(error)).toEqual({ mock: errorMessage });
  });

  test('Test to return `error.message`', () => {
    const errorMessage = 'Error from error.message';
    const error = {
      response: {},
      message: errorMessage
    };
    expect(Utils.getErrorMessage(error)).toEqual(errorMessage);
  });

  test('Test to return `error`', () => {
    const errorMessage = 'Error from error';
    const error = { mock: errorMessage };
    expect(Utils.getErrorMessage(error)).toEqual({ mock: errorMessage });
  });
});

describe('validateConnectionDefinition()', () => {
  const params: ConnectionDefinition = {
    connectionName: 'valid-connection-id',
    control: ConnectionControl.DEPLOY,
    protocol: MachineProtocol.OPCDA,
    siteName: 'site',
    area: 'area',
    process: 'process',
    machineName: 'machine',
    sendDataToIoTSitewise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    opcDa: {
      machineIp: '1.2.3.4',
      serverName: 'Valid.Server.Name',
      iterations: 1,
      interval: 1,
      listTags: ['tag']
    }
  };

  test('All valid values', () => {
    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('Connection name is empty', () => {
    params.connectionName = '';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      connectionName: I18n.get('invalid.connection.name')
    });
  });

  test('Connection name is not a string', () => {
    params.connectionName = 1 as any;

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      connectionName: I18n.get('invalid.connection.name')
    });
  });

  test('Connection name is longer than maximum characters', () => {
    params.connectionName = Array(20).fill('a').join('b');

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      connectionName: I18n.get('invalid.connection.name')
    });
  });

  test('Connection name contains unsupported characters', () => {
    params.connectionName = 'space is not allowed';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      connectionName: I18n.get('invalid.connection.name')
    });
  });

  test('Site name is empty', () => {
    params.connectionName = 'valid-connection-id';
    params.siteName = '';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      siteName: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Site name')
    });
  });

  test('Area is empty', () => {
    params.siteName = 'site';
    params.area = '';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      area: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Area')
    });
  });

  test('Process is empty', () => {
    params.area = 'area';
    params.process = '';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      process: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Process')
    });
  });

  test('Machine name is empty', () => {
    params.process = 'process';
    params.machineName = '';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      machineName: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Machine name')
    });
  });

  test('Send data to IoT Sitewise only', () => {
    params.machineName = 'machine';
    params.sendDataToIoTSitewise = true;
    params.sendDataToIoTTopic = false;
    params.sendDataToKinesisDataStreams = false;

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('Send data to IoT topic only', () => {
    params.sendDataToIoTSitewise = false;
    params.sendDataToIoTTopic = true;
    params.sendDataToKinesisDataStreams = false;

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('Send data to stream manager only', () => {
    params.sendDataToIoTSitewise = false;
    params.sendDataToIoTTopic = false;
    params.sendDataToKinesisDataStreams = true;

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('Send data to nowhere', () => {
    params.sendDataToIoTSitewise = false;
    params.sendDataToIoTTopic = false;
    params.sendDataToKinesisDataStreams = false;

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      sendDataTo: I18n.get('invalid.send.data.to')
    });
  });

  test('OPC DA: Iteration is not a number', () => {
    params.sendDataToIoTSitewise = true;
    params.sendDataToIoTTopic = false;
    params.sendDataToKinesisDataStreams = true;
    params.opcDa!.iterations = 'a';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      iterations: I18n.get('invalid.iterations')
    });
  });

  test('OPC DA: Iteration is not an integer', () => {
    params.opcDa!.iterations = '1.1';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      iterations: I18n.get('invalid.iterations')
    });
  });

  test('OPC DA: Iteration is less than minimum value', () => {
    params.opcDa!.iterations = '0';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      iterations: I18n.get('invalid.iterations')
    });
  });

  test('OPC DA: Iteration is greater than maximum value', () => {
    params.opcDa!.iterations = '31';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      iterations: I18n.get('invalid.iterations')
    });
  });

  test('OPC DA: Time interval is not a number', () => {
    params.opcDa!.iterations = '1';
    params.opcDa!.interval = 'a';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      interval: I18n.get('invalid.time.interval')
    });
  });

  test('OPC DA: Time interval is less than minimum value', () => {
    params.opcDa!.interval = '0';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      interval: I18n.get('invalid.time.interval')
    });
  });

  test('OPC DA: Time interval is greater than maximum value', () => {
    params.opcDa!.interval = '30.4';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      interval: I18n.get('invalid.time.interval')
    });
  });

  test('OPC DA: Server name is empty', () => {
    params.opcDa!.interval = '30';
    params.opcDa!.serverName = '  ';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      opcDa_serverName: I18n.get('invalid.server.name')
    });
  });

  test('OPC DA: Machine IP is invalid', () => {
    params.opcDa!.serverName = 'Valid.Server.Name';
    params.opcDa!.machineIp = '256.256.256.256';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      opcDa_machineIp: I18n.get('invalid.machine.ip')
    });
  });

  test('OPC DA: Both listTags and tags are undefined', () => {
    params.opcDa!.machineIp = '10.0.0.0';
    params.opcDa!.listTags = undefined;
    params.opcDa!.tags = undefined;

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      tags: I18n.get('invalid.tags')
    });
  });

  test('OPC DA: Both listTags and tags are empty', () => {
    params.opcDa!.machineIp = '10.0.0.0';
    params.opcDa!.listTags = [];
    params.opcDa!.tags = [];

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      tags: I18n.get('invalid.tags')
    });
  });

  test('OPC DA: listTags has a value', () => {
    params.opcDa!.machineIp = '10.0.0.0';
    params.opcDa!.listTags = ['tag'];
    params.opcDa!.tags = [];

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC DA: tags has a value', () => {
    params.opcDa!.machineIp = '10.0.0.0';
    params.opcDa!.listTags = [];
    params.opcDa!.tags = ['tag'];

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC DA: Both listTags and tags have a value', () => {
    params.opcDa!.machineIp = '10.0.0.0';
    params.opcDa!.listTags = ['tag'];
    params.opcDa!.tags = ['tag'];

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC UA: Every default value is valid', () => {
    delete params.opcDa;
    params.protocol = MachineProtocol.OPCUA;
    params.opcUa = {
      serverName: 'Valid.Server.Name',
      machineIp: '1.2.3.4'
    };

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC UA: Server name is empty', () => {
    delete params.opcDa;
    params.protocol = MachineProtocol.OPCUA;
    params.opcUa!.serverName = '  ';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      opcUa_serverName: I18n.get('invalid.server.name')
    });
  });

  test('OPC UA: Server name is longer than 256 characters', () => {
    params.opcUa!.serverName = Array(258).join('a');

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      opcUa_serverName: I18n.get('invalid.server.name')
    });
  });

  test('OPC UA: Machine IP is invalid', () => {
    params.opcUa!.serverName = 'Valid.Server.Name';
    params.opcUa!.machineIp = '256.256.256.256';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      opcUa_machineIp: I18n.get('invalid.machine.ip')
    });
  });

  test('OPC UA: Port is undefined', () => {
    params.opcUa!.machineIp = '1.2.3.4';

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC UA: Port is an empty string', () => {
    params.opcUa!.port = '  ';

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('OPC UA: Port is not an integer', () => {
    params.opcUa!.port = '1.1';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      port: I18n.get('invalid.port')
    });
  });

  test('OPC UA: Port is less than the minimum value', () => {
    params.opcUa!.port = '0';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      port: I18n.get('invalid.port')
    });
  });

  test('OPC UA: Port is greater than the minimum value', () => {
    params.opcUa!.port = '65536';

    expect(Utils.validateConnectionDefinition(params)).toEqual({
      port: I18n.get('invalid.port')
    });
  });

  test('OPC UA: Port is between the minimum value and the maximum value', () => {
    params.opcUa!.port = '80';

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  });

  test('Other protocol: It should not have an error', () => {
    params.protocol = 'unsupported' as any;

    expect(Utils.validateConnectionDefinition(params)).toEqual({});
  })
});

test('Test copyObject() function', () => {
  expect(Utils.copyObject({})).toEqual({});
  expect(Utils.copyObject([])).toEqual([]);
  expect(Utils.copyObject({ a: 'a' })).toEqual({ a: 'a' });
  expect(Utils.copyObject({ a: 1 })).toEqual({ a: 1 });
  expect(Utils.copyObject({ a: true })).toEqual({ a: true });
  expect(Utils.copyObject({ a: ['a'] })).toEqual({ a: ['a'] });
  expect(Utils.copyObject({ a: 'a', b: 'b' })).toEqual({ a: 'a', b: 'b' });
  expect(Utils.copyObject({ a: { b: 'b' } })).toEqual({ a: { b: 'b' } });
  expect(Utils.copyObject({ a: { b: { c: 'c' } } })).toEqual({ a: { b: { c: 'c' } } });
  const func = () => console.log('func');
  expect(Utils.copyObject({ a: func })).toEqual({ a: func });
  expect(() => Utils.copyObject('invalid')).toThrowError(Error('Invalid object'));

  // The change of the copied object object shouldn't impact the original one.
  let original: any = { a: 'a' };
  let copiedObject: any = Utils.copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: 'a' });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: ['a'] };
  copiedObject = Utils.copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: ['a'] });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: { b: 'b' } };
  copiedObject = Utils.copyObject(original);
  copiedObject.a = 'b';
  expect(original).toEqual({ a: { b: 'b' } });
  expect(copiedObject).toEqual({ a: 'b' });

  original = { a: { b: 'b' } };
  copiedObject = Utils.copyObject(original);
  copiedObject.a.b = 'c';
  expect(original).toEqual({ a: { b: 'b' } });
  expect(copiedObject).toEqual({ a: { b: 'c' } });

  original = { a: { b: { c: 'c' } } };
  copiedObject = Utils.copyObject(original);
  copiedObject.a.b.c = 'd';
  expect(original).toEqual({ a: { b: { c: 'c' } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'd' } } });

  original = { a: { b: { c: 'c', d: ['d1', 'd2'] } } };
  copiedObject = Utils.copyObject(original);
  copiedObject.a.b.c = 'd';
  copiedObject.a.b.d.pop();
  copiedObject.e = 'e';
  expect(original).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2'] } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'd', d: ['d1'] } }, e: 'e' });

  original = { a: { b: { c: 'c', d: ['d1', 'd2'] } } };
  copiedObject = Utils.copyObject(original);
  copiedObject.a.b.d.push('d3');
  expect(original).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2'] } } });
  expect(copiedObject).toEqual({ a: { b: { c: 'c', d: ['d1', 'd2', 'd3'] } } });

  original = { a: func };
  copiedObject = Utils.copyObject(original);
  const newFunc = () => console.log('newFunc');
  copiedObject.a = newFunc;
  expect(original).toEqual({ a: func });
  expect(copiedObject).toEqual({ a: newFunc });
});

test('Test copyArray() function', () => {
  expect(Utils.copyArray([])).toEqual([]);
  expect(() => Utils.copyArray('invalid' as any)).toThrow(Error('Invalid array'));
  expect(Utils.copyArray([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(Utils.copyArray([{ a: 'b' }])).toEqual([{ a: 'b' }]);

  // The change of the copied object object shouldn't impact the original one.
  let original: any = [1, 2, 3];
  let copiedArray: any = Utils.copyArray(original);
  copiedArray[0] = 4;
  expect(original).toEqual([1, 2, 3]);
  expect(copiedArray).toEqual([4, 2, 3]);

  original = [[1, 2, 3], [4, 5, 6]];
  copiedArray = Utils.copyArray(original);
  copiedArray[0][2] = 5;
  expect(original).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(copiedArray).toEqual([[1, 2, 5], [4, 5, 6]]);
});