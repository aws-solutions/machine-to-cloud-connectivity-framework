// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { queryByAttribute, render, screen, waitFor } from '@testing-library/react';
import { ConnectionLogsModalProps, ListLogsResponse, LogType } from '../../util/Types';
import ConnectionLogsModal from '../ConnectionLogsModal';

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

test('renders the connection message modal component when connection logs are empty', async () => {
  const response: ListLogsResponse = { logs: [] };
  mockAPI.get.mockResolvedValueOnce(response);
  const props: ConnectionLogsModalProps = {
    show: true,
    hide: () => console.log('hide'),
    connectionName: 'mock-connection-id'
  };
  const connectionMessageModal = render(<ConnectionLogsModal {...props} />);

  await waitFor(() => {
    getById(connectionMessageModal.container, 'empty-logs-jumbotron');
  });
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/logs/mock-connection-id', { queryStringParameters: { nextToken: undefined } });
  expect(connectionMessageModal.baseElement).toMatchSnapshot();
});

test('renders the connection message modal component when getting connection logs fails', async () => {
  mockAPI.get.mockRejectedValueOnce('Error');
  const props: ConnectionLogsModalProps = {
    show: true,
    hide: () => console.log('hide'),
    connectionName: 'mock-connection-id'
  };
  const connectionMessageModal = render(<ConnectionLogsModal {...props} />);

  await waitFor(() => {
    screen.findByText(I18n.get('error.message.get.logs'));
  });
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/logs/mock-connection-id', { queryStringParameters: { nextToken: undefined } });
  expect(connectionMessageModal.baseElement).toMatchSnapshot();
});

test('renders the connection message modal component when there are connection logs', async () => {
  const response: ListLogsResponse = {
    logs: [
      { connectionName: 'mock-connection-id', logType: LogType.INFO, timestamp: new Date(0).getTime(), message: JSON.stringify({ message: 'info message' }) },
      { connectionName: 'mock-connection-id', logType: LogType.ERROR, timestamp: new Date(0).getTime(), message: JSON.stringify({ message: 'error message' }) },
    ]
  };
  mockAPI.get.mockResolvedValueOnce(response);
  const props: ConnectionLogsModalProps = {
    show: true,
    hide: () => console.log('hide'),
    connectionName: 'mock-connection-id'
  };
  const connectionMessageModal = render(<ConnectionLogsModal {...props} />);

  await waitFor(() => {
    getById(connectionMessageModal.container, 'connection-logs-table');
  });
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith('M2C2Api', '/logs/mock-connection-id', { queryStringParameters: { nextToken: undefined } });
  expect(connectionMessageModal.baseElement).toMatchSnapshot();
});

test('renders the connection message modal component when there are connection logs and the next token', async () => {
  const response: ListLogsResponse = {
    logs: [
      { connectionName: 'mock-connection-id', logType: LogType.INFO, timestamp: new Date(0).getTime(), message: JSON.stringify({ message: 'info message' }) },
      { connectionName: 'mock-connection-id', logType: LogType.ERROR, timestamp: new Date(0).getTime(), message: JSON.stringify({ message: 'error message' }) },
    ],
    nextToken: JSON.stringify({ connectionName: 'mock-connection-id', timestamp: new Date(0).getTime() })
  };
  mockAPI.get.mockResolvedValueOnce(response);
  const props: ConnectionLogsModalProps = {
    show: true,
    hide: () => console.log('hide'),
    connectionName: 'mock-connection-id'
  };
  const connectionMessageModal = render(<ConnectionLogsModal {...props} />);

  await waitFor(() => {
    getById(connectionMessageModal.container, 'connection-logs-table');
  });
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, 'M2C2Api', '/logs/mock-connection-id', { queryStringParameters: { nextToken: undefined } });
  expect(connectionMessageModal.baseElement).toMatchSnapshot();
});