// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsTimestreamWrite } from './mock';
import TimestreamHandler from '../aws-handlers/timestream-handler';
import { WriteRecordsRequest, ListTablesRequest } from '../types/timestream-handler-types';

const database = 'database';
const table = 'table';
const timestream = new TimestreamHandler();
const mockRecords = [
  {
    Dimensions: [
      {
        Name: 'site',
        Value: 'mock-site',
        DimensionValueType: 'VARCHAR'
      }
    ],
    MeasureName: 'Random.Int2',
    MeasureValue: '1',
    MeasureValueType: 'DOUBLE',
    Time: '1647024434667',
    TimeUnit: 'MILLISECONDS'
  }
];

describe('Unit tests of write() function', () => {
  beforeEach(() => mockAwsTimestreamWrite.writeRecords.mockReset());

  test('Test success to write records', async () => {
    mockAwsTimestreamWrite.writeRecords.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    const request: WriteRecordsRequest = {
      databaseName: database,
      tableName: table,
      records: mockRecords
    };

    await timestream.write(request);
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledWith({
      DatabaseName: database,
      Records: mockRecords,
      TableName: table
    });
  });

  test('Test failure to write records', async () => {
    mockAwsTimestreamWrite.writeRecords.mockImplementation(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const request: WriteRecordsRequest = {
      databaseName: database,
      tableName: table,
      records: mockRecords
    };

    await expect(timestream.write(request)).rejects.toEqual('Failure');
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledWith({
      DatabaseName: database,
      Records: mockRecords,
      TableName: table
    });
  });
});

describe('Unit tests of listTables() function', () => {
  beforeEach(() => mockAwsTimestreamWrite.listTables.mockReset());

  const db = 'test-database-name';
  const table = 'test-table-name';

  test('Test success to listTables records', async () => {
    const listTablesResponse = {
      Tables: [
        {
          TableName: table,
          DatabaseName: db
        }
      ]
    };
    mockAwsTimestreamWrite.listTables.mockImplementation(() => ({
      promise() {
        return Promise.resolve(listTablesResponse);
      }
    }));
    const request: ListTablesRequest = {
      databaseName: db
    };

    const response = await timestream.listTables(request);
    expect(mockAwsTimestreamWrite.listTables).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.listTables).toHaveBeenCalledWith({
      DatabaseName: db
    });
    expect(response.Tables.length).toBe(1);
    expect(response.Tables[0].TableName).toBe(table);
    expect(response.Tables[0].DatabaseName).toBe(db);
  });
});

describe('Unit tests of deleteTable() function', () => {
  beforeEach(() => mockAwsTimestreamWrite.deleteTable.mockReset());

  const db = 'test-database-name';
  const table = 'test-table-name';

  test('Test success to deleteTable records', async () => {
    mockAwsTimestreamWrite.deleteTable.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    const request = {
      databaseName: db,
      tableName: table
    };
    await timestream.deleteTable(request);
    expect(mockAwsTimestreamWrite.deleteTable).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.deleteTable).toHaveBeenCalledWith({
      DatabaseName: db,
      TableName: table
    });
  });
});

describe('Unit tests of deleteDatabase() function', () => {
  beforeEach(() => mockAwsTimestreamWrite.deleteDatabase.mockReset());

  const db = 'test-database-name';

  test('Test success to deleteDatabase records', async () => {
    mockAwsTimestreamWrite.deleteDatabase.mockImplementation(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    const request = {
      databaseName: db
    };
    await timestream.deleteDatabase(request);
    expect(mockAwsTimestreamWrite.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.deleteDatabase).toHaveBeenCalledWith({
      DatabaseName: db
    });
  });
});
