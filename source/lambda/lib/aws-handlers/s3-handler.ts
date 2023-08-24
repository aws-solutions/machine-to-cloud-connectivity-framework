// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3 from 'aws-sdk/clients/s3';
import {
  CopyObjectRequest,
  DeleteBucketRequest,
  DeleteObjectRequest,
  DeleteObjectsRequest,
  GetObjectRequest,
  GetSignedUrlRequest,
  PutObjectRequest,
  ListObjectVersionsRequest
} from '../types/s3-handler-types';
import { getAwsSdkOptions } from '../utils';

const s3 = new S3(getAwsSdkOptions({ signatureVersion: 'v4' }));

export default class S3Handler {
  /**
   * Gets an object from an S3 bucket.
   * @param params The S3 get object parameters
   * @returns The output of S3 get object
   */
  async getObject(params: GetObjectRequest): Promise<S3.GetObjectOutput> {
    const { bucket, key } = params;
    return s3.getObject({ Bucket: bucket, Key: key }).promise();
  }

  /**
   * Copies an object from the source S3 bucket to the destination S3 bucket.
   * @param params The S3 copy object parameters
   */
  async copyObject(params: CopyObjectRequest): Promise<void> {
    const { destinationBucket, destinationKey, sourceBucketKey } = params;
    await s3.copyObject({ Bucket: destinationBucket, Key: destinationKey, CopySource: sourceBucketKey }).promise();
  }

  /**
   * Puts an object into an S3 bucket.
   * @param params The S3 put object parameters
   */
  async putObject(params: PutObjectRequest): Promise<void> {
    const { body, contentType, destinationBucket, destinationKey } = params;
    await s3
      .putObject({ Body: body, ContentType: contentType, Bucket: destinationBucket, Key: destinationKey })
      .promise();
  }

  /**
   * Gets the S3 signed URL.
   * @param params The S3 get signed URL parameters.
   * @returns The signed URL
   */
  async getSignedUrl(params: GetSignedUrlRequest): Promise<string> {
    const { bucket, expires, key, operation } = params;
    return s3.getSignedUrlPromise(operation, { Bucket: bucket, Key: key, Expires: expires });
  }

  /**
   * Deletes an object from an S3 bucket.
   * @param params The S3 delete object parameters
   */
  public async deleteObject(params: DeleteObjectRequest): Promise<void> {
    const { sourceBucket, sourceKey } = params;
    await s3.deleteObject({ Bucket: sourceBucket, Key: sourceKey }).promise();
  }

  /**
   * Deletes multiple objects from an S3 bucket.
   * @param params The S3 delete objects parameters
   */
  async deleteObjects(params: DeleteObjectsRequest): Promise<void> {
    if (params.keys.length > 0) {
      const deleteRequest: S3.Types.DeleteObjectsRequest = {
        Bucket: params.bucketName,
        Delete: {
          Objects: params.keys
        }
      };

      console.log(`Deleting keys from bucket ${params.bucketName}: ${params.keys}`);

      await s3.deleteObjects(deleteRequest).promise();
    }
  }

  /**
   * Deletes a bucket from S3
   * @param params The S3 delete bucket parameters
   */
  async deleteBucket(params: DeleteBucketRequest): Promise<void> {
    const deleteBucketRequest: S3.Types.DeleteBucketRequest = {
      Bucket: params.bucketName
    };
    console.log(`Deleting bucket ${params.bucketName}`);
    await s3.deleteBucket(deleteBucketRequest).promise();
  }

  /**
   * Lists objects in a bucket with versions
   * @param params The S3 list object parameters
   * @returns s3 list objects response
   */
  async listObjectVersions(params: ListObjectVersionsRequest): Promise<S3.Types.ListObjectVersionsOutput> {
    const listObjectVersionsRequest: S3.Types.ListObjectVersionsRequest = {
      Bucket: params.bucketName
    };

    return s3.listObjectVersions(listObjectVersionsRequest).promise();
  }
}
