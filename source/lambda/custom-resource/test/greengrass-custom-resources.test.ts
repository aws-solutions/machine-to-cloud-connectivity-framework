// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  buildResponseBody,
  consoleWarnSpy,
  fsReadFileSyncSpy,
  mockAxios,
  mockIoTHandler,
  mockS3Handler,
  mockValues,
  script,
  sleepSpy
} from './mock';
import { handler } from '../index';
import {
  CopyGreengrassComponentArtifactProperties,
  CreateGreengrassInstallationScriptsProperties,
  DeleteIoTCertificateProperties,
  ManageIoTRoleAliasProperties,
  RequestTypes,
  ResourceTypes,
  StatusTypes
} from '../../lib/types/custom-resource-types';

const { axiosConfig, context, event } = mockValues;

describe('Test MANAGE_IOT_ROLE_ALIAS', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = <ManageIoTRoleAliasProperties>{
      Resource: ResourceTypes.MANAGE_IOT_ROLE_ALIAS,
      RoleAliasName: mockValues.roleAlias,
      RoleArn: mockValues.roleArn
    };
  });
  beforeEach(() => {
    mockAxios.put.mockReset();
    mockIoTHandler.createRoleAlias.mockReset();
    mockIoTHandler.deleteRoleAlias.mockReset();
    sleepSpy.mockReset();
  });

  test('Test success to create an IoT role alias when creating a stack', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.createRoleAlias.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <ManageIoTRoleAliasProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createRoleAlias).toHaveBeenCalledWith({
      roleAlias: resourceProperties.RoleAliasName,
      roleArn: resourceProperties.RoleArn
    });
    expect(mockIoTHandler.deleteRoleAlias).not.toHaveBeenCalled();
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test success to create an IoT role alias after retry when creating a stack', async () => {
    const retry = 2;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.createRoleAlias.mockRejectedValueOnce('Error').mockResolvedValueOnce(undefined);
    sleepSpy.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <ManageIoTRoleAliasProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createRoleAlias).toHaveBeenCalledTimes(retry);
    for (let i = 1; i <= retry; i++) {
      expect(mockIoTHandler.createRoleAlias).toHaveBeenNthCalledWith(i, {
        roleAlias: resourceProperties.RoleAliasName,
        roleArn: resourceProperties.RoleArn
      });
    }
    expect(mockIoTHandler.deleteRoleAlias).not.toHaveBeenCalled();
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(3);
  });

  test('Test failure to create an IoT role alias due to an error when creating a stack', async () => {
    const errorMessage = 'Error';
    const retry = 10;

    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.createRoleAlias.mockRejectedValue({ message: errorMessage });
    sleepSpy.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response,
      reason: errorMessage
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <ManageIoTRoleAliasProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.FAILED,
      Data: {
        Error: errorMessage
      }
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createRoleAlias).toHaveBeenCalledTimes(retry);
    for (let i = 1; i <= retry; i++) {
      expect(mockIoTHandler.createRoleAlias).toHaveBeenNthCalledWith(i, {
        roleAlias: resourceProperties.RoleAliasName,
        roleArn: resourceProperties.RoleArn
      });
    }
    expect(mockIoTHandler.deleteRoleAlias).not.toHaveBeenCalled();
    expect(sleepSpy).toHaveBeenCalledTimes(retry - 1);
    for (let i = 1; i <= retry - 1; i++) {
      expect(sleepSpy).toHaveBeenNthCalledWith(i, 3 * i);
    }
  });

  test('Test success to delete an IoT role alias when deleting a stack', async () => {
    event.RequestType = RequestTypes.DELETE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.deleteRoleAlias.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <ManageIoTRoleAliasProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createRoleAlias).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteRoleAlias).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteRoleAlias).toHaveBeenCalledWith(resourceProperties.RoleAliasName);
  });

  test('Nothing happens when updating a stack', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

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
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createRoleAlias).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteRoleAlias).not.toHaveBeenCalled();
  });
});

describe('Test COPY_GREENGRASS_COMPONENTS_ARTIFACT', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = <CopyGreengrassComponentArtifactProperties>{
      Resource: ResourceTypes.COPY_GREENGRASS_COMPONENTS_ARTIFACT,
      Artifacts: {
        OpcDaConnectorArtifact: mockValues.artifact.opcDaArtifact,
        PublisherArtifact: mockValues.artifact.publisherArtifact
      },
      DestinationBucket: mockValues.destinationBucket,
      SourceBucket: mockValues.sourceBucket,
      SourcePrefix: mockValues.sourcePrefix
    };
  });
  beforeEach(() => {
    mockAxios.put.mockReset();
    mockS3Handler.copyObject.mockReset();
  });

  test('Test success to copy Greengrass components artifacts when creating a stack', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.copyObject.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CopyGreengrassComponentArtifactProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.copyObject).toHaveBeenCalledTimes(Object.keys(resourceProperties.Artifacts).length);

    let i = 1;
    for (const key in resourceProperties.Artifacts) {
      const fileName = resourceProperties.Artifacts[key];
      expect(mockS3Handler.copyObject).toHaveBeenNthCalledWith(i++, {
        destinationBucket: resourceProperties.DestinationBucket,
        destinationKey: fileName,
        sourceBucketKey: [resourceProperties.SourceBucket, resourceProperties.SourcePrefix, fileName].join('/')
      });
    }
  });

  test('Test success to copy Greengrass components artifacts when updating a stack', async () => {
    event.RequestType = RequestTypes.UPDATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockS3Handler.copyObject.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CopyGreengrassComponentArtifactProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.copyObject).toHaveBeenCalledTimes(Object.keys(resourceProperties.Artifacts).length);

    let i = 1;
    for (const key in resourceProperties.Artifacts) {
      const fileName = resourceProperties.Artifacts[key];
      expect(mockS3Handler.copyObject).toHaveBeenNthCalledWith(i++, {
        destinationBucket: resourceProperties.DestinationBucket,
        destinationKey: fileName,
        sourceBucketKey: [resourceProperties.SourceBucket, resourceProperties.SourcePrefix, fileName].join('/')
      });
    }
  });

  test('Nothing happens when deleting a stack', async () => {
    event.RequestType = RequestTypes.DELETE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

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
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockS3Handler.copyObject).not.toHaveBeenCalled();
  });
});

describe('Test CREATE_GREENGRASS_INSTALLATION_SCRIPTS', () => {
  const fileName = 'm2c2-install.sh';

  beforeAll(() => {
    event.RequestType = RequestTypes.CREATE;
    event.ResourceProperties = <CreateGreengrassInstallationScriptsProperties>{
      Resource: ResourceTypes.CREATE_GREENGRASS_INSTALLATION_SCRIPTS,
      CredentialProviderEndpoint: mockValues.iotEndpoint.credentialProvider,
      DataAtsEndpoint: mockValues.iotEndpoint.dataAts,
      DestinationBucket: mockValues.destinationBucket,
      IoTRoleAlias: mockValues.roleAlias
    };
  });
  beforeEach(() => {
    fsReadFileSyncSpy.mockReset();
    mockAxios.put.mockReset();
    mockIoTHandler.createKeysAndCertificate.mockReset();
    mockS3Handler.putObject.mockReset();
  });

  test('Test success to create Greengrass installation script when creating a stack', async () => {
    fsReadFileSyncSpy.mockReturnValue(script);
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.createKeysAndCertificate.mockResolvedValueOnce({
      certificateArn: mockValues.certificate.certificateArn,
      certificateId: mockValues.certificate.certificateId,
      certificatePem: mockValues.certificate.certificatePem,
      keyPair: {
        PrivateKey: mockValues.certificate.privateKey
      }
    });
    mockS3Handler.putObject.mockResolvedValue(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <CreateGreengrassInstallationScriptsProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {
        CertificateArn: mockValues.certificate.certificateArn,
        CertificateId: mockValues.certificate.certificateId
      }
    });
    expect(fsReadFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(fsReadFileSyncSpy).toHaveBeenCalledWith(
      `${__dirname.replace('test', 'greengrass-custom-resources')}/script/${fileName}`
    );
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createKeysAndCertificate).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.createKeysAndCertificate).toHaveBeenCalledWith();
    expect(mockS3Handler.putObject).toHaveBeenCalledTimes(1);
    expect(mockS3Handler.putObject).toHaveBeenCalledWith({
      body: script
        .toString()
        .replace('REGION_PLACEHOLDER', process.env.AWS_REGION)
        .replace('ROLE_ALIAS_PLACEHOLDER', resourceProperties.IoTRoleAlias)
        .replace('DATA_ENDPOINT_PLACEHOLDER', resourceProperties.DataAtsEndpoint)
        .replace('CRED_ENDPOINT_PLACEHOLDER', resourceProperties.CredentialProviderEndpoint)
        .replace('CERTIFICATE_PEM_PLACEHOLDER', mockValues.certificate.certificatePem)
        .replace('PRIVATE_KEY_PLACEHOLDER', mockValues.certificate.privateKey),
      contentType: 'text/x-sh',
      destinationBucket: resourceProperties.DestinationBucket,
      destinationKey: fileName
    });
  });

  test('Nothing happens when the request type is not "Create"', async () => {
    event.RequestType = RequestTypes.DELETE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

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
    expect(fsReadFileSyncSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.createKeysAndCertificate).not.toHaveBeenCalled();
    expect(mockS3Handler.putObject).not.toHaveBeenCalled();
  });
});

describe('Test DELETE_IOT_CERTIFICATE', () => {
  beforeAll(() => {
    event.RequestType = RequestTypes.DELETE;
    event.ResourceProperties = <DeleteIoTCertificateProperties>{
      Resource: ResourceTypes.DELETE_IOT_CERTIFICATE,
      CertificateArn: mockValues.certificate.certificateArn,
      CertificateId: mockValues.certificate.certificateId
    };
  });
  beforeEach(() => {
    consoleWarnSpy.mockReset();
    mockAxios.put.mockReset();
    mockIoTHandler.deleteCertificate.mockReset();
    mockIoTHandler.detachThingPrincipal.mockReset();
    mockIoTHandler.getPrincipalThings.mockReset();
    mockIoTHandler.updateCertificate.mockReset();
  });

  test('Test success to delete an IoT certificate when principal things does not exist', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.getPrincipalThings.mockResolvedValueOnce([]);
    mockIoTHandler.deleteCertificate.mockResolvedValueOnce(undefined);
    mockIoTHandler.updateCertificate.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <DeleteIoTCertificateProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledWith(resourceProperties.CertificateArn);
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteCertificate).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteCertificate).toHaveBeenCalledWith(resourceProperties.CertificateId);
    expect(mockIoTHandler.updateCertificate).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.updateCertificate).toHaveBeenCalledWith({
      certificateId: resourceProperties.CertificateId,
      newStatus: 'INACTIVE'
    });
  });

  test('Test success to delete an IoT certificate when principal things exist', async () => {
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.getPrincipalThings.mockResolvedValueOnce(['thing-1', 'thing-2']);
    mockIoTHandler.detachThingPrincipal.mockResolvedValue(undefined);
    mockIoTHandler.deleteCertificate.mockResolvedValueOnce(undefined);
    mockIoTHandler.updateCertificate.mockResolvedValueOnce(undefined);
    sleepSpy.mockResolvedValueOnce(undefined);

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <DeleteIoTCertificateProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.SUCCESS,
      Data: {}
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledWith(resourceProperties.CertificateArn);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenCalledTimes(2);
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenNthCalledWith(1, {
      principal: resourceProperties.CertificateArn,
      thingName: 'thing-1'
    });
    expect(mockIoTHandler.detachThingPrincipal).toHaveBeenNthCalledWith(2, {
      principal: resourceProperties.CertificateArn,
      thingName: 'thing-2'
    });
    expect(mockIoTHandler.deleteCertificate).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.deleteCertificate).toHaveBeenCalledWith(resourceProperties.CertificateId);
    expect(mockIoTHandler.updateCertificate).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.updateCertificate).toHaveBeenCalledWith({
      certificateId: resourceProperties.CertificateId,
      newStatus: 'INACTIVE'
    });
  });

  test('Test failure to delete an IoT certificate due to another error', async () => {
    const errorMessage = 'Failure';
    mockAxios.put.mockResolvedValueOnce({ status: 200 });
    mockIoTHandler.getPrincipalThings.mockRejectedValueOnce({ message: errorMessage });

    const response = await handler(event, context);
    const responseBody = buildResponseBody({
      event,
      response,
      reason: errorMessage
    });
    axiosConfig.headers['Content-Length'] = `${responseBody.length}`;
    const resourceProperties = <DeleteIoTCertificateProperties>event.ResourceProperties;

    expect(response).toEqual({
      Status: StatusTypes.FAILED,
      Data: {
        Error: errorMessage
      }
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledTimes(1);
    expect(mockIoTHandler.getPrincipalThings).toHaveBeenCalledWith(resourceProperties.CertificateArn);
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteCertificate).not.toHaveBeenCalled();
    expect(mockIoTHandler.updateCertificate).not.toHaveBeenCalled();
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Nothing happens when the request type is not "Delete"', async () => {
    event.RequestType = RequestTypes.CREATE;
    mockAxios.put.mockResolvedValueOnce({ status: 200 });

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
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(mockAxios.put).toHaveBeenCalledWith(event.ResponseURL, responseBody, axiosConfig);
    expect(mockIoTHandler.getPrincipalThings).not.toHaveBeenCalled();
    expect(mockIoTHandler.detachThingPrincipal).not.toHaveBeenCalled();
    expect(mockIoTHandler.deleteCertificate).not.toHaveBeenCalled();
    expect(mockIoTHandler.updateCertificate).not.toHaveBeenCalled();
    expect(sleepSpy).not.toHaveBeenCalled();
  });
});
