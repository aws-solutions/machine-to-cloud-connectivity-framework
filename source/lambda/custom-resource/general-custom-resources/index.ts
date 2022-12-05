// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { v4 } from 'uuid';
import IoTHandler from '../../lib/aws-handlers/iot-handler';
import { LambdaError } from '../../lib/errors';
import {
  IoTEndpointResponse,
  RequestTypes,
  SendAnonymousMetricsRequest,
  StackEventTypes,
  DeleteTimestreamDatabaseRequest,
  DeleteS3BucketRequest,
  UuidResponse
} from '../../lib/types/custom-resource-types';
import { StackEventMetricData } from '../../lib/types/utils-types';
import { sendAnonymousMetric } from '../../lib/utils';
import { ListTablesResponse } from 'aws-sdk/clients/timestreamwrite';
import S3 from 'aws-sdk/clients/s3';
import S3Handler from '../../lib/aws-handlers/s3-handler';
import TimestreamHandler from '../../lib/aws-handlers/timestream-handler';

const s3Handler = new S3Handler();
const timestreamHandler = new TimestreamHandler();

/**
 * Creates a solution UUID.
 * @param requestType The custom resource request type
 * @returns When it's creation, returns UUID. Otherwise, return an empty object.
 */
export function createUuid(requestType: RequestTypes): UuidResponse {
  if (requestType === RequestTypes.CREATE) {
    return { UUID: v4() };
  }

  return {};
}

/**
 * Sends anonymous metrics.
 * @param params The sending anonymous metrics parameters
 */
export async function sendAnonymousMetrics(params: SendAnonymousMetricsRequest): Promise<void> {
  /**
   * Checks if the string is not empty or not.
   * @param str The string to check
   * @returns `true` when the string is not empty, `false` when the string is empty or not a string
   */
  function isNotEmptyString(str: string): boolean {
    return typeof str === 'string' && str.trim() !== '';
  }

  const { AWS_REGION } = process.env;
  const { requestType, resourceProperties } = params;
  const { ExistingKinesisStream, ExistingTimestreamDatabase, SolutionUUID } = resourceProperties;

  const anonymousMetrics: StackEventMetricData = {
    EventType: StackEventTypes.DEPLOY,
    ExistingKinesisStream: isNotEmptyString(ExistingKinesisStream),
    ExistingTimestreamDatabase: isNotEmptyString(ExistingTimestreamDatabase),
    Region: AWS_REGION
  };

  switch (requestType) {
    case RequestTypes.CREATE:
      anonymousMetrics.EventType = StackEventTypes.DEPLOY;
      break;
    case RequestTypes.UPDATE:
      anonymousMetrics.EventType = StackEventTypes.UPDATE;
      break;
    case RequestTypes.DELETE:
      anonymousMetrics.EventType = StackEventTypes.DELETE;
      break;
    default:
      throw new LambdaError({
        name: 'NotSupportedRequestType',
        message: `Not supported request type: ${requestType}`,
        statusCode: 400
      });
  }

  await sendAnonymousMetric(anonymousMetrics, SolutionUUID);
}

/**
 * Returns IoT endpoints including Data-ATS and CredentialProvider types.
 * @param requestType The custom resource request type
 * @returns When it's creation, returns IoT endpoints. Otherwise, return an empty object.
 */
export async function describeIoTEndpoints(requestType: RequestTypes): Promise<Partial<IoTEndpointResponse>> {
  if (requestType === RequestTypes.CREATE) {
    const iotHandler = new IoTHandler();
    const [credentialProviderEndpoint, dataAtsEndpoint] = await Promise.all([
      iotHandler.describeIoTEndpoint('iot:CredentialProvider'),
      iotHandler.describeIoTEndpoint('iot:Data-ATS')
    ]);

    return {
      CredentialProviderEndpoint: credentialProviderEndpoint,
      DataAtsEndpoint: dataAtsEndpoint
    };
  }

  return {};
}

/**
 * Deletes Timestream database if deployment is configured to delete data on teardown
 * @param params The custom resource request type and the name of the db to delete
 */
export async function deleteTimestreamDatabase(params: DeleteTimestreamDatabaseRequest): Promise<void> {
  if (params.requestType === RequestTypes.DELETE) {
    // Timestream tables are eventually consistent, so we have to ensure they are shown as deleted before proceeding
    let listTablesResponse = await timestreamHandler.listTables({
      databaseName: params.resourceProperties.DatabaseName
    });
    if (listTablesResponse.Tables != undefined) {
      let threshold = 10;
      const iterationWaitMilliseconds = 1000;
      let isDeleted = false;
      while (threshold > 0 && !isDeleted) {
        try {
          await deleteTimestreamTables(listTablesResponse, params.resourceProperties.DatabaseName);
        } catch (error) {
          console.log('Delete timestream table failed.', error);
          throw error;
        }

        try {
          await timestreamHandler.deleteDatabase({ databaseName: params.resourceProperties.DatabaseName });
          isDeleted = true;
        } catch (error) {
          if (error.code === 'ResourceNotFoundException') {
            console.log(`Database ${params.resourceProperties.DatabaseName} doesn't exist.`);
            isDeleted = true;
          } else {
            console.log('Delete database failed.', error);

            // waiting for eventual consistency's sake
            await delay(iterationWaitMilliseconds);

            listTablesResponse = await timestreamHandler.listTables({
              databaseName: params.resourceProperties.DatabaseName
            });
          }
        }

        threshold--;
      }
    }
  }
}

/**
 * Simple function to sleep for prescribed time in milliseconds
 * @param milliseconds amount of time to sleep
 * @returns promise that can be awaited
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Deletes timestream tables in list tables response, part of eventual consistency logic
 * @param listTablesResponse Response from listing tables in database
 * @param databaseName Name of database
 */
async function deleteTimestreamTables(listTablesResponse: ListTablesResponse, databaseName: string): Promise<void> {
  if (listTablesResponse.Tables != undefined) {
    console.log(`Received data with tables of length: ${listTablesResponse.Tables.length}`);

    listTablesResponse.Tables.forEach(async table => {
      if (table.TableName != undefined) {
        try {
          await timestreamHandler.deleteTable({ databaseName: databaseName, tableName: table.TableName });
        } catch (error) {
          if (error.code === 'ResourceNotFoundException') {
            console.log(`Table ${table.TableName} doesn't exist.`);
          }
        }
      }
    });
  }
}

/**
 * Deletes S3 bucket if deployment is configured to delete data on teardown
 * S3 objects are eventually consistent, so we have to ensure they are shown as deleted before proceeding
 * @param params The custom resource request type and the name of the bucket to delete
 */
export async function deleteS3Bucket(params: DeleteS3BucketRequest): Promise<void> {
  if (params.requestType === RequestTypes.DELETE) {
    let listObjectsResponse = await s3Handler.listObjectVersions({ bucketName: params.resourceProperties.BucketName });

    if (listObjectsResponse.Versions != undefined) {
      let threshold = 10;
      const iterationWaitMilliseconds = 1000;
      let isDeleted = false;
      while (threshold > 0 && !isDeleted) {
        try {
          await deleteBucketObjects(listObjectsResponse, params.resourceProperties.BucketName);
        } catch (error) {
          if (error.code === 'ResourceNotFoundException') {
            console.log('Tried deleting object that did not exist');
          } else {
            console.log('Delete s3 objects failed.', error);
            throw error;
          }
        }

        try {
          await s3Handler.deleteBucket({ bucketName: params.resourceProperties.BucketName });
          isDeleted = true;
        } catch (error) {
          if (error.code === 'ResourceNotFoundException') {
            console.log(`Bucket ${params.resourceProperties.BucketName} doesn't exist.`);
            isDeleted = true;
          } else if (error.code === 'BucketNotEmpty') {
            console.log(`Bucket ${params.resourceProperties.BucketName} not empty.`, error);
            isDeleted = false;

            // waiting for eventual consistency's sake
            await delay(iterationWaitMilliseconds);

            listObjectsResponse = await s3Handler.listObjectVersions({
              bucketName: params.resourceProperties.BucketName
            });
          } else {
            console.log('Delete bucket failed.', error);
            throw error;
          }
        }

        threshold--;
      }
    }
  }
}

/**
 * Deletes objects in a bucket, part of eventual consistency logic noted in parent method
 * @param listObjectsResponse Response from listing objects
 * @param bucketName Name of bucket to delete objects from
 */
async function deleteBucketObjects(
  listObjectsResponse: S3.Types.ListObjectVersionsOutput,
  bucketName: string
): Promise<void> {
  const keys = [];
  listObjectsResponse.Versions.forEach(content => {
    if (content.Key != undefined && content.VersionId == undefined) {
      keys.push({
        Key: content.Key
      });
    } else if (content.Key != undefined && content.VersionId != undefined) {
      keys.push({
        Key: content.Key,
        VersionId: content.VersionId
      });
    }
  });
  await s3Handler.deleteObjects({ bucketName: bucketName, keys: keys });
}
