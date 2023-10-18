// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsTimestreamWrite } from './mock';
import TimestreamHandler from '../aws-handlers/timestream-handler';

const database = 'database';
const table = 'table';
const timestream = new TimestreamHandler(database, table);
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

    await timestream.write(mockRecords);
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

    await expect(timestream.write(mockRecords)).rejects.toEqual('Failure');
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledTimes(1);
    expect(mockAwsTimestreamWrite.writeRecords).toHaveBeenCalledWith({
      DatabaseName: database,
      Records: mockRecords,
      TableName: table
    });
  });
});
