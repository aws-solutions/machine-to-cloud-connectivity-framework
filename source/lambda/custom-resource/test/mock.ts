// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import {
  CustomResourceResponse,
  EventRequest,
  LambdaContext,
  RequestTypes,
  ResourceTypes
} from '../../lib/types/custom-resource-types';
import * as utils from '../../lib/utils';

export const script = fs.readFileSync(`${__dirname}/../greengrass-custom-resources/script/m2c2-install.sh`);
export const mockValues = {
  artifact: {
    opcDaArtifact: 'mock-opcda.zip',
    osiPiArtifact: 'mock-osipi.zip',
    publisherArtifact: 'mock-publisher.zip'
  },
  axiosConfig: {
    headers: {
      'Content-Length': '0',
      'Content-Type': ''
    }
  },
  certificate: {
    certificateArn: 'arn:of:certificate',
    certificateId: 'mock-certificate-id',
    certificatePem: 'mock-pem',
    privateKey: 'mock-private-key'
  },
  context: <LambdaContext>{
    getRemainingTimeInMillis: () => 60,
    functionName: 'custom-resource',
    functionVersion: 'latest',
    invokedFunctionArn: 'arn:of:custom-resource',
    memoryLimitInMB: 128,
    awsRequestId: 'mock-request-id',
    logGroupName: 'mock-log-group',
    logStreamName: 'mock-stream',
    identity: undefined,
    clientContext: undefined,
    callbackWaitsForEmptyEventLoop: false
  },
  destinationBucket: 'mock-destination-bucket',
  event: <EventRequest>{
    RequestType: RequestTypes.CREATE,
    PhysicalResourceId: 'mock-physical-resource-id',
    StackId: 'mock-stack-id',
    ServiceToken: 'mock-lambda',
    RequestId: 'mock-request-id',
    LogicalResourceId: 'mock-logical-resource-id',
    ResponseURL: 'https://response-url.com',
    ResourceType: 'mock-resource-type',
    ResourceProperties: {
      Resource: ResourceTypes.CREATE_UUID
    }
  },
  iotEndpoint: {
    credentialProvider: 'https://credential-provider',
    dataAts: 'https://data-ats'
  },
  roleAlias: 'mock-role-alias',
  roleArn: 'arn:of:role',
  sourceBucket: 'mock-source-bucket',
  sourcePrefix: 'machine-to-cloud-connectivity/vTest',
  uiConfig: {
    apiEndpoint: 'https://mock-api.com',
    configFileName: 'aws-exports.js',
    identityPoolId: 'mock-identity-pool-id',
    s3Bucket: 'mock-s3-bucket',
    userPoolId: 'mock-user-pool-id',
    webClientId: 'mock-web-client-id'
  },
  uuid: 'mock-uuid'
};

export const mockAxios = {
  put: jest.fn()
};
jest.mock('axios', () => ({ ...mockAxios }));

export const mockIoTHandler = {
  createKeysAndCertificate: jest.fn(),
  createRoleAlias: jest.fn(),
  deleteCertificate: jest.fn(),
  deleteRoleAlias: jest.fn(),
  describeIoTEndpoint: jest.fn(),
  detachThingPrincipal: jest.fn(),
  getPrincipalThings: jest.fn(),
  updateCertificate: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-handler', () => jest.fn(() => ({ ...mockIoTHandler })));

export const mockS3Handler = {
  copyObject: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  deleteObjects: jest.fn(),
  deleteBucket: jest.fn(),
  listObjectVersions: jest.fn()
};
jest.mock('../../lib/aws-handlers/s3-handler', () => jest.fn(() => ({ ...mockS3Handler })));

export const mockTimestreamHandler = {
  listTables: jest.fn(),
  deleteTable: jest.fn(),
  deleteDatabase: jest.fn()
};
jest.mock('../../lib/aws-handlers/timestream-handler', () => jest.fn(() => ({ ...mockTimestreamHandler })));

export const mockIoTSiteWiseHandler = {
  createGreengrassV2Gateway: jest.fn(),
  deleteGreengrassV2Gateway: jest.fn()
};
jest.mock('../../lib/aws-handlers/iot-sitewise-handler', () => jest.fn(() => ({ ...mockIoTSiteWiseHandler })));

export const consoleErrorSpy = jest.spyOn(console, 'error');
export const consoleWarnSpy = jest.spyOn(console, 'warn');
export const fsReadFileSyncSpy = jest.spyOn(fs, 'readFileSync');
export const sendAnonymousMetricsSpy = jest.spyOn(utils, 'sendAnonymousMetric');
export const sleepSpy = jest.spyOn(utils, 'sleep');
jest.mock('uuid', () => ({ v4: jest.fn(() => mockValues.uuid) }));

interface BuildResponseBodyRequest {
  event: EventRequest;
  response: CustomResourceResponse;
  reason?: string;
}

/**
 * Builds a CloudFormation response body.
 * @param params The building response body parameters including resource event, response, and failure reason
 * @returns The CloudFormation response body
 */
export function buildResponseBody(params: BuildResponseBodyRequest) {
  const { event, response, reason } = params;

  return JSON.stringify({
    Status: response.Status,
    Reason: reason ? reason : `See the details in CloudWatch Log Stream: ${mockValues.context.logStreamName}`,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data
  });
}
