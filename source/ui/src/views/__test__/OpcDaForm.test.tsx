// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OpcDaForm from '../connection/OpcDaForm';
import { GetConnectionResponse, MachineProtocol } from '../../util/types';
import { INIT_CONNECTION } from '../../util/utils';

test('renders the default OpcDaForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcDaForm = render(<OpcDaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcDaForm.container).toMatchSnapshot();
});

test('renders the OpcDaFrom with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    greengrassCoreDeviceName: 'mock-greengrass-device-name',
    protocol: MachineProtocol.OPCDA,
    sendDataToIoTSiteWise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    sendDataToTimestream: true,
    area: 'mock-area',
    machineName: 'mock-machine',
    opcDa: {
      machineIp: '1.2.3.4',
      serverName: 'mock-opcda-server-name',
      iterations: 3,
      interval: 3,
      listTags: ['listTag1.*', 'listTag2.*'],
      tags: ['tag1', 'tag2']
    },
    opcDaListTags: 'listTag1.*\nlistTag2.*',
    opcDaTags: 'tag1\ntag2'
  };

  const opcDaForm = render(<OpcDaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcDaForm.container).toMatchSnapshot();
});

test('renders the OpcDaFrom errors', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const errors = {
    connectionName: 'connectionName invalid',
    sendDataTo: 'sendDataTo invalid',
    iterations: 'iterations invalid',
    timeInterval: 'timeInterval invalid',
    opcDaServerName: 'serverName invalid',
    opcDaMachineIp: 'machineIp invalid',
    tags: 'tags invalid'
  };
  const opcDaForm = render(
    <OpcDaForm connection={connection} onChange={() => console.log('changed')} errors={errors} />
  );
  expect(opcDaForm.container).toMatchSnapshot();
});

test('tests handleValueChange function', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcDaForm = render(<OpcDaForm connection={connection} onChange={event => console.log(event)} errors={{}} />);
  const input = opcDaForm.getByPlaceholderText(I18n.get('placeholder.iterations'));
  userEvent.type(input, '1');
  expect((input as HTMLInputElement).value).toEqual('1');
});
