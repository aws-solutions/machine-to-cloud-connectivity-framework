// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GreengrassCoreDeviceForm from '../greengrass/GreengrassCoreDeviceForm';
import { CreatedBy, GreengrassCoreDeviceControl, OsPlatform, UserGreengrassCoreDeviceResponse } from '../../util/types';
import { API_NAME } from '../../util/utils';

const mockAPI = {
  get: jest.fn(),
  post: jest.fn()
};
API.get = mockAPI.get;
API.post = mockAPI.post;

const greengrassCoreDeviceName = 'mock-greengrass-core-device';
const userGreengrassCoreDeviceResponse: UserGreengrassCoreDeviceResponse = {
  greengrassCoreDevices: [
    { coreDeviceThingName: 'mock-greengrass-1', status: 'HEALTHY' },
    { coreDeviceThingName: 'mock-greengrass-2', status: 'UNHEALTHY' },
    { coreDeviceThingName: 'mock-greengrass-3', status: 'HEALTHY' }
  ]
};

beforeEach(() => {
  mockAPI.get.mockReset();
  mockAPI.post.mockReset();
});

test('renders the Greengrass core device form by default', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  const greengrassCoreDeviceForm = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );
  expect(greengrassCoreDeviceForm.container).toMatchSnapshot();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass/user', {});
});

test('renders the Greengrass core device form by default with API failure', async () => {
  mockAPI.get.mockRejectedValueOnce({ message: 'GET failure' });
  render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(/error.message.get.greengrass.core.devices.user/)).not.toBeNull();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass/user', {});
});

test('tests cancel button', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass" />
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.queryByText(I18n.get('cancel'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('cancel')));
  expect(screen.queryByText(I18n.get('cancel'))).toBeNull();
});

test('tests handleValueChange function - category change when user Greengrass core devices are empty', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  const { getByTestId, getByText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getByTestId('category-select'), CreatedBy.USER);
  expect(
    (getByText(I18n.get('category.bring.existing.greengrass.core.device')) as HTMLOptionElement).selected
  ).toBeTruthy();
  expect(await screen.findByText(/no.available.greengrass.core.devices/)).not.toBeNull();
});

test('tests handleValueChange function - category change when user Greengrass core devices are not empty', async () => {
  mockAPI.get.mockResolvedValueOnce(userGreengrassCoreDeviceResponse);
  const { getByTestId, getByText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getByTestId('category-select'), CreatedBy.USER);
  expect(
    (getByText(I18n.get('category.bring.existing.greengrass.core.device')) as HTMLOptionElement).selected
  ).toBeTruthy();

  const mockDevice = userGreengrassCoreDeviceResponse.greengrassCoreDevices[0];
  expect(await screen.findByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`)).not.toBeNull();
}, 10000);

test('tests handleValueChange function - Greengrass core device name change with invalid value', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  const { getByPlaceholderText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );
  const input = getByPlaceholderText(I18n.get('placeholder.greengrass.core.device.name'));

  userEvent.type(input, '@@');
  expect((document.getElementById('greengrassCoreDeviceName') as HTMLInputElement).value).toEqual('@@');
  expect(await screen.findByText(/invalid.greengrass.core.device.name/)).not.toBeNull();
});

test('tests handleValueChange function - Greengrass core device name change with valid value', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  const { getByPlaceholderText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );
  const input = getByPlaceholderText(I18n.get('placeholder.greengrass.core.device.name'));

  userEvent.type(input, greengrassCoreDeviceName);
  expect((document.getElementById('greengrassCoreDeviceName') as HTMLInputElement).value).toEqual(
    greengrassCoreDeviceName
  );
});

test('tests handleGreengrassCoreDevice function - System', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  const { getByPlaceholderText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );
  const input = getByPlaceholderText(I18n.get('placeholder.greengrass.core.device.name'));

  userEvent.type(input, greengrassCoreDeviceName);
  expect((document.getElementById('greengrassCoreDeviceName') as HTMLInputElement).value).toEqual(
    greengrassCoreDeviceName
  );

  userEvent.click(screen.getByText(I18n.get('register')));
  expect(await screen.findByText(/info.message.register.greengrass.core.device/)).not.toBeNull();
}, 10000);

test('tests handleGreengrassCoreDevice function - User with HEALTHY device', async () => {
  mockAPI.get.mockResolvedValueOnce(userGreengrassCoreDeviceResponse);
  const { getByTestId, getByText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getByTestId('category-select'), CreatedBy.USER);
  expect(
    (getByText(I18n.get('category.bring.existing.greengrass.core.device')) as HTMLOptionElement).selected
  ).toBeTruthy();

  const mockDevice = userGreengrassCoreDeviceResponse.greengrassCoreDevices[0];
  expect(await screen.findByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`)).not.toBeNull();

  userEvent.selectOptions(getByTestId('user-greengrass-core-device-select'), mockDevice.coreDeviceThingName);
  expect(
    (getByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`) as HTMLOptionElement).selected
  ).toBeTruthy();

  userEvent.click(screen.getByText(I18n.get('register')));
  expect(await screen.findByText(/info.message.register.greengrass.core.device/)).not.toBeNull();
});

test('tests handleGreengrassCoreDevice function - User with UNHEALTHY device', async () => {
  mockAPI.get.mockResolvedValueOnce(userGreengrassCoreDeviceResponse);
  const { getByTestId, getByText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getByTestId('category-select'), CreatedBy.USER);
  expect(
    (getByText(I18n.get('category.bring.existing.greengrass.core.device')) as HTMLOptionElement).selected
  ).toBeTruthy();

  const mockDevice = userGreengrassCoreDeviceResponse.greengrassCoreDevices[1];
  expect(await screen.findByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`)).not.toBeNull();

  userEvent.selectOptions(getByTestId('user-greengrass-core-device-select'), mockDevice.coreDeviceThingName);
  expect(
    (getByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`) as HTMLOptionElement).selected
  ).toBeTruthy();

  userEvent.click(screen.getByText(I18n.get('register')));
  expect(await screen.findByText(/warning.message.unhealthy.greengrass.core.device/)).not.toBeNull();
});

test('tests registerGreengrassCoreDevice function - System success', async () => {
  mockAPI.get.mockResolvedValueOnce({ greengrassCoreDevices: [] });
  mockAPI.post.mockResolvedValueOnce({ message: 'Success' });
  const { getByPlaceholderText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );
  const input = getByPlaceholderText(I18n.get('placeholder.greengrass.core.device.name'));

  userEvent.type(input, greengrassCoreDeviceName);
  expect((document.getElementById('greengrassCoreDeviceName') as HTMLInputElement).value).toEqual(
    greengrassCoreDeviceName
  );

  userEvent.click(screen.getByText(I18n.get('register')));
  expect(await screen.findByText(/info.message.register.greengrass.core.device/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText('Success')).not.toBeNull();

  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    body: {
      name: greengrassCoreDeviceName,
      control: GreengrassCoreDeviceControl.CREATE,
      createdBy: CreatedBy.SYSTEM,
      osPlatform: OsPlatform.LINUX
    }
  });
});

test('tests registerGreengrassCoreDevice function - User failure', async () => {
  mockAPI.get.mockResolvedValueOnce(userGreengrassCoreDeviceResponse);
  mockAPI.post.mockRejectedValueOnce({ errorMessage: 'Failure' });
  const { getByTestId, getByText } = render(
    <MemoryRouter initialEntries={['/greengrass/register']}>
      <Routes>
        <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getByTestId('category-select'), CreatedBy.USER);
  expect(
    (getByText(I18n.get('category.bring.existing.greengrass.core.device')) as HTMLOptionElement).selected
  ).toBeTruthy();

  const mockDevice = userGreengrassCoreDeviceResponse.greengrassCoreDevices[0];
  expect(await screen.findByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`)).not.toBeNull();

  userEvent.selectOptions(getByTestId('user-greengrass-core-device-select'), mockDevice.coreDeviceThingName);
  expect(
    (getByText(`${mockDevice.coreDeviceThingName} (${mockDevice.status})`) as HTMLOptionElement).selected
  ).toBeTruthy();

  userEvent.click(screen.getByText(I18n.get('register')));
  expect(await screen.findByText(/info.message.register.greengrass.core.device/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(/error.message.register.greengrass.core.device/)).not.toBeNull();

  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    body: {
      name: mockDevice.coreDeviceThingName,
      control: GreengrassCoreDeviceControl.CREATE,
      createdBy: CreatedBy.USER,
      osPlatform: OsPlatform.LINUX
    }
  });
});
