// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import {
  ConnectionControl,
  ConnectionDefinition,
  MachineProtocol,
  ModbusTcpDefinition,
  OpcDaDefinition,
  OpcUaDefinition
} from '../types';
import { validateConnectionDefinition } from '../validations';

const params: ConnectionDefinition = {
  connectionName: 'valid-connection-id',
  control: ConnectionControl.DEPLOY,
  greengrassCoreDeviceName: 'valid-greengrass-core',
  protocol: MachineProtocol.OPCDA,
  siteName: 'site',
  area: 'area',
  process: 'process',
  machineName: 'machine',
  logLevel: undefined,
  sendDataToIoTSiteWise: true,
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
  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Greengrass core device name is empty', () => {
  params.greengrassCoreDeviceName = '';

  expect(validateConnectionDefinition(params)).toEqual({
    greengrassCoreDeviceName: I18n.get('invalid.greengrass.core.device.name')
  });
});

test('Greengrass core device name is not string', () => {
  params.greengrassCoreDeviceName = undefined;

  expect(validateConnectionDefinition(params)).toEqual({
    greengrassCoreDeviceName: I18n.get('invalid.greengrass.core.device.name')
  });
});

test('Connection name is empty', () => {
  params.greengrassCoreDeviceName = 'valid-greengrass-core-device';
  params.connectionName = '';

  expect(validateConnectionDefinition(params)).toEqual({
    connectionName: I18n.get('invalid.connection.name')
  });
});

test('Connection name is not a string', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params.connectionName = 1 as any;

  expect(validateConnectionDefinition(params)).toEqual({
    connectionName: I18n.get('invalid.connection.name')
  });
});

test('Connection name is longer than maximum characters', () => {
  params.connectionName = Array(20).fill('a').join('b');

  expect(validateConnectionDefinition(params)).toEqual({
    connectionName: I18n.get('invalid.connection.name')
  });
});

test('Connection name contains unsupported characters', () => {
  params.connectionName = 'space is not allowed';

  expect(validateConnectionDefinition(params)).toEqual({
    connectionName: I18n.get('invalid.connection.name')
  });
});

test('Site name is empty', () => {
  params.connectionName = 'valid-connection-id';
  params.siteName = '';

  expect(validateConnectionDefinition(params)).toEqual({
    siteName: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Site name')
  });
});

test('Area is empty', () => {
  params.siteName = 'site';
  params.area = '';

  expect(validateConnectionDefinition(params)).toEqual({
    area: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Area')
  });
});

test('Process is empty', () => {
  params.area = 'area';
  params.process = '';

  expect(validateConnectionDefinition(params)).toEqual({
    process: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Process')
  });
});

test('Machine name is empty', () => {
  params.process = 'process';
  params.machineName = '';

  expect(validateConnectionDefinition(params)).toEqual({
    machineName: I18n.get('invalid.alphanumeric.hyphens.underscores').replace('{name}', 'Machine name')
  });
});

test('Send data to IoT SiteWise only', () => {
  params.machineName = 'machine';
  params.sendDataToIoTSiteWise = true;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = false;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = false;

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Send data to IoT topic only', () => {
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = true;
  params.sendDataToKinesisDataStreams = false;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = false;

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Send data to Kinesis data stream only', () => {
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = true;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = false;

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Send data to Timestream only', () => {
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = true;
  params.sendDataToTimestream = true;
  params.sendDataToHistorian = false;

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Send data to Historian only', () => {
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = false;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = true;

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Send data to nowhere', () => {
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = false;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = false;

  expect(validateConnectionDefinition(params)).toEqual({
    sendDataTo: I18n.get('invalid.send.data.to')
  });
});

test('OPC DA: Iteration is not a number', () => {
  params.sendDataToIoTSiteWise = true;
  params.sendDataToIoTTopic = false;
  params.sendDataToKinesisDataStreams = true;
  params.sendDataToTimestream = false;
  params.sendDataToHistorian = false;
  (params.opcDa as OpcDaDefinition).iterations = 'a';

  expect(validateConnectionDefinition(params)).toEqual({
    iterations: I18n.get('invalid.iterations')
  });
});

test('OPC DA: Iteration is not an integer', () => {
  (params.opcDa as OpcDaDefinition).iterations = '1.1';

  expect(validateConnectionDefinition(params)).toEqual({
    iterations: I18n.get('invalid.iterations')
  });
});

test('OPC DA: Iteration is less than minimum value', () => {
  (params.opcDa as OpcDaDefinition).iterations = '0';

  expect(validateConnectionDefinition(params)).toEqual({
    iterations: I18n.get('invalid.iterations')
  });
});

test('OPC DA: Iteration is greater than maximum value', () => {
  (params.opcDa as OpcDaDefinition).iterations = '31';

  expect(validateConnectionDefinition(params)).toEqual({
    iterations: I18n.get('invalid.iterations')
  });
});

test('OPC DA: Time interval is not a number', () => {
  (params.opcDa as OpcDaDefinition).iterations = '1';
  (params.opcDa as OpcDaDefinition).interval = 'a';

  expect(validateConnectionDefinition(params)).toEqual({
    interval: I18n.get('invalid.time.interval')
  });
});

test('OPC DA: Time interval is less than minimum value', () => {
  (params.opcDa as OpcDaDefinition).interval = '0';

  expect(validateConnectionDefinition(params)).toEqual({
    interval: I18n.get('invalid.time.interval')
  });
});

test('OPC DA: Time interval is greater than maximum value', () => {
  (params.opcDa as OpcDaDefinition).interval = '30.4';

  expect(validateConnectionDefinition(params)).toEqual({
    interval: I18n.get('invalid.time.interval')
  });
});

test('OPC DA: Server name is empty', () => {
  (params.opcDa as OpcDaDefinition).interval = '30';
  (params.opcDa as OpcDaDefinition).serverName = '  ';

  expect(validateConnectionDefinition(params)).toEqual({
    opcDa_serverName: I18n.get('invalid.server.name')
  });
});

test('OPC DA: Machine IP is invalid', () => {
  (params.opcDa as OpcDaDefinition).serverName = 'Valid.Server.Name';
  (params.opcDa as OpcDaDefinition).machineIp = '256.256.256.256';

  expect(validateConnectionDefinition(params)).toEqual({
    opcDa_machineIp: I18n.get('invalid.machine.ip')
  });
});

test('OPC DA: Both listTags and tags are undefined', () => {
  (params.opcDa as OpcDaDefinition).machineIp = '10.0.0.0';
  (params.opcDa as OpcDaDefinition).listTags = undefined;
  (params.opcDa as OpcDaDefinition).tags = undefined;

  expect(validateConnectionDefinition(params)).toEqual({
    tags: I18n.get('invalid.tags')
  });
});

test('OPC DA: Both listTags and tags are empty', () => {
  (params.opcDa as OpcDaDefinition).machineIp = '10.0.0.0';
  (params.opcDa as OpcDaDefinition).listTags = [];
  (params.opcDa as OpcDaDefinition).tags = [];

  expect(validateConnectionDefinition(params)).toEqual({
    tags: I18n.get('invalid.tags')
  });
});

test('OPC DA: listTags has a value', () => {
  (params.opcDa as OpcDaDefinition).machineIp = '10.0.0.0';
  (params.opcDa as OpcDaDefinition).listTags = ['tag'];
  (params.opcDa as OpcDaDefinition).tags = [];

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC DA: tags has a value', () => {
  (params.opcDa as OpcDaDefinition).machineIp = '10.0.0.0';
  (params.opcDa as OpcDaDefinition).listTags = [];
  (params.opcDa as OpcDaDefinition).tags = ['tag'];

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC DA: Both listTags and tags have a value', () => {
  (params.opcDa as OpcDaDefinition).machineIp = '10.0.0.0';
  (params.opcDa as OpcDaDefinition).listTags = ['tag'];
  (params.opcDa as OpcDaDefinition).tags = ['tag'];

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC UA: Every default value is valid', () => {
  delete params.opcDa;
  params.protocol = MachineProtocol.OPCUA;
  params.opcUa = {
    serverName: 'Valid.Server.Name',
    machineIp: '1.2.3.4'
  };

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC UA: Server name is empty', () => {
  delete params.opcDa;
  params.protocol = MachineProtocol.OPCUA;
  (params.opcUa as OpcUaDefinition).serverName = '  ';

  expect(validateConnectionDefinition(params)).toEqual({
    opcUa_serverName: I18n.get('invalid.server.name')
  });
});

test('OPC UA: Server name is longer than 256 characters', () => {
  (params.opcUa as OpcUaDefinition).serverName = Array(258).join('a');

  expect(validateConnectionDefinition(params)).toEqual({
    opcUa_serverName: I18n.get('invalid.server.name')
  });
});

test('OPC UA: Machine IP is invalid', () => {
  (params.opcUa as OpcUaDefinition).serverName = 'Valid.Server.Name';
  (params.opcUa as OpcUaDefinition).machineIp = '256.256.256.256';

  expect(validateConnectionDefinition(params)).toEqual({
    opcUa_machineIp: I18n.get('invalid.machine.ip')
  });
});

test('OPC UA: Port is undefined', () => {
  (params.opcUa as OpcUaDefinition).machineIp = '1.2.3.4';

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC UA: Port is an empty string', () => {
  (params.opcUa as OpcUaDefinition).port = '  ';

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('OPC UA: Port is not an integer', () => {
  (params.opcUa as OpcUaDefinition).port = '1.1';

  expect(validateConnectionDefinition(params)).toEqual({
    port: I18n.get('invalid.port')
  });
});

test('OPC UA: Port is less than the minimum value', () => {
  (params.opcUa as OpcUaDefinition).port = '0';

  expect(validateConnectionDefinition(params)).toEqual({
    port: I18n.get('invalid.port')
  });
});

test('OPC UA: Port is greater than the minimum value', () => {
  (params.opcUa as OpcUaDefinition).port = '65536';

  expect(validateConnectionDefinition(params)).toEqual({
    port: I18n.get('invalid.port')
  });
});

test('OPC UA: Port is between the minimum value and the maximum value', () => {
  (params.opcUa as OpcUaDefinition).port = '80';

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Modbus TCP: Port is between the minimum value and the maximum value', () => {
  delete params.opcUa;
  params.protocol = MachineProtocol.MODBUSTCP;
  params.modbusTcp = {
    host: 'mock-host',
    hostPort: 1,
    hostTag: 'mock-tag',
    modbusSlavesConfigSerialized:
      '[{"slaveAddress":1,"frequencyInSeconds":1,"commandConfig":{"readCoils":{"address":1,"count":1}}}]',
    modbusSlavesConfig: [
      {
        slaveAddress: 1,
        frequencyInSeconds: 1,
        commandConfig: {
          readCoils: {
            address: 1,
            count: 1
          }
        }
      }
    ]
  };

  (params.modbusTcp as ModbusTcpDefinition).hostPort = '5020';

  expect(validateConnectionDefinition(params)).toEqual({});
});

test('Modbus TCP: Port is greater than the minimum value', () => {
  (params.modbusTcp as ModbusTcpDefinition).hostPort = '65536';

  expect(validateConnectionDefinition(params)).toEqual({
    modbusTcp_hostPort: I18n.get('invalid.port')
  });

  (params.modbusTcp as ModbusTcpDefinition).hostPort = '5020';
});

test('Modbus TCP: Host tag is longer than 256 characters', () => {
  (params.modbusTcp as ModbusTcpDefinition).hostTag = Array(258).join('a');

  expect(validateConnectionDefinition(params)).toEqual({
    modbusTcp_hostTag: I18n.get('invalid.host.tag')
  });

  (params.modbusTcp as ModbusTcpDefinition).hostTag = 'valid-tag';
});

test('Modbus TCP: Slave Config is invalid', () => {
  (params.modbusTcp as ModbusTcpDefinition).modbusSlavesConfigSerialized =
    '[{"slaveAddress":"invalid","frequencyInSeconds":"1","commandConfig":{"readCoils":{"address":"1","count":"1"}}}]';

  expect(validateConnectionDefinition(params)).toEqual({
    modbusTcp_modbusSlavesConfigSerialized: I18n.get('modbus.tcp.invalid.json')
  });
});

test('Other protocol: It should not have an error', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params.protocol = 'unsupported' as any;

  expect(validateConnectionDefinition(params)).toEqual({});
});
