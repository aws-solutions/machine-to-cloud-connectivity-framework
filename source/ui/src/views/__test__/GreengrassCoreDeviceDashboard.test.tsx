// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom';
import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { Storage } from '@aws-amplify/storage';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreatedBy, GreengrassCoreDeviceControl, ListGreengrassCoreDevicesResponse } from '../../util/types';
import { API_NAME } from '../../util/utils';
import { OsPlatform } from '../../util/types';
import GreengrassCoreDevicesDashboard from '../greengrass/GreengrassCoreDevicesDashboard';
import GreengrassCoreDeviceForm from '../greengrass/GreengrassCoreDeviceForm';

const mockAPI = {
  get: jest.fn(),
  post: jest.fn()
};
API.get = mockAPI.get;
API.post = mockAPI.post;

const mockStorage = {
  get: jest.fn()
};
Storage.get = mockStorage.get;

const greengrassCoreDevicesResponse: ListGreengrassCoreDevicesResponse = {
  greengrassCoreDevices: [
    { name: 'mock-greengrass-1', createdBy: CreatedBy.SYSTEM, numberOfConnections: 0, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-2', createdBy: CreatedBy.USER, numberOfConnections: 1, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-3', createdBy: CreatedBy.SYSTEM, numberOfConnections: 2, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-4', createdBy: CreatedBy.USER, numberOfConnections: 3, osPlatform: OsPlatform.WINDOWS }
  ]
};
const error = { errorMessage: 'Failure' };
const url = 'https://example.com';

beforeEach(() => {
  mockAPI.get.mockReset();
  mockAPI.post.mockReset();
});

test('renders the Greengrass core device dashboard when no result', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(/info.message.no.greengrass.core.device/)).not.toBeNull();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('renders the Greengrass core device dashboard when there are results', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevicesResponse.greengrassCoreDevices[0].name)).not.toBeNull();
  expect(screen.getByText(I18n.get('prev.page')).closest('button')).toBeDisabled();
  expect(screen.getByText(I18n.get('next.page')).closest('button')).toBeDisabled();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('renders the Greengrass core device dashboard when there are results with next token', async () => {
  mockAPI.get.mockResolvedValueOnce({
    ...greengrassCoreDevicesResponse,
    nextToken: JSON.stringify(greengrassCoreDevicesResponse.greengrassCoreDevices[0])
  });
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevicesResponse.greengrassCoreDevices[0].name)).not.toBeNull();
  expect(screen.getByText(I18n.get('prev.page')).closest('button')).toBeDisabled();
  expect(screen.getByText(I18n.get('next.page')).closest('button')).not.toBeDisabled();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('renders the Greengrass core device dashboard with API failure', async () => {
  mockAPI.get.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests next and prev buttons', async () => {
  mockAPI.get
    .mockResolvedValueOnce({
      greengrassCoreDevices: [greengrassCoreDevicesResponse.greengrassCoreDevices[0]],
      nextToken: JSON.stringify(greengrassCoreDevicesResponse.greengrassCoreDevices[0])
    })
    .mockResolvedValueOnce({
      greengrassCoreDevices: [greengrassCoreDevicesResponse.greengrassCoreDevices[1]],
      nextToken: JSON.stringify(greengrassCoreDevicesResponse.greengrassCoreDevices[1])
    })
    .mockResolvedValueOnce({
      greengrassCoreDevices: [greengrassCoreDevicesResponse.greengrassCoreDevices[0]],
      nextToken: JSON.stringify(greengrassCoreDevicesResponse.greengrassCoreDevices[0])
    });

  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevicesResponse.greengrassCoreDevices[0].name)).not.toBeNull();
  expect(screen.getByText(I18n.get('prev.page')).closest('button')).toBeDisabled();
  expect(screen.getByText(I18n.get('next.page')).closest('button')).not.toBeDisabled();

  userEvent.click(screen.getByText(I18n.get('next.page')));
  expect(await screen.findByText(greengrassCoreDevicesResponse.greengrassCoreDevices[1].name)).not.toBeNull();
  expect(screen.getByText(I18n.get('prev.page')).closest('button')).not.toBeDisabled();
  expect(screen.getByText(I18n.get('next.page')).closest('button')).not.toBeDisabled();

  userEvent.click(screen.getByText(I18n.get('prev.page')));
  expect(await screen.findByText(greengrassCoreDevicesResponse.greengrassCoreDevices[0].name)).not.toBeNull();
  expect(screen.getByText(I18n.get('prev.page')).closest('button')).toBeDisabled();
  expect(screen.getByText(I18n.get('next.page')).closest('button')).not.toBeDisabled();

  expect(mockAPI.get).toHaveBeenCalledTimes(3);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: JSON.stringify(greengrassCoreDevicesResponse.greengrassCoreDevices[0]) }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(3, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests deregister button success', async () => {
  const greengrassCoreDevice = greengrassCoreDevicesResponse.greengrassCoreDevices[0];
  mockAPI.get
    .mockResolvedValueOnce({
      greengrassCoreDevices: [greengrassCoreDevice]
    })
    .mockResolvedValueOnce({ greengrassCoreDevices: [] });
  mockAPI.post.mockResolvedValueOnce({ message: 'Success' });
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevice.name)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('deregister')));
  expect(await screen.findByText(/warning.message.deregister.greengrass.core.device/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText('Success')).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    body: {
      name: greengrassCoreDevice.name,
      control: GreengrassCoreDeviceControl.DELETE,
      createdBy: greengrassCoreDevice.createdBy,
      osPlatform: greengrassCoreDevice.osPlatform
    }
  });
});

test('tests deregister button failure', async () => {
  const greengrassCoreDevice = greengrassCoreDevicesResponse.greengrassCoreDevices[0];
  mockAPI.get.mockResolvedValueOnce({
    greengrassCoreDevices: [greengrassCoreDevice]
  });
  mockAPI.post.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevice.name)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('deregister')));
  expect(await screen.findByText(/warning.message.deregister.greengrass.core.device/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    body: {
      name: greengrassCoreDevice.name,
      control: GreengrassCoreDeviceControl.DELETE,
      createdBy: greengrassCoreDevice.createdBy,
      osPlatform: greengrassCoreDevice.osPlatform
    }
  });
});

test('tests download install script button success', async () => {
  const { open } = window;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete window.open;
  window.open = jest.fn();

  const greengrassCoreDevice = greengrassCoreDevicesResponse.greengrassCoreDevices[0];
  mockAPI.get.mockResolvedValueOnce({
    greengrassCoreDevices: [greengrassCoreDevice]
  });
  mockStorage.get.mockResolvedValueOnce(url);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevice.name)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('download.install.script')));
  expect(await screen.findByText(/info.message.download.greengrass.core.device.install.script/)).not.toBeNull();
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(window.open).toHaveBeenCalledWith(url, '_blank');

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockStorage.get).toHaveBeenCalledTimes(1);
  expect(mockStorage.get).toHaveBeenCalledWith(`${greengrassCoreDevice.name}.sh`, { expires: 10 });

  window.open = open;
});

test('tests download install script button failure', async () => {
  const greengrassCoreDevice = greengrassCoreDevicesResponse.greengrassCoreDevices[0];
  mockAPI.get.mockResolvedValueOnce({
    greengrassCoreDevices: [greengrassCoreDevice]
  });
  mockStorage.get.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevice.name)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('download.install.script')));
  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockStorage.get).toHaveBeenCalledTimes(1);
  expect(mockStorage.get).toHaveBeenCalledWith(`${greengrassCoreDevice.name}.sh`, { expires: 10 });
}, 10000);

test('tests not showing download install script button for USER Greengrass core device', async () => {
  const greengrassCoreDevice = greengrassCoreDevicesResponse.greengrassCoreDevices[1];
  mockAPI.get.mockResolvedValueOnce({
    greengrassCoreDevices: [greengrassCoreDevice]
  });
  mockStorage.get.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(greengrassCoreDevice.name)).not.toBeNull();
  expect(screen.queryByText(I18n.get('download.install.script'))).toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests register Greengrass core device button', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  render(
    <MemoryRouter initialEntries={['/greengrass']}>
      <Routes>
        <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(/info.message.no.greengrass.core.device/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('register.greengrass.core.device')));
  expect(await screen.findByText(/register.greengrass.core.device/)).not.toBeNull();
});
