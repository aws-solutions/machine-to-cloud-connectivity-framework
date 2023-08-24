// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { fireEvent, queryByAttribute, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConnectionForm from '../connection/ConnectionForm';
import Dashboard from '../connection/Dashboard';
import {
  ConnectionControl,
  GetConnectionResponse,
  ListConnectionsResponse,
  ListLogsResponse,
  LogType,
  MachineProtocol
} from '../../util/types';
import { API_NAME } from '../../util/utils';

// Mock API
const mockAPI = {
  get: jest.fn(),
  post: jest.fn()
};
jest.mock('@aws-amplify/api');
API.get = mockAPI.get;
API.post = mockAPI.post;

const getById = queryByAttribute.bind(null, 'id');
const response: ListConnectionsResponse = {
  connections: [
    {
      connectionName: 'mock-connection-1',
      machineName: 'mock-machine-1',
      protocol: MachineProtocol.OPCDA,
      status: ConnectionControl.START,
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: true,
      sendDataToKinesisDataStreams: false
    },
    {
      connectionName: 'mock-connection-2',
      machineName: 'mock-machine-2',
      protocol: MachineProtocol.OPCUA,
      status: ConnectionControl.STOP,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true
    },
    {
      connectionName: 'mock-connection-3',
      machineName: 'mock-machine-3',
      protocol: MachineProtocol.OSIPI,
      status: ConnectionControl.STOP,
      sendDataToIoTSiteWise: true,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true
    }
  ]
};
const updateResponse: GetConnectionResponse = {
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
  }
};
const logResponse: ListLogsResponse = {
  logs: [
    {
      connectionName: 'mock-connection-id',
      logType: LogType.INFO,
      timestamp: new Date(0).getTime(),
      message: JSON.stringify({ message: 'info message' })
    },
    {
      connectionName: 'mock-connection-id',
      logType: LogType.ERROR,
      timestamp: new Date(0).getTime(),
      message: JSON.stringify({ message: 'error message' })
    }
  ]
};

beforeEach(() => {
  mockAPI.get.mockReset();
  mockAPI.post.mockReset();
});

test('renders the Dashboard component when connections are empty', async () => {
  mockAPI.get.mockResolvedValueOnce({ connections: [] });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'empty-connection-jumbotron');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when getting connections fails', async () => {
  mockAPI.get.mockRejectedValueOnce('Error');
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'empty-connection-jumbotron');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when connections exist', async () => {
  mockAPI.get.mockResolvedValueOnce(response);
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('renders the Dashboard component when connections and the next token exist ', async () => {
  mockAPI.get.mockResolvedValueOnce({
    ...response,
    nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
  });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(dashboard.container).toMatchSnapshot();
});

test('tests next and prev buttons', async () => {
  mockAPI.get
    .mockResolvedValueOnce({
      ...response,
      nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
    })
    .mockResolvedValueOnce({
      ...response,
      nextToken: JSON.stringify({ connectionName: 'mock-connection-3' })
    })
    .mockResolvedValueOnce({ ...response, nextToken: undefined })
    .mockResolvedValueOnce({
      ...response,
      nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
    });

  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByText(I18n.get('next.page')));
    await waitFor(() => {
      getById(dashboard.container, 'connections-table');
    });
  }

  fireEvent.click(screen.getByText(I18n.get('prev.page')));
  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(4);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/connections', {
    queryStringParameters: {
      nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
    }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(3, API_NAME, '/connections', {
    queryStringParameters: {
      nextToken: JSON.stringify({ connectionName: 'mock-connection-3' })
    }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(4, API_NAME, '/connections', {
    queryStringParameters: {
      nextToken: JSON.stringify({ connectionName: 'mock-connection-2' })
    }
  });
});

test('tests refresh button', async () => {
  mockAPI.get.mockResolvedValueOnce(response);
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  fireEvent.click(screen.getByText(I18n.get('refresh')));
  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
}, 10000);

test('tests create connection button', async () => {
  mockAPI.get.mockResolvedValueOnce({ connections: [] });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  fireEvent.click(screen.getByText(I18n.get('create.connection')));
  await waitFor(() => {
    screen.findByText('mock-connection-id');
  });

  expect(screen.findByText('mock-connection-id')).not.toBeNull();
});

test('tests stop button', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValue({ connections: [connection] });
  mockAPI.post.mockResolvedValueOnce({ connectionName: connection.connectionName });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  fireEvent.click(screen.getByText(I18n.get('stop')));
  await waitFor(() => {
    screen.findByText(I18n.get('info.message.stop.connection'));
  });

  fireEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: { connectionName: connection.connectionName, control: ConnectionControl.STOP, protocol: connection.protocol }
  });
});

test('tests start button', async () => {
  const connection = response.connections[1];
  mockAPI.get.mockResolvedValue({ connections: [connection] });
  mockAPI.post.mockResolvedValueOnce({ connectionName: connection.connectionName });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  fireEvent.click(screen.getByText(I18n.get('start')));
  await waitFor(() => {
    screen.findByText(I18n.get('info.message.start.connection'));
  });

  fireEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: { connectionName: connection.connectionName, control: ConnectionControl.START, protocol: connection.protocol }
  });
});

test('tests update connection button', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValueOnce({ connections: [connection] }).mockResolvedValueOnce(updateResponse);
  const dashboard = render(
    <MemoryRouter initialEntries={['/', `/connection/${connection.connectionName}`]} initialIndex={0}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  const manageConnectionButton = getById(dashboard.container, `manage-connection-${connection.connectionName}`);
  expect(manageConnectionButton).not.toBeNull();

  fireEvent.click(manageConnectionButton as Element);
  await waitFor(() => {
    screen.findByText(I18n.get('update.connection'));
  });

  expect(screen.getByText(I18n.get('update.connection'))).not.toBeNull();
  fireEvent.click(screen.getByText(I18n.get('update.connection')));

  await waitFor(() => {
    screen.findByText(connection.connectionName);
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, `/connections/${connection.connectionName}`, {});
});

test('tests check connectivity button', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValueOnce({ connections: [connection] });
  mockAPI.post.mockResolvedValueOnce({ connectionName: connection.connectionName });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  const manageConnectionButton = getById(dashboard.container, `manage-connection-${connection.connectionName}`);
  expect(manageConnectionButton).not.toBeNull();

  fireEvent.click(manageConnectionButton as Element);
  await waitFor(() => {
    screen.findByText(I18n.get('check.connectivity'));
  });

  expect(screen.getByText(I18n.get('check.connectivity'))).not.toBeNull();
  fireEvent.click(screen.getByText(I18n.get('check.connectivity')));

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: { connectionName: connection.connectionName, control: ConnectionControl.PUSH, protocol: connection.protocol }
  });
});

test('tests get connection configuration button', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValueOnce({ connections: [connection] });
  mockAPI.post.mockResolvedValueOnce({ connectionName: connection.connectionName });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  const manageConnectionButton = getById(dashboard.container, `manage-connection-${connection.connectionName}`);
  expect(manageConnectionButton).not.toBeNull();

  fireEvent.click(manageConnectionButton as Element);
  await waitFor(() => {
    screen.findByText(I18n.get('get.connection.configuration'));
  });

  expect(screen.getByText(I18n.get('get.connection.configuration'))).not.toBeNull();
  fireEvent.click(screen.getByText(I18n.get('get.connection.configuration')));

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: { connectionName: connection.connectionName, control: ConnectionControl.PULL, protocol: connection.protocol }
  });
});

test('tests view connection logs button', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValueOnce({ connections: [connection] }).mockResolvedValueOnce({ logs: logResponse });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  const manageConnectionButton = getById(dashboard.container, `manage-connection-${connection.connectionName}`);
  expect(manageConnectionButton).not.toBeNull();

  fireEvent.click(manageConnectionButton as Element);
  await waitFor(() => {
    screen.findByText(I18n.get('view.connection.logs'));
  });

  expect(screen.getByText(I18n.get('view.connection.logs'))).not.toBeNull();
  fireEvent.click(screen.getByText(I18n.get('view.connection.logs')));

  await waitFor(() => {
    getById(dashboard.container, 'connection-logs-table');
  });

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, `/logs/${connection.connectionName}`, {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests API errors to manage connection, only demonstrates STOP', async () => {
  const connection = response.connections[0];
  mockAPI.get.mockResolvedValue({ connections: [connection] });
  mockAPI.post.mockRejectedValueOnce({ message: 'API Failure' });
  const dashboard = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard region="mock-region" />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    getById(dashboard.container, 'connections-table');
  });

  fireEvent.click(screen.getByText(I18n.get('stop')));
  await waitFor(() => {
    screen.findByText(I18n.get('error.message.control.connection'));
  });

  fireEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/connections', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: { connectionName: connection.connectionName, control: ConnectionControl.STOP, protocol: connection.protocol }
  });
});
