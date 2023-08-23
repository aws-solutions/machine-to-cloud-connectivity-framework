// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModbusTcpForm from '../connection/ModbusTcpForm';
import { GetConnectionResponse, MachineProtocol } from '../../util/types';
import { INIT_CONNECTION } from '../../util/utils';

test('renders the default ModbusTcpForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const modbusTcpForm = render(
    <ModbusTcpForm connection={connection} onChange={() => console.log('changed')} errors={{}} />
  );
  expect(modbusTcpForm.container).toMatchSnapshot();
});

test('renders the ModbusTcpForm with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    greengrassCoreDeviceName: 'mock-greengrass-device-name',
    protocol: MachineProtocol.MODBUSTCP,
    sendDataToIoTSiteWise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    sendDataToTimestream: false,
    sendDataToHistorian: true,
    area: 'mock-area',
    machineName: 'mock-machine',
    modbusTcp: {
      host: 'mock-host',
      hostPort: 1,
      hostTag: 'mock-tag',
      modbusSecondariesConfigSerialized: 'mock-serialized',
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
  };

  const modbusTcpForm = render(
    <ModbusTcpForm connection={connection} onChange={() => console.log('changed')} errors={{}} />
  );
  expect(modbusTcpForm.container).toMatchSnapshot();
});

test('renders the ModbusTcpForm errors', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const errors = {
    connectionName: 'connectionName invalid',
    sendDataTo: 'sendDataTo invalid',
    modbusTcp_host: 'modbusTcp_host invalid',
    modbusTcp_hostPort: 'modbusTcp_hostPort invalid',
    modbusTcp_hostTag: 'modbusTcp_hostTag invalid',
    modbusTcp_modbusSecondariesConfigSerialized: 'modbusTcp_modbusSecondariesConfigSerialized invalid'
  };
  const modbusTcpForm = render(
    <ModbusTcpForm connection={connection} onChange={() => console.log('changed')} errors={errors} />
  );
  expect(modbusTcpForm.container).toMatchSnapshot();
});

test('tests handleValueChange function', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const modbusTcpForm = render(
    <ModbusTcpForm connection={connection} onChange={() => console.log('changed')} errors={{}} />
  );
  const input = modbusTcpForm.getByPlaceholderText(I18n.get('placeholder.modbus.tcp.host'));
  userEvent.type(input, '127.0.0.1');
  expect((input as HTMLInputElement).value).toEqual('127.0.0.1');
});
