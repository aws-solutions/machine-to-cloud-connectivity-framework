// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildResponseBody, mockAxios, mockS3Handler, mockValues } from './mock';
import { handler } from '../index';
import {
  CopyUiAssetsProperties,
  CreateUiConfigProperties,
  RequestTypes,
  ResourceTypes,
  StatusTypes
} from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

describe('Test COPY_UI_ASSETS', () => {
  const manifestFile = 'mock-manifest.json';
  const manifestList = ['ui/index.html', 'ui/script.js', 'ui/static/style.css', 'ui/static/script/script/js'];

  beforeAll(() => {
    event.ResourceProperties = <CopyUiAssetsProperties>{
      Resource: ResourceTypes.COPY_UI_ASSETS,
      DestinationBucket: mockValues.destinationBucket,
      ManifestFile: manifestFile,
      SourceBucket: mockValues.sourceBucket,
      SourcePrefix: mockValues.sourcePrefix
    };
  });
  beforeEach(() => {
    mockAxios.put.mockReset();
    mockS3Handler.copyObject.mockReset();
    mockS3Handler.getObject.mockReset();
  });

  test('Test success to copy UI assets when creating a stack', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.copyObject.mockResolvedValue(undefined);
    mockS3Handler.getObject.mockResolvedValueOnce({
      Body: JSON.stringify(manifestList)
    });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CopyUiAssetsProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.copyObject).toHaveBeenCalledTimes(manifestList.length);
    for (let i = 0, length = manifestList.length; i < length; i++) {
      expect(mockS3Handler.copyObject).toHaveBeenNthCalledWith(i + 1, {
        destinationBucket: resourceProperties.DestinationBucket,
        destinationKey: manifestList[i].split('/').slice(1).join('/'),
        sourceBucketKey: [resourceProperties.SourceBucket, resourceProperties.SourcePrefix, manifestList[i]].join('/')
      });
    }
    expect(mockS3Handler.getObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.getObject).toHaveBeenCalledWith({
      bucket: resourceProperties.SourceBucket,
      key: [resourceProperties.SourcePrefix, resourceProperties.ManifestFile].join('/')
    });
  });

  test('Test success to copy UI assets when updating a stack', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.copyObject.mockResolvedValue(undefined);
    mockS3Handler.getObject.mockResolvedValueOnce({
      Body: JSON.stringify(manifestList)
    });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CopyUiAssetsProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.copyObject).toHaveBeenCalledTimes(manifestList.length);
    for (let i = 0, length = manifestList.length; i < length; i++) {
      expect(mockS3Handler.copyObject).toHaveBeenNthCalledWith(i + 1, {
        destinationBucket: resourceProperties.DestinationBucket,
        destinationKey: manifestList[i].split('/').slice(1).join('/'),
        sourceBucketKey: [resourceProperties.SourceBucket, resourceProperties.SourcePrefix, manifestList[i]].join('/')
      });
    }
    expect(mockS3Handler.getObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.getObject).toHaveBeenCalledWith({
      bucket: resourceProperties.SourceBucket,
      key: [resourceProperties.SourcePrefix, resourceProperties.ManifestFile].join('/')
    });
  });

  test('Nothing happens when deleting a stack', async () => {
    event.RequestType = RequestTypes.DELETE;
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
    expect(mockS3Handler.copyObject).not.toHaveBeenCalled();
    expect(mockS3Handler.getObject).not.toHaveBeenCalled();
  });
});

describe('Test CREATE_UI_CONFIG', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = <CreateUiConfigProperties>{
      Resource: ResourceTypes.CREATE_UI_CONFIG,
      ApiEndpoint: mockValues.uiConfig.apiEndpoint,
      DestinationBucket: mockValues.destinationBucket,
      ConfigFileName: mockValues.uiConfig.configFileName,
      IdentityPoolId: mockValues.uiConfig.identityPoolId,
      LoggingLevel: process.env.LOGGING_LEVEL,
      S3Bucket: mockValues.uiConfig.s3Bucket,
      UserPoolId: mockValues.uiConfig.userPoolId,
      WebClientId: mockValues.uiConfig.webClientId
    };
  });
  beforeEach(() => {
    mockAxios.put.mockReset();
    mockS3Handler.putObject.mockReset();
  });

  test('Test success to create UI config file when creating a stack', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.putObject.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CreateUiConfigProperties>event.ResourceProperties;
    const uiConfig = {
      apiEndpoint: resourceProperties.ApiEndpoint,
      identityPoolId: resourceProperties.IdentityPoolId,
      loggingLevel: resourceProperties.LoggingLevel,
      region: process.env.AWS_REGION,
      s3Bucket: resourceProperties.S3Bucket,
      userPoolId: resourceProperties.UserPoolId,
      webClientId: resourceProperties.WebClientId
    };

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.putObject).toHaveBeenCalledWith({
      body: `var config = ${JSON.stringify(uiConfig, null, 2)};`,
      contentType: 'application/javascript',
      destinationBucket: resourceProperties.DestinationBucket,
      destinationKey: resourceProperties.ConfigFileName
    });
  });

  test('Test success to create UI config file when updating a stack', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.putObject.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CreateUiConfigProperties>event.ResourceProperties;
    const uiConfig = {
      apiEndpoint: resourceProperties.ApiEndpoint,
      identityPoolId: resourceProperties.IdentityPoolId,
      loggingLevel: resourceProperties.LoggingLevel,
      region: process.env.AWS_REGION,
      s3Bucket: resourceProperties.S3Bucket,
      userPoolId: resourceProperties.UserPoolId,
      webClientId: resourceProperties.WebClientId
    };

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.putObject).toHaveBeenCalledWith({
      body: `var config = ${JSON.stringify(uiConfig, null, 2)};`,
      contentType: 'application/javascript',
      destinationBucket: resourceProperties.DestinationBucket,
      destinationKey: resourceProperties.ConfigFileName
    });
  });

  test('Nothing happens when deleting a stack', async () => {
    event.RequestType = RequestTypes.DELETE;
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
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
  });
});
