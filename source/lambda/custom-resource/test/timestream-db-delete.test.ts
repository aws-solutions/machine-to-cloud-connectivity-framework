// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildResponseBody, consoleErrorSpy, mockAxios, mockTimestreamHandler, mockValues } from './mock';
import { handler } from '../index';
import {
  DeleteTimestreamDatabaseProperties,
  RequestTypes,
  ResourceTypes,
  StatusTypes
} from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

// jest.useFakeTimers();
// jest.setTimeout(10000);

describe('Test DELETE_TIMESTREAM_DATABASE', () => {
  const db = 'test-database-name';
  const table = 'test-table-name';
  beforeAll(() => {
    event.ResourceProperties = <DeleteTimestreamDatabaseProperties>{
      Resource: ResourceTypes.DELETE_TIMESTREAM_DATABASE,
      DatabaseName: db
    };
  });
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAxios.put.mockReset();
    mockTimestreamHandler.deleteDatabase.mockReset();
    mockTimestreamHandler.deleteTable.mockReset();
    mockTimestreamHandler.listTables.mockReset();
  });

  test('Test success to delete database when tearing down a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockTimestreamHandler.listTables.mockImplementation(() => Promise.resolve(listTablesResponse));
    mockTimestreamHandler.deleteTable.mockImplementation(() => Promise.resolve());
    mockTimestreamHandler.deleteDatabase.mockImplementation(() => Promise.resolve());

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

    expect(mockTimestreamHandler.listTables).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.listTables).toHaveBeenCalledWith({
      databaseName: db
    });
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledWith({
      databaseName: db,
      tableName: table
    });
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledWith({
      databaseName: db
    });
  });

  test('Test nothing happens when creating a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockTimestreamHandler.listTables.mockImplementation(() => Promise.resolve(listTablesResponse));
    mockTimestreamHandler.deleteTable.mockImplementation(() => Promise.resolve());
    mockTimestreamHandler.deleteDatabase.mockImplementation(() => Promise.resolve());

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

    expect(mockTimestreamHandler.listTables).toHaveBeenCalledTimes(0);
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledTimes(0);
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledTimes(0);
  });

  test('Test nothing happens when updating a solution', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockTimestreamHandler.listTables.mockImplementation(() => Promise.resolve(listTablesResponse));
    mockTimestreamHandler.deleteTable.mockImplementation(() => Promise.resolve());
    mockTimestreamHandler.deleteDatabase.mockImplementation(() => Promise.resolve());

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

    expect(mockTimestreamHandler.listTables).toHaveBeenCalledTimes(0);
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledTimes(0);
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledTimes(0);
  });

  /**
   * Used for error handling testing
   * @param code
   */
  function customError(code) {
    this.code = code;
  }

  test('Test resource not found exceptions while deleting database', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockTimestreamHandler.listTables.mockImplementation(() => Promise.resolve(listTablesResponse));
    mockTimestreamHandler.deleteDatabase.mockImplementation(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockTimestreamHandler.deleteTable.mockImplementation(() => {
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

    expect(mockTimestreamHandler.listTables).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.listTables).toHaveBeenCalledWith({
      databaseName: db
    });
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledWith({
      databaseName: db,
      tableName: table
    });
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledWith({
      databaseName: db
    });
  });

  test('Test thrown exceptions while deleting database', async () => {
    const mockError = 'mock-error';
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockTimestreamHandler.listTables.mockImplementation(() => Promise.resolve(listTablesResponse));
    mockTimestreamHandler.deleteTable.mockImplementationOnce(() => Promise.resolve());

    customError.prototype = Error.prototype;
    mockTimestreamHandler.deleteDatabase.mockImplementationOnce(() => {
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
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);

    expect(mockTimestreamHandler.listTables).toHaveBeenCalledTimes(2);
    expect(mockTimestreamHandler.deleteTable).toHaveBeenCalledTimes(2);
    expect(mockTimestreamHandler.deleteDatabase).toHaveBeenCalledTimes(2);
  });
});
