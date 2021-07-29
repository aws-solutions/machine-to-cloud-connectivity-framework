// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { GetConnectionResponse, MachineProtocol } from '../../util/Types';
import { INIT_CONNECTION } from '../../util/Utils';
import OpcUaForm from '../OpcUaForm';

test('renders the default OpcUaForm', async () => {
  const connection: GetConnectionResponse = INIT_CONNECTION;
  const opcUaForm = render(<OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={{}} />);
  expect(opcUaForm.container).toMatchSnapshot();
});

test('renders the OpcUaForm with the existing connection', async () => {
  const connection: GetConnectionResponse = {
    connectionName: 'mock-connection-id',
    protocol: MachineProtocol.OPCUA,
    sendDataToIoTSitewise: true,
    sendDataToIoTTopic: true,
    sendDataToKinesisDataStreams: true,
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
  const opcUaForm = render(<OpcUaForm connection={connection} onChange={() => console.log('changed')} errors={errors} />);
  expect(opcUaForm.container).toMatchSnapshot();
});