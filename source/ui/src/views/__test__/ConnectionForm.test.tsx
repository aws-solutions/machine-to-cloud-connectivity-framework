// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { MemoryRouter, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { GetConnectionResponse, MachineProtocol } from '../../util/Types';
import { API_NAME } from '../../util/Utils';
import ConnectionForm from '../ConnectionForm';

// Mock API
const mockAPI = {
  get: jest.fn()
};
jest.mock('@aws-amplify/api');
API.get = mockAPI.get;

beforeEach(() => {
  mockAPI.get.mockReset();
});

test('renders the connection form component for the new connection', async () => {
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection']}>
      <Route exact path="/connection" render={() => <ConnectionForm />} />
    </MemoryRouter>
  );
  expect(mockAPI.get).not.toHaveBeenCalled();
  expect(connectionForm.container).toMatchSnapshot();
});

test('renders the connection modal component for the update connection', async () => {
  const response: GetConnectionResponse = {
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
    }
  };
  mockAPI.get.mockResolvedValueOnce(response);
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection/mock-connection-id']}>
      <Route exact path="/connection/:connectionName" render={() => <ConnectionForm />} />
    </MemoryRouter>
  );

  await waitFor(() => {
    screen.findByText('mock-connection-id');
  });
  expect(connectionForm.container).toMatchSnapshot();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections/mock-connection-id', {});
});

test('renders the connection modal component for the update connection when getting a connection fails', async () => {
  mockAPI.get.mockRejectedValueOnce('Error');
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection/mock-connection-id']}>
      <Route exact path="/connection/:connectionName" render={() => <ConnectionForm />} />
    </MemoryRouter>
  );

  await waitFor(() => {
    screen.findByText(I18n.get('error.message.get.connection'));
  });
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections/mock-connection-id', {});
  expect(connectionForm.container).toMatchSnapshot();
});