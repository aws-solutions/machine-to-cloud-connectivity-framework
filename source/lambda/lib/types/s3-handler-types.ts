// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface GetObjectRequest {
  bucket: string;
  key: string;
}

export interface CopyObjectRequest {
  destinationBucket: string;
  destinationKey: string;
  sourceBucketKey: string;
}

export interface PutObjectRequest {
  body: Buffer | string;
  contentType: string;
  destinationBucket: string;
  destinationKey: string;
}

export interface GetSignedUrlRequest {
  bucket: string;
  expires: number;
  key: string;
  operation: string;
}

export interface DeleteObjectRequest {
  sourceBucket: string;
  sourceKey: string;
}
