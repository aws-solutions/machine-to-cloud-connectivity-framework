// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { queryByAttribute, render, waitFor } from '@testing-library/react';
import { ConnectionControl, ListConnectionsResponse, MachineProtocol } from '../../util/Types';
import Dashboard from '../Dashboard';

// Mock API
const mockAPI = {
  get: jest.fn()
};
jest.mock('@aws-amplify/api');
API.get = mockAPI.get;

const getById = queryByAttribute.bind(null, 'id');

beforeEach(() => {
  mockAPI.get.mockReset();
});

test('renders the Dashboard component when connections are empty', async () => {
  const response: ListConnectionsResponse = { connections: [] };
  mockAPI.get.mockResolvedValueOnce(response);
  const dashboard = render(<Dashboard region="mock-region" />);

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/connections', { queryStringParameters: { nextToken: undefined } });

  await waitFor(() => {
    getById(dashboard.container, 'empty-connection-jumbotron');
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when getting connections fails', async () => {
  mockAPI.get.mockRejectedValueOnce('Error');
  const dashboard = render(<Dashboard region="mock-region" />);

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/connections', { queryStringParameters: { nextToken: undefined } });

  await waitFor(() => {
    getById(dashboard.container, 'empty-connection-jumbotron');
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when connections exist', async () => {
  const response: ListConnectionsResponse = {
    connections: [
      {
        connectionName: 'mock-connection-1',
        machineName: 'mock-machine-1',
        protocol: MachineProtocol.OPCDA,
        status: ConnectionControl.START,
        sendDataToIoTSitewise: false,
        sendDataToIoTTopic: true,
        sendDataToKinesisDataStreams: false
      },
      {
        connectionName: 'mock-connection-2',
        machineName: 'mock-machine-2',
        protocol: MachineProtocol.OPCUA,
        status: ConnectionControl.STOP,
        sendDataToIoTSitewise: true,
        sendDataToIoTTopic: false,
        sendDataToKinesisDataStreams: true
      }
    ]
  };
  mockAPI.get.mockResolvedValueOnce(response);
  const dashboard = render(<Dashboard region="mock-region" />);

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/connections', { queryStringParameters: { nextToken: undefined } });

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when connections and the next token exist ', async () => {
  const response: ListConnectionsResponse = {
    connections: [
      {
        connectionName: 'mock-connection-1',
        machineName: 'mock-machine-1',
        protocol: MachineProtocol.OPCDA,
        status: ConnectionControl.START,
        sendDataToIoTSitewise: false,
        sendDataToIoTTopic: true,
        sendDataToKinesisDataStreams: false
      },
      {
        connectionName: 'mock-connection-2',
        machineName: 'mock-machine-2',
        protocol: MachineProtocol.OPCUA,
        status: ConnectionControl.STOP,
        sendDataToIoTSitewise: true,
        sendDataToIoTTopic: false,
        sendDataToKinesisDataStreams: true
      }
    ],
    nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
  };
  mockAPI.get.mockResolvedValueOnce(response);
  const dashboard = render(<Dashboard region="mock-region" />);

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/connections', { queryStringParameters: { nextToken: undefined } });

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });
  expect(dashboard.container).toMatchSnapshot();
});