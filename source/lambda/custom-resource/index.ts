// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  createUuid,
  describeIoTEndpoints,
  sendAnonymousMetrics,
  deleteS3Bucket,
  deleteTimestreamDatabase
} from './general-custom-resources';
import {
  copyGreengrassComponentsArtifact,
  createGreengrassInstallationScripts,
  manageIoTRoleAlias,
  deleteIoTCertificate
} from './greengrass-custom-resources';
import { copyUiAssets, createUiConfig } from './ui-custom-resources';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import {
  CopyGreengrassComponentArtifactProperties,
  CopyUiAssetsProperties,
  CreateGreengrassInstallationScriptsProperties,
  CreateUiConfigProperties,
  CustomResourceResponse,
  DeleteIoTCertificateProperties,
  EventRequest,
  LambdaContext,
  ManageIoTRoleAliasProperties,
  ResourceTypes,
  SendAnonymousMetricProperties,
  StatusTypes,
  DeleteTimestreamDatabaseProperties,
  DeleteS3BucketProperties
} from '../lib/types/custom-resource-types';

const { LOGGING_LEVEL } = process.env;
const logger = new Logger('custom-resource', LOGGING_LEVEL);

/**
 * Handles the custom resource requests.
 * @param event The custom resource event
 * @param context The Lambda function context
 * @returns The custom resource response
 */
export async function handler(event: EventRequest, context: LambdaContext): Promise<CustomResourceResponse> {
  logger.log(LoggingLevel.INFO, `Event: ${JSON.stringify(event, null, 2)}`);

  const { RequestType, ResourceProperties } = event;
  const { Resource } = ResourceProperties;
  const response: CustomResourceResponse = {
    Status: StatusTypes.SUCCESS,
    Data: {}
  };
  let reason = `See the details in CloudWatch Log Stream: ${context.logStreamName}`;

  try {
    switch (Resource) {
      case ResourceTypes.CREATE_UUID:
        response.Data = createUuid(RequestType);
        break;
      case ResourceTypes.SEND_ANONYMOUS_METRICS: {
        await sendAnonymousMetrics({
          requestType: RequestType,
          resourceProperties: <SendAnonymousMetricProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.DESCRIBE_IOT_ENDPOINT:
        response.Data = await describeIoTEndpoints(RequestType);
        break;
      case ResourceTypes.COPY_UI_ASSETS:
        await copyUiAssets({
          requestType: RequestType,
          resourceProperties: <CopyUiAssetsProperties>ResourceProperties
        });
        break;
      case ResourceTypes.CREATE_UI_CONFIG:
        await createUiConfig({
          requestType: RequestType,
          resourceProperties: <CreateUiConfigProperties>ResourceProperties
        });
        break;
      case ResourceTypes.MANAGE_IOT_ROLE_ALIAS: {
        await manageIoTRoleAlias({
          requestType: RequestType,
          resourceProperties: <ManageIoTRoleAliasProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.COPY_GREENGRASS_COMPONENTS_ARTIFACT: {
        await copyGreengrassComponentsArtifact({
          requestType: RequestType,
          resourceProperties: <CopyGreengrassComponentArtifactProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.CREATE_GREENGRASS_INSTALLATION_SCRIPTS: {
        response.Data = await createGreengrassInstallationScripts({
          requestType: RequestType,
          resourceProperties: <CreateGreengrassInstallationScriptsProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.DELETE_IOT_CERTIFICATE: {
        await deleteIoTCertificate({
          requestType: RequestType,
          resourceProperties: <DeleteIoTCertificateProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.DELETE_TIMESTREAM_DATABASE: {
        await deleteTimestreamDatabase({
          requestType: RequestType,
          resourceProperties: <DeleteTimestreamDatabaseProperties>ResourceProperties
        });
        break;
      }
      case ResourceTypes.DELETE_S3_BUCKET: {
        await deleteS3Bucket({
          requestType: RequestType,
          resourceProperties: <DeleteS3BucketProperties>ResourceProperties
        });
        break;
      }
      default:
        throw new LambdaError({
          message: `Not supported custom resource type: ${Resource}`,
          name: 'NotSupportedCustomResourceType',
          statusCode: 400
        });
    }
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'Error: ', error);

    response.Status = StatusTypes.FAILED;
    response.Data = { Error: error.message };
    reason = error.message;
  }

  const cloudFormationResponse = await sendCloudFormationResponse(event, response, reason);
  logger.log(
    LoggingLevel.INFO,
    `Status text: ${cloudFormationResponse.statusText}, code: ${
      cloudFormationResponse.status
    }, response: ${JSON.stringify(response)}`
  );

  return response;
}

/**
 * Sends a response to the CloudFormation response URL.
 * @param event The custom resource event
 * @param response The custom resource response
 * @param reason The error reason
 * @returns The response from the CloudFront response URL
 */
async function sendCloudFormationResponse(
  event: EventRequest,
  response: CustomResourceResponse,
  reason: string
): Promise<AxiosResponse> {
  const responseBody = JSON.stringify({
    Status: response.Status,
    Reason: reason,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data
  });
  logger.log(LoggingLevel.DEBUG, `Response body: ${JSON.stringify(responseBody, null, 2)}`);

  const config: AxiosRequestConfig = {
    headers: {
      'Content-Length': `${responseBody.length}`,
      'Content-Type': ''
    }
  };

  return axios.put(event.ResponseURL, responseBody, config);
}
