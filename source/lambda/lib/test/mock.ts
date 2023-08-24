// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const mockAwsDynamoDB = {
  delete: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  query: jest.fn(),
  scan: jest.fn(),
  update: jest.fn()
};
jest.mock('aws-sdk/clients/dynamodb', () => ({
  DocumentClient: jest.fn(() => ({ ...mockAwsDynamoDB }))
}));

export const mockAwsGreengrassV2 = {
  createComponentVersion: jest.fn(),
  createDeployment: jest.fn(),
  deleteComponent: jest.fn(),
  deleteCoreDevice: jest.fn(),
  getDeployment: jest.fn(),
  listComponents: jest.fn(),
  listCoreDevices: jest.fn(),
  listDeployments: jest.fn()
};
jest.mock('aws-sdk/clients/greengrassv2', () => jest.fn(() => ({ ...mockAwsGreengrassV2 })));

export const mockAwsIoT = {
  attachThingPrincipal: jest.fn(),
  createKeysAndCertificate: jest.fn(),
  createRoleAlias: jest.fn(),
  createThing: jest.fn(),
  deleteCertificate: jest.fn(),
  deleteRoleAlias: jest.fn(),
  deleteThing: jest.fn(),
  describeEndpoint: jest.fn(),
  describeThing: jest.fn(),
  detachThingPrincipal: jest.fn(),
  listPrincipalThings: jest.fn(),
  updateCertificate: jest.fn()
};
jest.mock('aws-sdk/clients/iot', () => jest.fn(() => mockAwsIoT));

export const mockAwsIoTData = {
  publish: jest.fn()
};
jest.mock('aws-sdk/clients/iotdata', () => jest.fn(() => mockAwsIoTData));

export const mockAwsIoTSiteWise = {
  createGateway: jest.fn(),
  deleteGateway: jest.fn(),
  describeGatewayCapabilityConfiguration: jest.fn(),
  listGateways: jest.fn(),
  updateGatewayCapabilityConfiguration: jest.fn()
};
jest.mock('aws-sdk/clients/iotsitewise', () => jest.fn(() => ({ ...mockAwsIoTSiteWise })));

export const mockAwsLambda = {
  invoke: jest.fn()
};
jest.mock('aws-sdk/clients/lambda', () => jest.fn(() => ({ ...mockAwsLambda })));

export const mockAwsS3 = {
  copyObject: jest.fn(),
  deleteObject: jest.fn(),
  getObject: jest.fn(),
  getSignedUrlPromise: jest.fn(),
  putObject: jest.fn(),
  deleteObjects: jest.fn(),
  deleteBucket: jest.fn(),
  listObjectVersions: jest.fn()
};
jest.mock('aws-sdk/clients/s3', () => jest.fn(() => ({ ...mockAwsS3 })));

export const mockAwsTimestreamWrite = {
  writeRecords: jest.fn(),
  listTables: jest.fn(),
  deleteTable: jest.fn(),
  deleteDatabase: jest.fn()
};
jest.mock('aws-sdk/clients/timestreamwrite', () => jest.fn(() => ({ ...mockAwsTimestreamWrite })));

export const mockAxios = jest.fn();
jest.mock('axios', () => ({ post: mockAxios }));

export const UPPER_ALPHA_NUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const mockCuid2 = jest.fn();
jest.mock('@paralleldrive/cuid2', () => ({ init: mockCuid2 }));

export const consoleErrorSpy = jest.spyOn(console, 'error');
