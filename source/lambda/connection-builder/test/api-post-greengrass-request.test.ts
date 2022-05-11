// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  consoleErrorSpy,
  mockDynamoDbHandler,
  mockGreengrassV2Handler,
  mockIoTHandler,
  mockIoTSiteWiseHandler,
  mockS3Handler,
  mockValue,
  sendAnonymousMetricsSpy
} from './mock';
import { LambdaError } from '../../lib/errors';
import { handler } from '../index';
import {
  GreengrassCoreDeviceControl,
  GreengrassCoreDeviceEventTypes,
  PostGreengrassRequestBodyInput
} from '../../lib/types/connection-builder-types';
import { CreatedBy } from '../../lib/types/dynamodb-handler-types';

describe('Unit tests of POST /greengrass - creation', () => {
  const body: PostGreengrassRequestBodyInput = {
    name: 'mock-greengrass',
    control: GreengrassCoreDeviceControl.CREATE,
    createdBy: CreatedBy.SYSTEM
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    body: JSON.stringify(body),
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/greengrass',
    resource: '/greengrass'
  };

  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockDynamoDbHandler.addGreengrassCoreDevice.mockReset();
    mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockReset();
    mockIoTHandler.attachThingPrincipal.mockReset();
    mockIoTHandler.createThing.mockReset();
    mockIoTHandler.deleteThing.mockReset();
    mockIoTHandler.detachThingPrincipal.mockReset();
    mockIoTHandler.getThing.mockReset();
    mockIoTSiteWiseHandler.createGreengrassV2Gateway.mockReset();
    mockIoTSiteWiseHandler.listGreengrassV2Gateways.mockReset();
    mockS3Handler.getObject.mockReset();
    mockS3Handler.putObject.mockReset();
    sendAnonymousMetricsSpy.mockReset();
  });

  test('Test success to create Greengrass core device by system', async () => {
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });
    mockIoTHandler.createThing.mockResolvedValueOnce(mockValue.iotThingArn);
    mockIoTHandler.attachThingPrincipal.mockResolvedValueOnce(undefined);
    mockS3Handler.getObject.mockResolvedValueOnce({ Body: mockValue.s3Body });
    mockS3Handler.putObject.mockResolvedValueOnce(undefined);
    mockIoTSiteWiseHandler.createGreengrassV2Gateway.mockResolvedValueOnce(mockValue.iotSiteWiseGateways[0]);
    mockDynamoDbHandler.addGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is created/registered. You must install the installation script on your machine.`
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTHandler.createThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockS3Handler.getObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.getObject).toHaveBeenCalledWith({
      bucket: process.env.GREENGRASS_RESOURCE_BUCKET,
      key: 'm2c2-install.sh'
    });
    expect(mockS3Handler.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.putObject).toHaveBeenCalledWith({
      body: body.name,
      contentType: 'text/x-sh',
      destinationBucket: process.env.GREENGRASS_RESOURCE_BUCKET,
      destinationKey: `public/${body.name}.sh`
    });
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).toHaveBeenCalledWith(body.name);
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledWith({
      name: body.name,
      createdBy: body.createdBy,
      iotSiteWiseGatewayId: mockValue.iotSiteWiseGateways[0].gatewayId,
      iotThingArn: mockValue.iotThingArn
    });
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        EventType: GreengrassCoreDeviceEventTypes.CREATE,
        createdBy: body.createdBy
      },
      process.env.SOLUTION_UUID
    );
  });

  test('Test failure to create Greengrass core device by system due to duplicated DynamoDB item', async () => {
    const error = new LambdaError({
      message: 'The Greengrass core device name is already used by the system.',
      name: 'DuplicatedGreengrassCoreDeviceName',
      statusCode: 400
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({
      ...mockValue.dynamoDbGreengrassCoreDevice,
      name: body.name
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).not.toHaveBeenCalled();
    expect(mockIoTHandler.createThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
  });

  test('Test failure to create Greengrass core device by system due to duplicated Greengrass', async () => {
    const error = new LambdaError({
      message: 'The Greengrass core device name is already used in Greengrass.',
      name: 'DuplicatedGreengrassCoreDeviceNameError',
      statusCode: 400
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: body.name
        }
      ]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTHandler.createThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
  });

  test('Test failure to create Greengrass core device by system due to creating thing failure', async () => {
    const error = new Error('Create thing failure');
    const thingNotExistError = new Error('Thing does not exist');
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });
    mockIoTHandler.createThing.mockRejectedValueOnce(error);
    mockIoTHandler.detachThingPrincipal.mockRejectedValueOnce(thingNotExistError);
    mockIoTHandler.deleteThing.mockRejectedValueOnce(thingNotExistError);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTHandler.createThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      'Rollback Greengrass core device... thingName: ',
      body.name
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'An error occurred while detaching thing from principal. IoT thing principal might not exist nor be detached completely: ',
      thingNotExistError
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      3,
      '[connection-builder]',
      'An error occurred while deleting thing. IoT thing might not exist nor be deleted completely: ',
      thingNotExistError
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(4, '[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledWith(body.name);
  });

  test('Test failure to create Greengrass core device by system due to attaching thing principal failure', async () => {
    const error = new Error('Attach thing principal failure');
    const thingPrincipalNotExistError = new Error('Thing principal does not exist');
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });
    mockIoTHandler.createThing.mockResolvedValueOnce(mockValue.iotThingArn);
    mockIoTHandler.attachThingPrincipal.mockRejectedValueOnce(error);
    mockIoTHandler.detachThingPrincipal.mockRejectedValueOnce(thingPrincipalNotExistError);
    mockIoTHandler.deleteThing.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTHandler.createThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      'Rollback Greengrass core device... thingName: ',
      body.name
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[connection-builder]',
      'An error occurred while detaching thing from principal. IoT thing principal might not exist nor be detached completely: ',
      thingPrincipalNotExistError
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(3, '[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledWith(body.name);
  });

  test('Test failure to create Greengrass core device by system due to creating gateway failure', async () => {
    const error = new Error('Create IoT SiteWise gateway failure');
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });
    mockIoTHandler.createThing.mockResolvedValueOnce(mockValue.iotThingArn);
    mockIoTHandler.attachThingPrincipal.mockResolvedValueOnce(undefined);
    mockS3Handler.getObject.mockResolvedValueOnce({ Body: mockValue.s3Body });
    mockS3Handler.putObject.mockResolvedValueOnce(undefined);
    mockIoTSiteWiseHandler.createGreengrassV2Gateway.mockRejectedValueOnce(error);
    mockIoTHandler.detachThingPrincipal.mockResolvedValueOnce(undefined);
    mockIoTHandler.deleteThing.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 500,
      body: JSON.stringify({ errorMessage: 'Internal service error.' })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTHandler.createThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.attachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockS3Handler.getObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.getObject).toHaveBeenCalledWith({
      bucket: process.env.GREENGRASS_RESOURCE_BUCKET,
      key: 'm2c2-install.sh'
    });
    expect(mockS3Handler.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.putObject).toHaveBeenCalledWith({
      body: body.name,
      contentType: 'text/x-sh',
      destinationBucket: process.env.GREENGRASS_RESOURCE_BUCKET,
      destinationKey: `public/${body.name}.sh`
    });
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).toHaveBeenCalledWith(body.name);
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[connection-builder]',
      'Rollback Greengrass core device... thingName: ',
      body.name
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledWith(body.name);
  });

  test('Test success to register BYO Greengrass core device', async () => {
    body.createdBy = CreatedBy.USER;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: body.name
        }
      ]
    });
    mockIoTSiteWiseHandler.listGreengrassV2Gateways.mockResolvedValueOnce({ gateways: mockValue.iotSiteWiseGateways });
    mockIoTHandler.getThing.mockResolvedValueOnce({ thingArn: mockValue.iotThingArn });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is created/registered. You must add relative permissions on your Greengrass. Please refer to the implementation guide.`
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).toHaveBeenCalledWith();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledWith({
      name: body.name,
      createdBy: body.createdBy,
      iotSiteWiseGatewayId: mockValue.iotSiteWiseGateways[0].gatewayId,
      iotThingArn: mockValue.iotThingArn
    });
    expect(mockIoTHandler.getThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.getThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.createThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        EventType: GreengrassCoreDeviceEventTypes.CREATE,
        createdBy: body.createdBy
      },
      process.env.SOLUTION_UUID
    );
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
  });

  test('Test success to register BYO Greengrass core device without IoT SiteWise gateway', async () => {
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: body.name
        }
      ]
    });
    mockIoTSiteWiseHandler.listGreengrassV2Gateways.mockResolvedValueOnce({
      gateways: [mockValue.iotSiteWiseGateways[1]]
    });
    mockIoTHandler.getThing.mockResolvedValueOnce({ thingArn: mockValue.iotThingArn });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is created/registered. "${body.name}" Greengrass core device is not attached to IoT SiteWise gateway. This Greengrass core device would not allow OPC UA connections. You must add relative permissions on your Greengrass. Please refer to the implementation guide.`
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).toHaveBeenCalledWith();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).toHaveBeenCalledWith({
      name: body.name,
      createdBy: body.createdBy,
      iotSiteWiseGatewayId: undefined,
      iotThingArn: mockValue.iotThingArn
    });
    expect(mockIoTHandler.getThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.getThing).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.createThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        EventType: GreengrassCoreDeviceEventTypes.CREATE,
        createdBy: body.createdBy
      },
      process.env.SOLUTION_UUID
    );
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
  });

  test('Test failure to register BYO Greengrass core device due to not existing Greengrass', async () => {
    const error = new LambdaError({
      message: 'The Greengrass core device name does not exist in Greengrass.',
      name: 'GreengrassCoreDeviceNameNotFoundError',
      statusCode: 404
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [mockValue.greengrassGreengrassCoreDevice]
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.listGreengrassCoreDevices).toHaveBeenCalledWith();
    expect(mockIoTSiteWiseHandler.listGreengrassV2Gateways).not.toHaveBeenCalled();
    expect(mockIoTHandler.getThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.createThing).not.toHaveBeenCalled();
    expect(mockIoTHandler.attachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
    expect(mockIoTSiteWiseHandler.createGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.addGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
  });

  test('Test not sending anonymous usage metrics', async () => {
    process.env.SEND_ANONYMOUS_METRIC = 'No';

    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.listGreengrassCoreDevices.mockResolvedValueOnce({
      greengrassCoreDevices: [
        {
          ...mockValue.greengrassGreengrassCoreDevice,
          coreDeviceThingName: body.name
        }
      ]
    });
    mockIoTSiteWiseHandler.listGreengrassV2Gateways.mockResolvedValueOnce({
      gateways: [mockValue.iotSiteWiseGateways[1]]
    });
    mockIoTHandler.getThing.mockResolvedValueOnce({ thingArn: mockValue.iotThingArn });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is created/registered. "${body.name}" Greengrass core device is not attached to IoT SiteWise gateway. This Greengrass core device would not allow OPC UA connections. You must add relative permissions on your Greengrass. Please refer to the implementation guide.`
      })
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  });
});

describe('Unit tests of POST /greengrass - deletion', () => {
  const body: PostGreengrassRequestBodyInput = {
    name: 'mock-greengrass',
    control: GreengrassCoreDeviceControl.DELETE,
    createdBy: CreatedBy.SYSTEM
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = {
    body: JSON.stringify(body),
    headers: { Host: process.env.API_ENDPOINT },
    httpMethod: 'POST',
    path: '/greengrass',
    resource: '/greengrass'
  };

  beforeAll(() => (process.env.SEND_ANONYMOUS_METRIC = 'Yes'));
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockDynamoDbHandler.deleteGreengrassCoreDevice.mockReset();
    mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
    mockGreengrassV2Handler.deleteGreengrassCoreDevice.mockReset();
    mockIoTHandler.deleteThing.mockReset();
    mockIoTHandler.detachThingPrincipal.mockReset();
    mockIoTSiteWiseHandler.deleteGreengrassV2Gateway.mockReset();
    mockS3Handler.deleteObject.mockReset();
    sendAnonymousMetricsSpy.mockReset();
  });

  test('Test success to delete Greengrass core device created by system', async () => {
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(mockValue.dynamoDbGreengrassCoreDevice);
    mockIoTSiteWiseHandler.deleteGreengrassV2Gateway.mockResolvedValueOnce(undefined);
    mockIoTHandler.detachThingPrincipal.mockResolvedValueOnce(undefined);
    mockS3Handler.deleteObject.mockResolvedValueOnce(undefined);
    mockGreengrassV2Handler.deleteGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    mockIoTHandler.deleteThing.mockResolvedValueOnce(undefined);
    mockDynamoDbHandler.deleteGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is deleted/deregistered.`
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockIoTSiteWiseHandler.deleteGreengrassV2Gateway).toHaveBeenCalledTimes(1);
    expect(mockIoTSiteWiseHandler.deleteGreengrassV2Gateway).toHaveBeenCalledWith(
      mockValue.dynamoDbGreengrassCoreDevice.iotSiteWiseGatewayId
    );
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledWith({
      thingName: body.name,
      principal: process.env.IOT_CERTIFICATE_ARN
    });
    expect(mockS3Handler.deleteObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObject).toHaveBeenCalledWith({
      sourceBucket: process.env.GREENGRASS_RESOURCE_BUCKET,
      sourceKey: `public/${body.name}.sh`
    });
    expect(mockGreengrassV2Handler.deleteGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockGreengrassV2Handler.deleteGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteThing).toHaveBeenCalledWith(body.name);
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        EventType: GreengrassCoreDeviceEventTypes.DELETE,
        createdBy: body.createdBy
      },
      process.env.SOLUTION_UUID
    );
  });

  test('Test failure to delete Greengrass core device created by system due to not existing DynamoDB item', async () => {
    const error = new LambdaError({
      message: `"${body.name}" Greengrass core device does not exist.`,
      name: 'GreengrassCoreDeviceNotFoundError',
      statusCode: 404
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockIoTSiteWiseHandler.deleteGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.deleteObject).not.toHaveBeenCalled();
    expect(mockGreengrassV2Handler.deleteGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  });

  test('Test success to deregister BYO Greengrass core device', async () => {
    body.createdBy = CreatedBy.USER;
    event.body = JSON.stringify(body);
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(mockValue.dynamoDbGreengrassCoreDevice);
    mockDynamoDbHandler.deleteGreengrassCoreDevice.mockResolvedValueOnce(undefined);
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is deleted/deregistered.`
      })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockIoTSiteWiseHandler.deleteGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.deleteObject).not.toHaveBeenCalled();
    expect(mockGreengrassV2Handler.deleteGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        EventType: GreengrassCoreDeviceEventTypes.DELETE,
        createdBy: body.createdBy
      },
      process.env.SOLUTION_UUID
    );
  });

  test('Test failure to deregister BYO Greengrass core device due to existing connections', async () => {
    const error = new LambdaError({
      message: `"${body.name}" Greengrass core device has connections. You need to remove connections first.`,
      name: 'ExistingConnectionError',
      statusCode: 428
    });
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce({
      ...mockValue.dynamoDbGreengrassCoreDevice,
      numberOfConnections: 1
    });

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: error.statusCode,
      body: JSON.stringify({ errorMessage: error.message })
    });
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(body.name);
    expect(mockIoTSiteWiseHandler.deleteGreengrassV2Gateway).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockS3Handler.deleteObject).not.toHaveBeenCalled();
    expect(mockGreengrassV2Handler.deleteGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteThing).not.toHaveBeenCalled();
    expect(mockDynamoDbHandler.deleteGreengrassCoreDevice).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[connection-builder]', 'Error occurred: ', error);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  });

  test('Test not sending anonymous usage metrics', async () => {
    process.env.SEND_ANONYMOUS_METRIC = 'No';
    mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValueOnce(mockValue.dynamoDbGreengrassCoreDevice);
    mockDynamoDbHandler.deleteGreengrassCoreDevice.mockResolvedValueOnce(undefined);

    const response = await handler(event);
    expect(response).toEqual({
      headers: mockValue.headers,
      statusCode: 200,
      body: JSON.stringify({
        name: body.name,
        message: `"${body.name}" Greengrass core device is deleted/deregistered.`
      })
    });
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  });
});
