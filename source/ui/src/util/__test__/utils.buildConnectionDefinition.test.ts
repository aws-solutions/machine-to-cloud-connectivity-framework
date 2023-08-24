// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../types';
import { buildConnectionDefinition } from '../utils';

const params: ConnectionDefinition = {
  control: ConnectionControl.START,
  connectionName: 'mock-connection-id',
  protocol: MachineProtocol.OPCDA
};

test('Test default parameters', () => {
  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: 'opcda'
  });
});

test('Test invalid protocol', () => {
  params.control = ConnectionControl.DEPLOY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params.protocol = 'invalid' as any;

  expect(buildConnectionDefinition(params)).toEqual({
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

  expect(buildConnectionDefinition(params)).toEqual({
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

  expect(buildConnectionDefinition(params)).toEqual({
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

  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name'
    }
  });
});

test('Test parameters including sendDataToIoTSiteWise', () => {
  params.sendDataToIoTSiteWise = false;

  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name'
    },
    sendDataToIoTSiteWise: false
  });
});

test('Test parameters including sendDataToIoTTopic', () => {
  params.sendDataToIoTTopic = true;

  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name'
    },
    sendDataToIoTSiteWise: false,
    sendDataToIoTTopic: true
  });
});

test('Test parameters including sendDataToKinesisDataStreams', () => {
  params.sendDataToKinesisDataStreams = true;

  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: MachineProtocol.OPCUA,
    opcUa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name'
    },
    sendDataToIoTSiteWise: false,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true
  });
});

test('Test Modbus TCP protocol', () => {
  delete params.opcUa;
  params.control = ConnectionControl.UPDATE;
  params.protocol = MachineProtocol.MODBUSTCP;
  params.area = 'mock-area';
  params.greengrassCoreDeviceName = 'mock-device';
  params.historianKinesisDatastreamName = 'mock-stream';
  params.logLevel = 'INFO';
  params.machineName = 'mock-machine';
  params.process = 'mock-process';
  params.sendDataToHistorian = false;
  params.sendDataToIoTSiteWise = false;
  params.sendDataToIoTTopic = true;
  params.sendDataToKinesisDataStreams = true;
  params.sendDataToTimestream = false;
  params.siteName = 'mock-site';
  params.modbusTcp = {
    host: 'mock-host',
    hostPort: 1,
    hostTag: 'mock-tag',
    modbusSecondariesConfigSerialized:
      '[{"secondaryAddress":1,"frequencyInSeconds":1,"commandConfig":{"readCoils":{"address":1,"count":1}}}]',
    modbusSecondariesConfig: []
  };

  expect(buildConnectionDefinition(params)).toEqual({
    control: params.control,
    connectionName: params.connectionName,
    protocol: MachineProtocol.MODBUSTCP,
    area: 'mock-area',
    greengrassCoreDeviceName: 'mock-device',
    historianKinesisDatastreamName: 'mock-stream',
    logLevel: 'INFO',
    machineName: 'mock-machine',
    process: 'mock-process',
    sendDataToHistorian: false,
    sendDataToIoTSiteWise: false,
    sendDataToKinesisDataStreams: true,
    sendDataToTimestream: false,
    sendDataToIoTTopic: true,
    siteName: 'mock-site',
    modbusTcp: {
      host: 'mock-host',
      hostPort: 1,
      hostTag: 'mock-tag',
      modbusSecondariesConfigSerialized:
        '[{"secondaryAddress":1,"frequencyInSeconds":1,"commandConfig":{"readCoils":{"address":1,"count":1}}}]',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readCoils: {
              address: 1,
              count: 1
            }
          }
        }
      ]
    }
  });
});
