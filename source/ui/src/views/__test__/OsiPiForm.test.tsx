// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OsiPiForm from '../connection/OsiPiForm';
import { GetConnectionResponse, MachineProtocol, OsiPiAuthMode } from '../../util/types';
import { INIT_CONNECTION } from '../../util/utils';

test('renders the default OsiPiForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const osiPiForm = render(<OsiPiForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(osiPiForm.container).toMatchSnapshot();
});

test('renders the OsiPiForm with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    greengrassCoreDeviceName: 'mock-greengrass-device-name',
    protocol: MachineProtocol.OSIPI,
    sendDataToIoTSiteWise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
    sendDataToTimestream: true,
    sendDataToHistorian: true,
    area: 'mock-area',
    machineName: 'mock-machine',
    osiPi: {
      apiUrl: 'https://osiPiServer/piwebapi',
      verifySSL: true,
      serverName: 'mock-server',
      authMode: OsiPiAuthMode.BASIC,
      username: 'mock-user',
      password: 'mock-password',
      requestFrequency: 5,
      catchupFrequency: 0.1,
      maxRequestDuration: 60,
      queryOffset: 0,
      tags: ['tag1', 'tag2']
    },
    osiPiTags: 'tag1\ntag2'
  };

  const osiPiForm = render(<OsiPiForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(osiPiForm.container).toMatchSnapshot();
});

test('renders the OsiPiForm errors', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const errors = {
    connectionName: 'connectionName invalid',
    sendDataTo: 'sendDataTo invalid',
    apiUrl: 'apiUrl invalid',
    serverName: 'serverName invalid',
    username: 'username invalid',
    password: 'password invalid',
    requestFrequency: 'requestFrequency invalid',
    catchupFrequency: 'maxCatchupFrequency invalid',
    maxRequestDuration: 'maxRequestDuration invalid',
    queryOffset: 'queryOffset invalid',
    tags: 'tags invalid'
  };
  const osiPiForm = render(
    <OsiPiForm connection={connection} onChange={() => console.log('changed')} errors={errors} />
  );
  expect(osiPiForm.container).toMatchSnapshot();
});

test('tests handleValueChange function', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const osiPiForm = render(<OsiPiForm connection={connection} onChange={event => console.log(event)} errors={{}} />);
  const input = osiPiForm.getByPlaceholderText(I18n.get('placeholder.osiPi.requestFrequency'));
  userEvent.type(input, '{backspace}60');
  expect((input as HTMLInputElement).value).toEqual('60');
});
