// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  buildResponseBody,
  consoleErrorSpy,
  mockAxios,
  mockIoTHandler,
  mockValues,
  sendAnonymousMetricsSpy
} from './mock';
import { handler } from '../index';
import { LambdaError } from '../../lib/errors';
import {
  RequestTypes,
  ResourceTypes,
  SendAnonymousMetricProperties,
  StatusTypes
} from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

describe('Test CREATE_UUID', () => {
  beforeEach(() => mockAxios.put.mockReset());

  test('Test success to create UUID', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: { UUID: mockValues.uuid }
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
  });

  test('Nothing happens when the request type is not "Create"', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
  });
});

describe('Test SEND_ANONYMOUS_METRICS', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = <SendAnonymousMetricProperties>{
      Resource: ResourceTypes.SEND_ANONYMOUS_METRICS,
      SolutionUUID: mockValues.uuid
    };
  });
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAxios.put.mockReset();
    sendAnonymousMetricsSpy.mockReset();
  });

  test('Test success to send when creating a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        ExistingKinesisStream: false,
        ExistingTimestreamDatabase: false,
        Region: process.env.AWS_REGION,
        EventType: 'DeployStack'
      },
      (<SendAnonymousMetricProperties>event.ResourceProperties).SolutionUUID
    );
  });

  test('Test success to send when updating a solution', async () => {
    event.RequestType = RequestTypes.UPDATE;
    event.ResourceProperties = <SendAnonymousMetricProperties>{
      Resource: ResourceTypes.SEND_ANONYMOUS_METRICS,
      ExistingKinesisStream: 'mock-stream',
      ExistingTimestreamDatabase: '',
      SolutionUUID: mockValues.uuid
    };

    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        ExistingKinesisStream: true,
        ExistingTimestreamDatabase: false,
        Region: process.env.AWS_REGION,
        EventType: 'UpdateStack'
      },
      (<SendAnonymousMetricProperties>event.ResourceProperties).SolutionUUID
    );
  });

  test('Test success to send when deleting a solution', async () => {
    event.RequestType = RequestTypes.DELETE;
    event.ResourceProperties = <SendAnonymousMetricProperties>{
      Resource: ResourceTypes.SEND_ANONYMOUS_METRICS,
      ExistingKinesisStream: '',
      ExistingTimestreamDatabase: 'mock-database',
      SolutionUUID: mockValues.uuid
    };

    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    sendAnonymousMetricsSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledTimes(1);
    expect(sendAnonymousMetricsSpy).toHaveBeenCalledWith(
      {
        ExistingKinesisStream: false,
        ExistingTimestreamDatabase: true,
        Region: process.env.AWS_REGION,
        EventType: 'DeleteStack'
      },
      (<SendAnonymousMetricProperties>event.ResourceProperties).SolutionUUID
    );
  });

  test('Test failure when request type is not supported', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.RequestType = <any>'Invalid';
    const errorMessage = `Not supported request type: ${event.RequestType}`;

    mockAxios.put.mockResolvedValueOnce({ status: 200 });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response,
      reason: errorMessage
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.FAILED,
      Data: {
        Error: errorMessage
      }
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[custom-resource]',
      'Error: ',
      new LambdaError({
        message: errorMessage,
        name: 'NotSupportedRequestType',
        statusCode: 400
      })
    );
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
  });
});

describe('Test DESCRIBE_IOT_ENDPOINT', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = {
      Resource: ResourceTypes.DESCRIBE_IOT_ENDPOINT
    };
  });
  beforeEach(() => {
    mockAxios.put.mockReset();
    mockIoTHandler.describeIoTEndpoint.mockReset();
  });

  test('Test success to describe IoT endpoint', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.describeIoTEndpoint
      .mockResolvedValueOnce(mockValues.iotEndpoint.credentialProvider)
      .mockResolvedValueOnce(mockValues.iotEndpoint.dataAts);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {
        CredentialProviderEndpoint: mockValues.iotEndpoint.credentialProvider,
        DataAtsEndpoint: mockValues.iotEndpoint.dataAts
      }
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.describeIoTEndpoint).toHaveBeenCalledTimes(2);
    expect(mockIoTHandler.describeIoTEndpoint).toHaveBeenNthCalledWith(1, 'iot:CredentialProvider');
    expect(mockIoTHandler.describeIoTEndpoint).toHaveBeenNthCalledWith(2, 'iot:Data-ATS');
  });

  test('Nothing happens when the request type is not "Create"', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.describeIoTEndpoint).not.toHaveBeenCalled();
  });
});
