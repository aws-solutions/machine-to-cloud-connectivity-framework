// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Iot from 'aws-sdk/clients/iot';
import { mockAwsIoT, mockAwsIoTData } from './mock';
import IoTHandler from '../aws-handlers/iot-handler';
import { IoTMessageTypes } from '../types/iot-handler-types';

describe('Unit tests of describeIoTEndpoint() function', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAwsIoT.describeEndpoint.mockReset();
  });

  test('Test success to describe the IoT data ATS endpoint', async () => {
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:Data-ATS' });
    expect(response).toEqual('https://mock-endpoint');
  });

  test('Test success to describe the IoT data ATS endpoint when IOT_ENDPOINT is provided', async () => {
    process.env.IOT_ENDPOINT = 'https://mock-endpoint-from-environment-variables';

    const handler = new IoTHandler();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).not.toHaveBeenCalled();
    expect(response).toEqual(process.env.IOT_ENDPOINT);
  });

  test('Test success to describe the IoT data ATS endpoint when IOT_ENDPOINT is empty', async () => {
    process.env.IOT_ENDPOINT = '';
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:Data-ATS' });
    expect(response).toEqual('https://mock-endpoint');
  });

  test('Test success to describe the other IoT endpoint', async () => {
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.describeIoTEndpoint('iot:CredentialProvider');
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:CredentialProvider' });
    expect(response).toEqual('https://mock-endpoint');
  });
});

describe('Unit tests of init() function', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAwsIoT.describeEndpoint.mockReset();
  });

  test('Test success to initialize', async () => {
    delete process.env.IOT_ENDPOINT;
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    await handler.init();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:Data-ATS' });
    expect(response).toEqual('https://mock-endpoint');
  });

  test('Test success to initialize when IOT_ENDPOINT is provided', async () => {
    process.env.IOT_ENDPOINT = 'https://mock-endpoint-from-environment-variables';

    const handler = new IoTHandler();
    await handler.init();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).not.toHaveBeenCalled();
    expect(response).toEqual(process.env.IOT_ENDPOINT);
  });

  test('Test success to initialize when IOT_ENDPOINT is empty', async () => {
    process.env.IOT_ENDPOINT = '';
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    await handler.init();
    const response = await handler.describeIoTEndpoint('iot:Data-ATS');
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:Data-ATS' });
    expect(response).toEqual('https://mock-endpoint');
  });
});

describe('Unit tests of publishIoTTopicMessage() function', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAwsIoTData.publish.mockReset();
    mockAwsIoT.describeEndpoint.mockReset();
  });

  test('Test to send a submit message', async () => {
    process.env.IOT_ENDPOINT = 'https://mock-endpoint-from-environment-variables';
    mockAwsIoTData.publish.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.publishIoTTopicMessage({
      connectionName: 'test',
      type: IoTMessageTypes.JOB,
      data: { test: 'message' }
    });
    expect(mockAwsIoTData.publish).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTData.publish).toHaveBeenCalledWith({
      topic: 'm2c2/job/test',
      qos: 1,
      payload: JSON.stringify({ test: 'message' })
    });
    expect(mockAwsIoT.describeEndpoint).not.toHaveBeenCalled();
  });

  test('Test to send an error message', async () => {
    mockAwsIoTData.publish.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.publishIoTTopicMessage({
      connectionName: 'test',
      type: IoTMessageTypes.ERROR,
      data: { error: 'message' }
    });
    expect(mockAwsIoTData.publish).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTData.publish).toHaveBeenCalledWith({
      topic: 'm2c2/error/test',
      qos: 1,
      payload: JSON.stringify({ error: 'message' })
    });
    expect(mockAwsIoT.describeEndpoint).not.toHaveBeenCalled();
  });

  test('Test to fail sending a message', async () => {
    mockAwsIoTData.publish.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    try {
      const handler = new IoTHandler();
      await handler.publishIoTTopicMessage({
        connectionName: 'test',
        type: IoTMessageTypes.ERROR,
        data: { error: 'message' }
      });
    } catch (error) {
      expect(error).toEqual('error');
      expect(mockAwsIoTData.publish).toHaveBeenCalledTimes(1);
      expect(mockAwsIoTData.publish).toHaveBeenCalledWith({
        topic: 'm2c2/error/test',
        qos: 1,
        payload: JSON.stringify({ error: 'message' })
      });
      expect(mockAwsIoT.describeEndpoint).not.toHaveBeenCalled();
    }
  });

  test('Test to send a message when the IoT endpoint address does not exist', async () => {
    delete process.env.IOT_ENDPOINT;
    mockAwsIoTData.publish.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    mockAwsIoT.describeEndpoint.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ endpointAddress: 'https://mock-endpoint' });
      }
    }));

    const handler = new IoTHandler();
    await handler.publishIoTTopicMessage({
      connectionName: 'test',
      type: IoTMessageTypes.ERROR,
      data: { error: 'message' }
    });
    expect(mockAwsIoTData.publish).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTData.publish).toHaveBeenCalledWith({
      topic: 'm2c2/error/test',
      qos: 1,
      payload: JSON.stringify({ error: 'message' })
    });
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeEndpoint).toHaveBeenCalledWith({ endpointType: 'iot:Data-ATS' });
  });
});

describe('Unit tests of createKeysAndCertificate() function', () => {
  const mockResult = {
    certificateArn: 'arn:of:certificate',
    certificateId: 'abcdefghijklmnopqrstuvwxyz',
    certificatePem: 'mock-pem',
    keyPair: {
      PublicKey: 'mock-public-key',
      PrivateKey: 'mock-private-key'
    }
  };

  beforeEach(() => mockAwsIoT.createKeysAndCertificate.mockReset());

  test('Test success to create IoT keys and certificate', async () => {
    mockAwsIoT.createKeysAndCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve(mockResult);
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.createKeysAndCertificate();

    expect(response).toEqual(mockResult);
    expect(mockAwsIoT.createKeysAndCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createKeysAndCertificate).toHaveBeenCalledWith({ setAsActive: true });
  });

  test('Test failure to create IoT keys and certificate', async () => {
    mockAwsIoT.createKeysAndCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.createKeysAndCertificate()).rejects.toEqual('error');
    expect(mockAwsIoT.createKeysAndCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createKeysAndCertificate).toHaveBeenCalledWith({ setAsActive: true });
  });
});

describe('Unit tests of getPrincipalThings() function', () => {
  const certificateArn = 'arn:of:iot:certificate';

  beforeEach(() => mockAwsIoT.listPrincipalThings.mockReset());

  test('Test success to get principal things', async () => {
    mockAwsIoT.listPrincipalThings.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ things: ['thing-1', 'thing-2'], nextToken: null });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.getPrincipalThings(certificateArn);

    expect(response).toEqual(['thing-1', 'thing-2']);
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenCalledWith({ principal: certificateArn });
  });

  test('Test success to get principal things with next token', async () => {
    mockAwsIoT.listPrincipalThings
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({ things: ['thing-1', 'thing-2'], nextToken: 'nextToken' });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({ things: ['thing-3', 'thing-4'] });
        }
      }));

    const handler = new IoTHandler();
    const response = await handler.getPrincipalThings(certificateArn);

    expect(response).toEqual(['thing-1', 'thing-2', 'thing-3', 'thing-4']);
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenCalledTimes(2);
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenNthCalledWith(1, { principal: certificateArn });
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenNthCalledWith(2, {
      principal: certificateArn,
      nextToken: 'nextToken'
    });
  });

  test('Test failure to get principal things', async () => {
    mockAwsIoT.listPrincipalThings.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.getPrincipalThings(certificateArn)).rejects.toEqual('error');
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.listPrincipalThings).toHaveBeenCalledWith({ principal: certificateArn });
  });
});

describe('Unit tests of updateCertificate() function', () => {
  beforeEach(() => mockAwsIoT.updateCertificate.mockReset());

  test('Test success to update IoT certificate', async () => {
    mockAwsIoT.updateCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.updateCertificate({
      certificateId: 'mock-certificate-id',
      newStatus: 'INACTIVE'
    });
    expect(mockAwsIoT.updateCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.updateCertificate).toHaveBeenCalledWith({
      certificateId: 'mock-certificate-id',
      newStatus: 'INACTIVE'
    });
  });

  test('Test failure to update IoT certificate', async () => {
    mockAwsIoT.updateCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(
      handler.updateCertificate({
        certificateId: 'mock-certificate-id',
        newStatus: 'INACTIVE'
      })
    ).rejects.toEqual('error');
    expect(mockAwsIoT.updateCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.updateCertificate).toHaveBeenCalledWith({
      certificateId: 'mock-certificate-id',
      newStatus: 'INACTIVE'
    });
  });
});

describe('Unit tests of deleteCertificate() function', () => {
  beforeEach(() => mockAwsIoT.deleteCertificate.mockReset());

  test('Test success to delete IoT certificate', async () => {
    mockAwsIoT.deleteCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.deleteCertificate('mock-certificate-id');
    expect(mockAwsIoT.deleteCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteCertificate).toHaveBeenCalledWith({
      certificateId: 'mock-certificate-id',
      forceDelete: true
    });
  });

  test('Test failure to delete IoT certificate', async () => {
    mockAwsIoT.deleteCertificate.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.deleteCertificate('mock-certificate-id')).rejects.toEqual('error');
    expect(mockAwsIoT.deleteCertificate).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteCertificate).toHaveBeenCalledWith({
      certificateId: 'mock-certificate-id',
      forceDelete: true
    });
  });
});

describe('Unit tests of createRoleAlias() function', () => {
  const params: Iot.CreateRoleAliasRequest = {
    roleAlias: 'mock-alias',
    roleArn: 'arn:of:role'
  };

  beforeEach(() => mockAwsIoT.createRoleAlias.mockReset());

  test('Test success to create IoT role alias', async () => {
    mockAwsIoT.createRoleAlias.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.createRoleAlias(params);
    expect(mockAwsIoT.createRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createRoleAlias).toHaveBeenCalledWith(params);
  });

  test('Test failure to create IoT role alias', async () => {
    mockAwsIoT.createRoleAlias.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.createRoleAlias(params)).rejects.toEqual('error');
    expect(mockAwsIoT.createRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createRoleAlias).toHaveBeenCalledWith(params);
  });
});

describe('Unit tests of deleteRoleAlias() function', () => {
  const roleAlias = 'mock-alias';

  beforeEach(() => mockAwsIoT.deleteRoleAlias.mockReset());

  test('Test success to delete IoT role alias', async () => {
    mockAwsIoT.deleteRoleAlias.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.deleteRoleAlias(roleAlias);
    expect(mockAwsIoT.deleteRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteRoleAlias).toHaveBeenCalledWith({ roleAlias });
  });

  test('Test failure to delete IoT role alias', async () => {
    mockAwsIoT.deleteRoleAlias.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('error');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.deleteRoleAlias(roleAlias)).rejects.toEqual('error');
    expect(mockAwsIoT.deleteRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteRoleAlias).toHaveBeenCalledWith({ roleAlias });
  });
});

describe('Unit tests of createThing() function', () => {
  const thingName = 'mock-thing';
  const thingArn = 'arn:of:thing';

  beforeEach(() => mockAwsIoT.createThing.mockReset());

  test('Test success to create an IoT thing', async () => {
    mockAwsIoT.createThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ thingName, thingArn });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.createThing(thingName);
    expect(response).toEqual(thingArn);
    expect(mockAwsIoT.createThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createThing).toHaveBeenCalledWith({ thingName });
  });

  test('Test failure to create an IoT thing', async () => {
    mockAwsIoT.createThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.createThing(thingName)).rejects.toEqual('Failure');
    expect(mockAwsIoT.createThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.createThing).toHaveBeenCalledWith({ thingName });
  });
});

describe('Unit tests of deleteThing() function', () => {
  const thingName = 'mock-thing';

  beforeEach(() => mockAwsIoT.deleteThing.mockReset());

  test('Test success to delete an IoT thing', async () => {
    mockAwsIoT.deleteThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.deleteThing(thingName);
    expect(mockAwsIoT.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteThing).toHaveBeenCalledWith({ thingName });
  });

  test('Test failure to delete an IoT thing', async () => {
    mockAwsIoT.deleteThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.deleteThing(thingName)).rejects.toEqual('Failure');
    expect(mockAwsIoT.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.deleteThing).toHaveBeenCalledWith({ thingName });
  });
});

describe('Unit tests of getThing() function', () => {
  const thingName = 'mock-thing';
  const thingArn = 'arn:of:thing';

  beforeEach(() => mockAwsIoT.describeThing.mockReset());

  test('Test success to get an IoT thing', async () => {
    mockAwsIoT.describeThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ thingName, thingArn });
      }
    }));

    const handler = new IoTHandler();
    const response = await handler.getThing(thingName);
    expect(response).toEqual({ thingName, thingArn });
    expect(mockAwsIoT.describeThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeThing).toHaveBeenCalledWith({ thingName });
  });

  test('Test failure to get an IoT thing', async () => {
    mockAwsIoT.describeThing.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.getThing(thingName)).rejects.toEqual('Failure');
    expect(mockAwsIoT.describeThing).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.describeThing).toHaveBeenCalledWith({ thingName });
  });
});

describe('Unit tests of attachThingPrincipal() function', () => {
  const thingName = 'mock-thing';
  const principal = 'mock-principal';

  beforeEach(() => mockAwsIoT.attachThingPrincipal.mockReset());

  test('Test success to attach thing principal', async () => {
    mockAwsIoT.attachThingPrincipal.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.attachThingPrincipal({ thingName, principal });
    expect(mockAwsIoT.attachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.attachThingPrincipal).toHaveBeenCalledWith({ thingName, principal });
  });

  test('Test failure to attach thing principal', async () => {
    mockAwsIoT.attachThingPrincipal.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.attachThingPrincipal({ thingName, principal })).rejects.toEqual('Failure');
    expect(mockAwsIoT.attachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.attachThingPrincipal).toHaveBeenCalledWith({ thingName, principal });
  });
});

describe('Unit tests of detachThingPrincipal() function', () => {
  const thingName = 'mock-thing';
  const principal = 'mock-principal';

  beforeEach(() => mockAwsIoT.detachThingPrincipal.mockReset());

  test('Test success to detach thing principal', async () => {
    mockAwsIoT.detachThingPrincipal.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const handler = new IoTHandler();
    await handler.detachThingPrincipal({ thingName, principal });
    expect(mockAwsIoT.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.detachThingPrincipal).toHaveBeenCalledWith({ thingName, principal });
  });

  test('Test failure to detach thing principal', async () => {
    mockAwsIoT.detachThingPrincipal.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const handler = new IoTHandler();
    await expect(handler.detachThingPrincipal({ thingName, principal })).rejects.toEqual('Failure');
    expect(mockAwsIoT.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockAwsIoT.detachThingPrincipal).toHaveBeenCalledWith({ thingName, principal });
  });
});
