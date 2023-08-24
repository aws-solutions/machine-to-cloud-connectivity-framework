// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n } from '@aws-amplify/core';
import { queryByAttribute, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConnectionForm from '../connection/ConnectionForm';
import {
  ConnectionControl,
  CreatedBy,
  GetConnectionResponse,
  ListGreengrassCoreDevicesResponse,
  MachineProtocol,
<<<<<<< HEAD
  OsiPiAuthMode
=======
  OsiPiAuthMode,
  OsPlatform
>>>>>>> main
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
const opcDaResponse: GetConnectionResponse = {
  connectionName: 'mock-connection-id',
  greengrassCoreDeviceName: 'mock-greengrass-device-name',
  protocol: MachineProtocol.OPCDA,
  sendDataToIoTSiteWise: true,
  sendDataToIoTTopic: true,
  sendDataToKinesisDataStreams: true,
  sendDataToTimestream: true,
  sendDataToHistorian: true,
  siteName: 'mock-site',
  area: 'mock-area',
  process: 'mock-process',
  machineName: 'mock-machine',
  logLevel: undefined,
  opcDa: {
    machineIp: '1.2.3.4',
    serverName: 'mock-opcda-server-name',
    iterations: 3,
    interval: 3,
    listTags: ['listTag1.*', 'listTag2.*'],
    tags: ['tag1', 'tag2']
  }
};
const opcUaResponse: GetConnectionResponse = {
  connectionName: 'mock-connection-id',
  greengrassCoreDeviceName: 'mock-greengrass-device-name',
  protocol: MachineProtocol.OPCUA,
  sendDataToIoTSiteWise: true,
  sendDataToIoTTopic: true,
  sendDataToKinesisDataStreams: true,
  sendDataToTimestream: true,
  sendDataToHistorian: true,
  siteName: 'mock-site',
  area: 'mock-area',
  process: 'mock-process',
  machineName: 'mock-machine',
  logLevel: undefined,
  opcUa: {
    machineIp: '1.2.3.4',
    serverName: 'mock-opcua-server-name'
  }
};

const osiPiResponse: GetConnectionResponse = {
  connectionName: 'mock-connection-id',
  greengrassCoreDeviceName: 'mock-greengrass-device-name',
  protocol: MachineProtocol.OSIPI,
  sendDataToIoTSiteWise: true,
  sendDataToIoTTopic: true,
  sendDataToKinesisDataStreams: true,
  sendDataToTimestream: true,
<<<<<<< HEAD
=======
  sendDataToHistorian: true,
>>>>>>> main
  siteName: 'mock-site',
  area: 'mock-area',
  process: 'mock-process',
  machineName: 'mock-machine',
  logLevel: undefined,
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
  }
};

const greengrassCoreDevicesResponse: ListGreengrassCoreDevicesResponse = {
  greengrassCoreDevices: [
    { name: 'mock-greengrass-1', createdBy: CreatedBy.SYSTEM, numberOfConnections: 0, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-2', createdBy: CreatedBy.USER, numberOfConnections: 1, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-3', createdBy: CreatedBy.SYSTEM, numberOfConnections: 2, osPlatform: OsPlatform.LINUX },
    { name: 'mock-greengrass-4', createdBy: CreatedBy.USER, numberOfConnections: 3, osPlatform: OsPlatform.LINUX }
  ]
};
const error = { errorMessage: 'Failure' };

beforeEach(() => {
  mockAPI.get.mockReset();
  mockAPI.post.mockReset();
});

test('renders the connection form component for the new connection', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(connectionForm.container).toMatchSnapshot();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('renders the connection form component for the new connection when getting Greengrass core devices fails', async () => {
  mockAPI.get.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('renders the connection form component for the update OPC DA connection', async () => {
  mockAPI.get.mockResolvedValueOnce(opcDaResponse);
  const connectionForm = render(
    <MemoryRouter initialEntries={[`/connection/${opcDaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(connectionForm.container).toMatchSnapshot();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(opcDaResponse.connectionName)}`,
    {}
  );
});

test('renders the connection form component for the update OPC UA connection', async () => {
  mockAPI.get.mockResolvedValueOnce(opcUaResponse);
  const connectionForm = render(
    <MemoryRouter initialEntries={[`/connection/${opcUaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(connectionForm.container).toMatchSnapshot();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(opcUaResponse.connectionName)}`,
    {}
  );
});

test('renders the connection form component for the update connection when getting a connection fails', async () => {
  mockAPI.get.mockRejectedValueOnce(error);
  render(
    <MemoryRouter initialEntries={[`/connection/${opcUaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(opcUaResponse.connectionName)}`,
    {}
  );
});

test('tests cancel button', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/" />
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.queryByText(I18n.get('cancel'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('cancel')));
  expect(screen.queryByText(I18n.get('cancel'))).toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - OPC DA iterations for general change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  const { getByPlaceholderText } = render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const input = getByPlaceholderText(I18n.get('placeholder.iterations'));
  userEvent.type(input, '1');
  expect((input as HTMLInputElement).value).toEqual('1');

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - sendDataToIoTSiteWise for checkbox change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.click(screen.getByLabelText(I18n.get('iot.sitewise')));
  expect((document.getElementById('sendDataToIoTSiteWise') as HTMLInputElement).checked).toBeTruthy();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - sendDataToIoTTopic for checkbox change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.click(screen.getByLabelText(I18n.get('iot.topic')));
  expect((document.getElementById('sendDataToIoTTopic') as HTMLInputElement).checked).toBeTruthy();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - sendDataToKinesisDataStreams for checkbox change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.click(screen.getByLabelText(I18n.get('kinesis.data.streams')));
  expect((document.getElementById('sendDataToKinesisDataStreams') as HTMLInputElement).checked).toBeFalsy();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - sendDataToTimestream for checkbox change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.click(screen.getByLabelText(I18n.get('timestream')));
  expect((document.getElementById('sendDataToTimestream') as HTMLInputElement).checked).toBeTruthy();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleValueChange function - sendDataToHistorian for checkbox change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );
  userEvent.click(screen.getByLabelText(I18n.get('historian')));
  expect((document.getElementById('sendDataToHistorian') as HTMLInputElement).checked).toBeTruthy();
  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('test handleValueChange function - OPC UA machineIp for OPC UA data change', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getById(connectionForm.container, 'protocol') as HTMLElement, MachineProtocol.OPCUA);
  expect(await screen.findByText(I18n.get('port'))).not.toBeNull();

  const input = connectionForm.getByPlaceholderText(I18n.get('placeholder.machine.ip'));
  userEvent.type(input, '1.2.3.4');
  expect((input as HTMLInputElement).value).toEqual('1.2.3.4');

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleConnection function - OPC DA with errors', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/" />
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.click(screen.getByText(I18n.get('create')));
  expect(await screen.findByText(/invalid.greengrass.core.device.name/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleConnection function - OPC DA without errors', async () => {
  mockAPI.get.mockResolvedValueOnce(opcDaResponse);
  mockAPI.post.mockResolvedValueOnce({ connectionName: opcDaResponse.connectionName });
  render(
    <MemoryRouter initialEntries={[`/connection/${opcDaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(await screen.findByText(I18n.get('update'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('update')));
  expect(await screen.findByText(/info.message.update.connection.confirm/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(/info.message.background.running/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(opcDaResponse.connectionName)}`,
    {}
  );
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  const copiedResponse = {
    ...opcDaResponse,
    control: ConnectionControl.UPDATE
  };
  delete copiedResponse.opcDaListTags;
  delete copiedResponse.opcDaTags;
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: copiedResponse
  });
}, 30000);

test('tests handleConnection function - OPC DA with update failure', async () => {
  mockAPI.get.mockResolvedValueOnce(opcDaResponse);
  mockAPI.post.mockRejectedValueOnce({ message: 'POST failure' });
  render(
    <MemoryRouter initialEntries={[`/connection/${opcDaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(await screen.findByText(I18n.get('update'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('update')));
  expect(await screen.findByText(/info.message.update.connection.confirm/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(/error.message.update.connection/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(opcDaResponse.connectionName)}`,
    {}
  );
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  const copiedResponse = {
    ...opcDaResponse,
    control: ConnectionControl.UPDATE
  };
  delete copiedResponse.opcDaListTags;
  delete copiedResponse.opcDaTags;
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: copiedResponse
  });
});

test('tests handleConnection function - OPC UA with errors', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse);
  const connectionForm = render(
    <MemoryRouter initialEntries={['/connection']}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getById(connectionForm.container, 'protocol') as HTMLElement, MachineProtocol.OPCUA);
  expect(await screen.findByText(I18n.get('port'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('create')));
  expect(await screen.findByText(/invalid.greengrass.core.device.name/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
});

test('tests handleConnection function - OPC UA with duplicated server name error when creating', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse).mockResolvedValueOnce({ key: 'mock' });
  const connectionForm = render(
    <MemoryRouter initialEntries={[`/connection`]}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getById(connectionForm.container, 'protocol') as HTMLElement, MachineProtocol.OPCUA);
  expect(await screen.findByText(I18n.get('server.name'))).not.toBeNull();

  const input = connectionForm.getByPlaceholderText(I18n.get('placeholder.opcua.server.name'));
  userEvent.type(input, 'duplicate');
  expect((input as HTMLInputElement).value).toEqual('duplicate');

  userEvent.click(screen.getByText(I18n.get('create')));
  expect(await screen.findByText(/invalid.duplicated.server.name/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, `/sitewise/${encodeURIComponent('duplicate')}`, {});
});

test('tests handleConnection function - OPC UA with duplicated server name error when updating', async () => {
  mockAPI.get
    .mockResolvedValueOnce(opcUaResponse) // GET /connections/:connectionName
    .mockResolvedValueOnce({ key: 'mock' }) // GET /sitewise
    .mockResolvedValueOnce({
      opcUa: {
        serverName: 'different-server'
      }
    }); // GET /connections/:connectionName
  render(
    <MemoryRouter initialEntries={[`/connection/${opcUaResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(await screen.findByText(I18n.get('update'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('update')));
  expect(await screen.findByText(/invalid.duplicated.server.name/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(3);
  expect(mockAPI.get).toHaveBeenNthCalledWith(
    1,
    API_NAME,
    `/connections/${encodeURIComponent(opcUaResponse.connectionName)}`,
    {}
  );
  expect(mockAPI.get).toHaveBeenNthCalledWith(
    2,
    API_NAME,
    `/sitewise/${encodeURIComponent(opcUaResponse.opcUa?.serverName as string)}`,
    {}
  );
  expect(mockAPI.get).toHaveBeenNthCalledWith(
    3,
    API_NAME,
    `/connections/${encodeURIComponent(opcUaResponse.connectionName)}`,
    {}
  );
});

test('tests handleConnection function - OPC UA failure to get server name', async () => {
  mockAPI.get.mockResolvedValueOnce(greengrassCoreDevicesResponse).mockRejectedValueOnce(error);
  const connectionForm = render(
    <MemoryRouter initialEntries={[`/connection`]}>
      <Routes>
        <Route path="/connection" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  userEvent.selectOptions(getById(connectionForm.container, 'protocol') as HTMLElement, MachineProtocol.OPCUA);
  expect(await screen.findByText(I18n.get('server.name'))).not.toBeNull();

  const input = connectionForm.getByPlaceholderText(I18n.get('placeholder.opcua.server.name'));
  userEvent.type(input, 'duplicate');
  expect((input as HTMLInputElement).value).toEqual('duplicate');

  userEvent.click(screen.getByText(I18n.get('create')));
  expect(await screen.findByText(JSON.stringify(error))).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(2);
  expect(mockAPI.get).toHaveBeenNthCalledWith(1, API_NAME, '/greengrass', {
    queryStringParameters: { nextToken: undefined }
  });
  expect(mockAPI.get).toHaveBeenNthCalledWith(2, API_NAME, `/sitewise/${encodeURIComponent('duplicate')}`, {});
});

test('tests handleConnection function - OSI PI without errors', async () => {
  mockAPI.get.mockResolvedValueOnce(osiPiResponse);
  mockAPI.post.mockResolvedValueOnce({ connectionName: osiPiResponse.connectionName });
  render(
    <MemoryRouter initialEntries={[`/connection/${osiPiResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(await screen.findByText(I18n.get('update'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('update')));
  expect(await screen.findByText(/info.message.update.connection.confirm/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(/info.message.background.running/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('ok')));

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(osiPiResponse.connectionName)}`,
    {}
  );
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  const copiedResponse = {
    ...osiPiResponse,
    control: ConnectionControl.UPDATE
  };
  delete copiedResponse.osiPiTags;
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: copiedResponse
  });
});

test('tests handleConnection function - OSI PI with update failure', async () => {
  mockAPI.get.mockResolvedValueOnce(osiPiResponse);
  mockAPI.post.mockRejectedValueOnce({ message: 'POST failure' });
  render(
    <MemoryRouter initialEntries={[`/connection/${osiPiResponse.connectionName}`]}>
      <Routes>
        <Route path="/connection/:connectionName" element={<ConnectionForm />} />
      </Routes>
    </MemoryRouter>
  );

  const connectionName = (await screen.findByPlaceholderText(
    I18n.get('placeholder.connection.name')
  )) as HTMLInputElement;
  expect(connectionName.value).toEqual('mock-connection-id');
  expect(await screen.findByText(I18n.get('update'))).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('update')));
  expect(await screen.findByText(/info.message.update.connection.confirm/)).not.toBeNull();

  userEvent.click(screen.getByText(I18n.get('confirm')));
  expect(await screen.findByText(/error.message.update.connection/)).not.toBeNull();

  expect(mockAPI.get).toHaveBeenCalledTimes(1);
  expect(mockAPI.get).toHaveBeenCalledWith(
    API_NAME,
    `/connections/${encodeURIComponent(osiPiResponse.connectionName)}`,
    {}
  );
  expect(mockAPI.post).toHaveBeenCalledTimes(1);
  const copiedResponse = {
    ...osiPiResponse,
    control: ConnectionControl.UPDATE
  };
  delete copiedResponse.osiPiTags;
  expect(mockAPI.post).toHaveBeenCalledWith(API_NAME, '/connections', {
    body: copiedResponse
  });
});
