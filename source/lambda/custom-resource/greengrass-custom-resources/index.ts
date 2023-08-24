// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import IoTHandler from '../../lib/aws-handlers/iot-handler';
import S3Handler from '../../lib/aws-handlers/s3-handler';
import Logger, { LoggingLevel } from '../../lib/logger';
import {
  CopyGreengrassComponentsArtifactRequest,
  CreateGreengrassInstallationScriptsRequest,
  DeleteIoTCertificateRequest,
  GreengrassInstallationScriptsResponse,
  ManageIoTRoleAliasRequest,
  RequestTypes
} from '../../lib/types/custom-resource-types';
import { CopyObjectRequest } from '../../lib/types/s3-handler-types';
import { sleep } from '../../lib/utils';

const { AWS_REGION, LOGGING_LEVEL } = process.env;
const iotHandler = new IoTHandler();
const logger = new Logger('greengrass-custom-resource', LOGGING_LEVEL);
const s3Handler = new S3Handler();

/**
 * It creates an IoT role alias when a CloudFormation stack is created.
 * It deletes an IoT role alias when a CloudFormation stack is deleted.
 * @param params The managing IoT role alias custom resource parameters
 */
export async function manageIoTRoleAlias(params: ManageIoTRoleAliasRequest): Promise<void> {
  const { requestType, resourceProperties } = params;
  const { RoleAliasName, RoleArn } = resourceProperties;
  const retry = 10;

  if (requestType === RequestTypes.CREATE) {
    /**
     * Because IAM permission is not ready sometimes, it retries when an error happens.
     * After the number of retries, it throws the error.
     */
    for (let i = 1; i <= retry; i++) {
      try {
        await iotHandler.createRoleAlias({
          roleAlias: RoleAliasName,
          roleArn: RoleArn
        });

        break;
      } catch (error) {
        if (i === retry) {
          throw error;
        }

        await sleep(3 * i);
      }
    }
  } else if (requestType === RequestTypes.DELETE) {
    await iotHandler.deleteRoleAlias(RoleAliasName);
  }
}

/**
 * Copies Greengrass v2 components artifact to the S3 bucket.
 * @param params The copying Greengrass components artifact custom resource parameters
 */
export async function copyGreengrassComponentsArtifact(params: CopyGreengrassComponentsArtifactRequest): Promise<void> {
  const { requestType } = params;

  if ([RequestTypes.CREATE, RequestTypes.UPDATE].includes(requestType)) {
    const { resourceProperties } = params;
    const { Artifacts, DestinationBucket, SourceBucket, SourcePrefix } = resourceProperties;
    const artifacts = Object.values(Artifacts);

    await Promise.all(
      artifacts.map(async (fileName: string) => {
        const copyParams: CopyObjectRequest = {
          destinationBucket: DestinationBucket,
          destinationKey: fileName,
          sourceBucketKey: [SourceBucket, SourcePrefix, fileName].join('/')
        };

        logger.log(LoggingLevel.DEBUG, `Copying ${fileName} to ${DestinationBucket}`);
        return s3Handler.copyObject(copyParams);
      })
    );
  }
}

/**
 * It creates an IoT certificate and Greengrass v2 installation scripts based on the IoT SiteWise gateway scripts.
 * It also uploads the script to the S3 bucket.
 * @param params The creating Greengrass installation scripts custom resource parameters
 * @returns The certificate ARN/ID and the installation script signed URL
 */
export async function createGreengrassInstallationScripts(
  params: CreateGreengrassInstallationScriptsRequest
): Promise<Partial<GreengrassInstallationScriptsResponse>> {
  const { requestType, resourceProperties } = params;

  if (requestType === RequestTypes.CREATE) {
    const { CredentialProviderEndpoint, DataAtsEndpoint, DestinationBucket } = resourceProperties;
    const { IoTRoleAlias } = resourceProperties;
    const { certificateArn, certificateId, certificatePem, keyPair } = await iotHandler.createKeysAndCertificate();
    const { PrivateKey } = keyPair;
    const fileName = 'm2c2-install.sh';
    const installScript = fs.readFileSync(`${__dirname}/script/${fileName}`).toString();

    await s3Handler.putObject({
      body: installScript
        .replace('REGION_PLACEHOLDER', AWS_REGION)
        .replace('ROLE_ALIAS_PLACEHOLDER', IoTRoleAlias)
        .replace('DATA_ENDPOINT_PLACEHOLDER', DataAtsEndpoint)
        .replace('CRED_ENDPOINT_PLACEHOLDER', CredentialProviderEndpoint)
        .replace('CERTIFICATE_PEM_PLACEHOLDER', certificatePem)
        .replace('PRIVATE_KEY_PLACEHOLDER', PrivateKey),
      contentType: 'text/x-sh',
      destinationBucket: DestinationBucket,
      destinationKey: fileName
    });

    return {
      CertificateArn: certificateArn,
      CertificateId: certificateId
    };
  }

  return {};
}

/**
 * It deletes an IoT certificate created by the solution.
 * @param params The deleting IoT certificate custom resource parameters
 */
export async function deleteIoTCertificate(params: DeleteIoTCertificateRequest): Promise<void> {
  const { requestType, resourceProperties } = params;

  if (requestType === RequestTypes.DELETE) {
    const { CertificateArn, CertificateId } = resourceProperties;
    const things = await iotHandler.getPrincipalThings(CertificateArn);
    await Promise.all(
      things.map((thingName: string) => iotHandler.detachThingPrincipal({ principal: CertificateArn, thingName }))
    );

    await iotHandler.updateCertificate({
      certificateId: CertificateId,
      newStatus: 'INACTIVE'
    });
    await iotHandler.deleteCertificate(CertificateId);
  }
}
