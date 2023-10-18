// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OpcUaForm from '../connection/OpcUaForm';
import { GetConnectionResponse, MachineProtocol } from '../../util/types';
import { INIT_CONNECTION } from '../../util/utils';

test('renders the default OpcUaForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcUaForm = render(<OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcUaForm.container).toMatchSnapshot();
});

test('renders the OpcUaForm with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    greengrassCoreDeviceName: 'mock-greengrass-device-name',
    protocol: MachineProtocol.OPCUA,
    sendDataToIoTSiteWise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    sendDataToTimestream: true,
    area: 'mock-area',
    machineName: 'mock-machine',
    opcUa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcua-server-name',
      port: 1234
    }
  };

  const opcUaForm = render(<OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcUaForm.container).toMatchSnapshot();
});

test('renders the OpcUaForm errors', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const errors = {
    connectionName: 'connectionName invalid',
    sendDataTo: 'sendDataTo invalid',
    opcUaServerName: 'serverName invalid',
    opcUaMachineIp: 'machineIp invalid',
    tags: 'tags invalid'
  };
  const opcUaForm = render(
    <OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={errors} />
  );
  expect(opcUaForm.container).toMatchSnapshot();
});

test('tests handleValueChange function', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcUaForm = render(<OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  const input = opcUaForm.getByPlaceholderText(I18n.get('placeholder.opcua.server.name'));
  userEvent.type(input, 'server');
  expect((input as HTMLInputElement).value).toEqual('server');
});
