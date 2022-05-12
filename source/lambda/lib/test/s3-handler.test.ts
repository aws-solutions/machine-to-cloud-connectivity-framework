// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsS3 } from './mock';
import S3Handler from '../aws-handlers/s3-handler';

const body = 'mock-body';
const bodyResponse = { Body: body };
const contentType = 'text/plain';
const destinationBucket = 'mock-destination-bucket';
const key = 'mock-key';
const signedUrl = 'https://mock-signed-url';
const sourceBucket = 'mock-source-bucket';
const sourceKey = 'mock-source-key';
const handler = new S3Handler();

describe('Unit tests of getObject() function', () => {
  beforeEach(() => mockAwsS3.getObject.mockReset());

  test('Test success to get object', async () => {
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve(bodyResponse);
      }
    }));

    const response = await handler.getObject({
      bucket: sourceBucket,
      key
    });

    expect(response).toEqual(bodyResponse);
    expect(mockAwsS3.getObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: sourceBucket,
      Key: key
    });
  });

  test('Test failure to get object', async () => {
    mockAwsS3.getObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(
      handler.getObject({
        bucket: sourceBucket,
        key
      })
    ).rejects.toEqual('Failure');

    expect(mockAwsS3.getObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.getObject).toHaveBeenCalledWith({
      Bucket: sourceBucket,
      Key: key
    });
  });
});

describe('Unit tests of copyObject() function', () => {
  beforeEach(() => mockAwsS3.copyObject.mockReset());

  test('Test success to copy object', async () => {
    mockAwsS3.copyObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await handler.copyObject({
      destinationBucket,
      destinationKey: key,
      sourceBucketKey: key
    });

    expect(mockAwsS3.copyObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.copyObject).toHaveBeenCalledWith({
      Bucket: destinationBucket,
      Key: key,
      CopySource: key
    });
  });

  test('Test failure to copy object', async () => {
    mockAwsS3.copyObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(
      handler.copyObject({
        destinationBucket,
        destinationKey: key,
        sourceBucketKey: key
      })
    ).rejects.toEqual('Failure');
    expect(mockAwsS3.copyObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.copyObject).toHaveBeenCalledWith({
      Bucket: destinationBucket,
      Key: key,
      CopySource: key
    });
  });
});

describe('Unit tests of putObject() function', () => {
  beforeEach(() => mockAwsS3.putObject.mockReset());

  test('Test success to put object', async () => {
    mockAwsS3.putObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await handler.putObject({
      body,
      contentType,
      destinationBucket,
      destinationKey: key
    });

    expect(mockAwsS3.putObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.putObject).toHaveBeenCalledWith({
      Body: body,
      ContentType: contentType,
      Bucket: destinationBucket,
      Key: key
    });
  });

  test('Test failure to get object', async () => {
    mockAwsS3.putObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(
      handler.putObject({
        body,
        contentType,
        destinationBucket,
        destinationKey: key
      })
    ).rejects.toEqual('Failure');

    expect(mockAwsS3.putObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.putObject).toHaveBeenCalledWith({
      Body: body,
      ContentType: contentType,
      Bucket: destinationBucket,
      Key: key
    });
  });
});

describe('Unit tests of getSignedUrl() function', () => {
  beforeEach(() => mockAwsS3.getSignedUrlPromise.mockReset());

  test('Test success to get object', async () => {
    mockAwsS3.getSignedUrlPromise.mockResolvedValueOnce(signedUrl);

    const response = await handler.getSignedUrl({
      bucket: sourceBucket,
      expires: 3600,
      key,
      operation: 'GetObject'
    });

    expect(response).toEqual(signedUrl);
    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenCalledWith('GetObject', {
      Bucket: sourceBucket,
      Key: key,
      Expires: 3600
    });
  });

  test('Test failure to get object', async () => {
    mockAwsS3.getSignedUrlPromise.mockRejectedValueOnce('Failure');

    await expect(
      handler.getSignedUrl({
        bucket: sourceBucket,
        expires: 3600,
        key,
        operation: 'GetObject'
      })
    ).rejects.toEqual('Failure');

    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.getSignedUrlPromise).toHaveBeenCalledWith('GetObject', {
      Bucket: sourceBucket,
      Key: key,
      Expires: 3600
    });
  });
});

describe('Unit tests of deleteObject() function', () => {
  beforeEach(() => mockAwsS3.deleteObject.mockReset());

  test('Test success to delete object', async () => {
    mockAwsS3.deleteObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await handler.deleteObject({ sourceBucket, sourceKey });

    expect(mockAwsS3.deleteObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.deleteObject).toHaveBeenCalledWith({
      Bucket: sourceBucket,
      Key: sourceKey
    });
  });

  test('Test failure to delete object', async () => {
    mockAwsS3.deleteObject.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(handler.deleteObject({ sourceBucket, sourceKey })).rejects.toEqual('Failure');

    expect(mockAwsS3.deleteObject).toHaveBeenCalledTimes(1);
    expect(mockAwsS3.deleteObject).toHaveBeenCalledWith({
      Bucket: sourceBucket,
      Key: sourceKey
    });
  });
});
