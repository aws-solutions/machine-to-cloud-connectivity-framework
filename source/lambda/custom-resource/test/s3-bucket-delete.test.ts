// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildResponseBody, consoleErrorSpy, mockAxios, mockS3Handler, mockValues } from './mock';
import { handler } from '../index';
import {
  DeleteS3BucketProperties,
  RequestTypes,
  ResourceTypes,
  StatusTypes
} from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

// jest.useFakeTimers();
// jest.setTimeout(10000);

describe('Test DELETE_S3_BUCKET', () => {
  const bucket = 'test-bucket-name';
  const key = 'test-key';
  const versionId = 'test-version-id';
  beforeAll(() => {
    event.ResourceProperties = <DeleteS3BucketProperties>{
      Resource: ResourceTypes.DELETE_S3_BUCKET,
      BucketName: bucket
    };
  });
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAxios.put.mockReset();
    mockS3Handler.deleteBucket.mockReset();
    mockS3Handler.deleteObjects.mockReset();
    mockS3Handler.listObjectVersions.mockReset();
  });

  test('Test success to delete bucket when tearing down a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listBodyResponse = {
      Versions: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    };
    mockS3Handler.listObjectVersions.mockImplementationOnce(() => Promise.resolve(listBodyResponse));
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());
    mockS3Handler.deleteBucket.mockImplementationOnce(() => Promise.resolve());

    event.RequestType = RequestTypes.DELETE;

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
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledWith({
      bucketName: bucket
    });
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledWith({
      bucketName: bucket,
      keys: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    });
  });

  test('Test nothing happens when creating a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.listObjectVersions.mockImplementationOnce(() => Promise.resolve());
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());
    mockS3Handler.deleteBucket.mockImplementationOnce(() => Promise.resolve());

    event.RequestType = RequestTypes.CREATE;

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
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(0);
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(0);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(0);
  });

  test('Test nothing happens when updating a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.listObjectVersions.mockImplementationOnce(() => Promise.resolve());
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());
    mockS3Handler.deleteBucket.mockImplementationOnce(() => Promise.resolve());

    event.RequestType = RequestTypes.UPDATE;

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
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(0);
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(0);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(0);
  });

  /**
   * Used for error handling testing
   * @param code
   */
  function customError(code) {
    this.code = code;
  }

  test('Test resource not found exceptions while deleting bucket', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listBodyResponse = {
      Versions: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    };
    mockS3Handler.listObjectVersions.mockImplementationOnce(() => Promise.resolve(listBodyResponse));
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockS3Handler.deleteBucket.mockImplementationOnce(() => {
      throw new customError('ResourceNotFoundException');
    });

    event.RequestType = RequestTypes.DELETE;

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
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledWith({
      bucketName: bucket,
      keys: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    });
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(1);
  });

  test('Test bucket not empty exceptions while deleting bucket', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listBodyResponse = {
      Versions: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    };
    mockS3Handler.listObjectVersions.mockImplementation(() => Promise.resolve(listBodyResponse));
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockS3Handler.deleteBucket.mockImplementationOnce(() => {
      throw new customError('BucketNotEmpty');
    });

    event.RequestType = RequestTypes.DELETE;

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
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(2);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(2);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledWith({
      bucketName: bucket,
      keys: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    });
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(2);
  });

  test('Test thrown exceptions while listing objects', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const mockError = 'mock-error';
    mockS3Handler.listObjectVersions.mockImplementation(() => {
      throw new Error(mockError);
    });
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockS3Handler.deleteBucket.mockImplementationOnce(() => Promise.resolve());

    event.RequestType = RequestTypes.DELETE;

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.FAILED,
      Data: {
        Error: mockError
      }
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(0);
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(0);
  });

  test('Test thrown exceptions while deleting bucket', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const mockError = 'mock-error';
    const listBodyResponse = {
      Versions: [
        {
          Key: key,
          VersionId: versionId
        }
      ]
    };
    mockS3Handler.listObjectVersions.mockImplementation(() => Promise.resolve(listBodyResponse));
    mockS3Handler.deleteObjects.mockImplementationOnce(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockS3Handler.deleteBucket.mockImplementationOnce(() => {
      throw new Error(mockError);
    });

    event.RequestType = RequestTypes.DELETE;

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;

    expect(response).toEqual({
      Status: StatusTypes.FAILED,
      Data: {
        Error: mockError
      }
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.listObjectVersions).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteObjects).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.deleteBucket).toHaveBeenCalledTimes(1);
  });
});
