// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { GetConnectionResponse, MachineProtocol } from '../../util/Types';
import { INIT_CONNECTION } from '../../util/Utils';
import OpcDaForm from '../OpcDaForm';

test('renders the default OpcDaForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcDaForm = render(<OpcDaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcDaForm.container).toMatchSnapshot();
});

test('renders the OpcDaFrom with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    protocol: MachineProtocol.OPCDA,
    sendDataToIoTSitewise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
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
    listTags: 'listTag1.*\nlistTag2.*',
    tags: 'tag1\ntag2'
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
  const opcDaForm = render(<OpcDaForm connection={connection} onChange={() => console.log('changed')} errors={errors} />);
  expect(opcDaForm.container).toMatchSnapshot();
});