// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3 from 'aws-sdk/clients/s3';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import fs from 'fs';
import tar from 'tar';
import { v4 } from 'uuid';
import GreengrassHandler from '../lib/greengrass-handler';
import IoTHandler from '../lib/iot-handler';
import Logger, { LoggingLevel as LogLevel } from '../lib/logger';
import { CustomResourceTypes } from '../lib/types';
import { getAwsSdkOptions, sendAnonymousMetric, sleep } from '../lib/utils';

const { AWS_REGION, LOGGING_LEVEL, STACK_NAME } = process.env;
const iotHandler = new IoTHandler();
const s3 = new S3(getAwsSdkOptions({ signatureVersion: 'v4' }));
const logger = new Logger('custom-resource', LOGGING_LEVEL);

/**
 * Handles the custom resource requests.
 * @param event The custom resource event
 * @param context The Lambda function context
 */
exports.handler = async (event: CustomResourceTypes.EventRequest, context: CustomResourceTypes.LambdaConext): Promise<CustomResourceTypes.CustomResourceResponse> => {
  logger.log(LogLevel.INFO, `Event: ${JSON.stringify(event, null, 2)}`);

  const { RequestType, ResourceProperties } = event;
  const { Resource } = ResourceProperties;
  const response: CustomResourceTypes.CustomResourceResponse = {
    Status: CustomResourceTypes.StatusTypes.SUCCESS,
    Data: {}
  };
  let reason = `See the details in CloudWatch Log Stream: ${context.logStreamName}`;

  try {
    switch (Resource) {
      case CustomResourceTypes.ResourceTypes.CREATE_UUID:
        if (RequestType === CustomResourceTypes.RequestTypes.CREATE) {
          response.Data.UUID = v4();
        }

        break;
      case CustomResourceTypes.ResourceTypes.SEND_ANONYMOUS_METRICS:
        const anonymousMetrics: any = {};
        const { ExistingGreengrassGroup, ExistingKinesisStream, SolutionUUID } = ResourceProperties as CustomResourceTypes.SendAnonymousMetricProperties;

        anonymousMetrics.ExistringGreengrassGroup = ExistingGreengrassGroup !== undefined && ExistingGreengrassGroup.trim() !== '';
        anonymousMetrics.ExistingKinesisStream = ExistingKinesisStream !== undefined && ExistingKinesisStream.trim() !== '';
        anonymousMetrics.Region = AWS_REGION;

        if (RequestType === CustomResourceTypes.RequestTypes.CREATE) {
          anonymousMetrics.EventType = 'DeployStack';
        } else if (RequestType === CustomResourceTypes.RequestTypes.UPDATE) {
          anonymousMetrics.EventType = 'UpdateStack';
        } else if (RequestType === CustomResourceTypes.RequestTypes.DELETE) {
          anonymousMetrics.EventType = 'DeleteStack';
        }

        await sendAnonymousMetric(anonymousMetrics, SolutionUUID);
        break;
      case CustomResourceTypes.ResourceTypes.DESCRIBE_IOT_ENDPOINT:
        if (RequestType === CustomResourceTypes.RequestTypes.CREATE) {
          const endpointAddress = await iotHandler.describeIoTEndpoint();
          response.Data.IOT_ENDPOINT = endpointAddress;
        }

        break;
      case CustomResourceTypes.ResourceTypes.COPY_UI_ASSETS:
        await copyUiAssets(ResourceProperties as CustomResourceTypes.CopyUiAssetsProperties, RequestType);

        break;
      case CustomResourceTypes.ResourceTypes.CREATE_UI_CONFIG:
        await createUiConfig(ResourceProperties as CustomResourceTypes.CreateUiConfigProperties, RequestType);

        break;
      case CustomResourceTypes.ResourceTypes.CREATE_GREENGRASS_CERT_AND_KEYS:
        const greengrassCertificate = await createGreengrassCertAndKeys(ResourceProperties as CustomResourceTypes.CreateGreengrassCertAndKeysProperties, RequestType);
        response.Data = greengrassCertificate;

        break;
      case CustomResourceTypes.ResourceTypes.DELETE_GREENGRASS_RESOURCES:
        await deleteGreengrassResources(ResourceProperties as CustomResourceTypes.DeleteGreengrassResourcesProperties, RequestType)

        break;
      default:
        break;
    }
  } catch (error) {
    logger.log(LogLevel.ERROR, 'Error: ', error);

    response.Status = CustomResourceTypes.StatusTypes.FAILED;
    response.Data.Error = error.message;
    reason = error.message;
  }

  const cloudFormationResponse = await sendCloudFormationResponse(event, response, reason);
  logger.log(LogLevel.INFO, `Status text: ${cloudFormationResponse.statusText}, code: ${cloudFormationResponse.status}, response: ${JSON.stringify(response)}`);

  return response;
}

/**
 * Sends a response to the CloudFormation response URL.
 * @param event The custom resource event
 * @param response The custom resource response
 * @param reason The error reason
 * @returns The response from the CloudFront response URL
 */
async function sendCloudFormationResponse(event: CustomResourceTypes.EventRequest, response: CustomResourceTypes.CustomResourceResponse, reason: string): Promise<AxiosResponse> {
  const responseBody = JSON.stringify({
    Status: response.Status,
    Reason: reason,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data
  });
  logger.log(LogLevel.DEBUG, `Response body: ${JSON.stringify(responseBody, null, 2)}`);

  const config: AxiosRequestConfig = {
    headers: {
      'Content-Length': responseBody.length,
      'Content-Type': ''
    }
  };

  return axios.put(event.ResponseURL, responseBody, config);
}

/**
 * Copies UI assets to the solution UI bucket when creating or updating the solution.
 * @param props Copying UI assets custom resource properties
 * @param requestType The custom resource request type
 */
async function copyUiAssets(props: CustomResourceTypes.CopyUiAssetsProperties, requestType: CustomResourceTypes.RequestTypes): Promise<void> {
  if ([CustomResourceTypes.RequestTypes.CREATE, CustomResourceTypes.RequestTypes.UPDATE].includes(requestType)) {
    const { DestinationBucket, ManifestFile, SourceBucket, SourcePrefix } = props;
    const getParams: S3.GetObjectRequest = {
      Bucket: SourceBucket,
      Key: `${SourcePrefix}/${ManifestFile}`
    };

    logger.log(LogLevel.DEBUG, `Getting mainfest file: ${JSON.stringify(getParams, null, 2)}`);
    const response = await s3.getObject(getParams).promise();
    const manifest: string[] = JSON.parse(response.Body.toString());

    await Promise.all(manifest.map(async (fileName: string) => {
      const keyName = fileName.split('/').slice(1).join('/');
      const copyParams: S3.CopyObjectRequest = {
        Bucket: DestinationBucket,
        CopySource: `${SourceBucket}/${SourcePrefix}/${fileName}`,
        Key: keyName
      };

      logger.log(LogLevel.DEBUG, `Copying ${fileName} to ${DestinationBucket}`);
      return s3.copyObject(copyParams).promise();
    }));
  }
}

/**
 * Creating the UI config to the UI bucket when creating or updating the solution.
 * @param props Creating UI config custom resource properties
 * @param requestType The custom resource request type
 */
async function createUiConfig(props: CustomResourceTypes.CreateUiConfigProperties, requestType: CustomResourceTypes.RequestTypes): Promise<void> {
  if ([CustomResourceTypes.RequestTypes.CREATE, CustomResourceTypes.RequestTypes.UPDATE].includes(requestType)) {
    const { ApiEndpoint, DestinationBucket, ConfigFileName, IdentityPoolId, LoggingLevel, UserPoolId, WebClientId } = props;
    const uiConfig = {
      apiEndpoint: ApiEndpoint,
      identityPoolId: IdentityPoolId,
      loggingLevel: LoggingLevel,
      region: AWS_REGION,
      userPoolId: UserPoolId,
      webClientId: WebClientId
    };

    const params: S3.PutObjectRequest = {
      Body: `const config = ${JSON.stringify(uiConfig, null, 2)};`,
      Bucket: DestinationBucket,
      Key: ConfigFileName,
      ContentType: 'application/javascript'
    };
    logger.log(LogLevel.DEBUG, `Putting UI config: ${JSON.stringify(uiConfig, null, 2)}`);
    await s3.putObject(params).promise();
  }
}

/**
 * Creates the Greengrass certificate and keys.
 * @param props Creating Greengrass certificate and keys properties
 * @param requestType The custom resource request type
 * @returns The certificate information including S3 URL for the certificates
 */
async function createGreengrassCertAndKeys(
  props: CustomResourceTypes.CreateGreengrassCertAndKeysProperties,
  requestType: CustomResourceTypes.RequestTypes
): Promise<CustomResourceTypes.GreengrassCertificateResponse | {}> {
  if (requestType === CustomResourceTypes.RequestTypes.CREATE) {
    const iotEndpointAddress = await iotHandler.describeIoTEndpoint();
    const keysAndCertificate = await iotHandler.createKeysAndCertificate();
    const { certificateArn, certificateId, certificatePem, keyPair } = keysAndCertificate;

    /**
     * Since Lambda function allows to store temporary files in /tmp directory,
     * all files are going to be created under /tmp directory.
     */
    const tempDirectory = '/tmp';
    const certsDirectory = 'certs';
    const prefix = certificateId.slice(0, 10);
    const certificateFileName = `${prefix}-cert.pem`;
    const privateKeyFileName = `${prefix}-private.key`;
    const publicKeyFileName = `${prefix}-public.key`;
    const rootCaFileName = 'root.ca.pem';

    if (!fs.existsSync(`${tempDirectory}/${certsDirectory}`)) {
      fs.mkdirSync(`${tempDirectory}/${certsDirectory}`);
    }

    fs.writeFileSync(`${tempDirectory}/${certsDirectory}/${certificateFileName}`, certificatePem);
    fs.writeFileSync(`${tempDirectory}/${certsDirectory}/${privateKeyFileName}`, keyPair.PrivateKey);
    fs.writeFileSync(`${tempDirectory}/${certsDirectory}/${publicKeyFileName}`, keyPair.PublicKey);

    const amazonCa = await axios.get('https://www.amazontrust.com/repository/AmazonRootCA1.pem');
    fs.writeFileSync(`${tempDirectory}/${certsDirectory}/${rootCaFileName}`, amazonCa.data);

    const configFileName = 'config.json';
    const configDirectory = `config`;

    if (!fs.existsSync(`${tempDirectory}/${configDirectory}`)) {
      fs.mkdirSync(`${tempDirectory}/${configDirectory}`);
    }

    const config = {
      coreThing: {
        caPath: rootCaFileName,
        certPath: certificateFileName,
        keyPath: privateKeyFileName,
        thingArn: props.ThingArn,
        iotHost: iotEndpointAddress,
        ggHost: `greengrass-ats.iot.${AWS_REGION}.amazonaws.com`,
      },
      runtime: {
        cgroup: { useSystemd: 'yes' }
      },
      managedRespawn: false,
      crypto: {
        principals: {
          SecretsManager: {
            privateKeyPath: `file:///greengrass/certs/${privateKeyFileName}`
          },
          IoTCertificate: {
            privateKeyPath: `file:///greengrass/certs/${privateKeyFileName}`,
            certificatePath: `file:///greengrass/certs/${certificateFileName}`
          }
        },
        caPath: `file:///greengrass/certs/root.ca.pem`
      }
    };
    logger.log(LogLevel.DEBUG, `Greengrass config: ${JSON.stringify(config, null, 2)}`);
    fs.writeFileSync(`${tempDirectory}/${configDirectory}/${configFileName}`, JSON.stringify(config, null, 2));

    const setupCommands = [
      '#!/bin/bash',
      '# Prereq for running this script: download the tar file from S3 that contains your certificate and keypair, upload the tarball to your Greengrass instance',
      '# Run this file with the command `sudo ./setup.sh`',
      'cp certs/* /greengrass/certs',
      'cp config/* /greengrass/config',
      'if [[ ! -d /m2c2 && ! -d /m2c2/job ]] ; then',
      '  mkdir -p /m2c2/job',
      'fi',
      'chown -R ggc_user /m2c2/job/',
      'if [[ ! -d /var/sitewise ]] ; then',
      '  mkdir /var/sitewise',
      'fi',
      'chown ggc_user /var/sitewise',
      'chmod 700 /var/sitewise',
      '/greengrass/ggc/core/greengrassd start'
    ];
    fs.writeFileSync(`${tempDirectory}/setup.sh`, setupCommands.join('\n'));
    fs.chmodSync(`${tempDirectory}/setup.sh`, '0755');

    const tarFileName = `m2c2-greengrass-${STACK_NAME}.tar.gz`;
    await tar.c(
      {
        gzip: true,
        file: `${tempDirectory}/${tarFileName}`,
        C: tempDirectory
      },
      [certsDirectory, configDirectory, 'setup.sh']
    );

    logger.log(LogLevel.DEBUG, 'Putting certificate and setup.sh to S3');
    await s3.putObject({ Bucket: props.DestinationBucket, Key: tarFileName, Body: fs.readFileSync(`${tempDirectory}/${tarFileName}`) }).promise();
    const generatedS3URL = await s3.getSignedUrlPromise('getObject', { Bucket: props.DestinationBucket, Key: tarFileName, Expires: 7200 });
    logger.log(LogLevel.DEBUG, `Generated S3 URL: ${generatedS3URL}`);

    return {
      certificateId,
      certificateArn,
      generatedS3URL
    };
  } else {
    return {};
  }
}

/**
 * Deleted the Greengrass resources.
 * @param props Deleting Greengrass resources properties
 * @param requestType The custome resource request type
 */
async function deleteGreengrassResources(
  props: CustomResourceTypes.DeleteGreengrassResourcesProperties,
  requestType: CustomResourceTypes.RequestTypes
): Promise<void> {
  if (requestType === CustomResourceTypes.RequestTypes.DELETE) {
    const certificateId = props.CertificateId;
    const greengrassHandler = new GreengrassHandler({ greengrassId: props.GreengrassGroupId });
    await greengrassHandler.resetGreengrassDeployment();

    try {
      let thingPrincipals: string[] | undefined;
      do {
        thingPrincipals = await iotHandler.getThingPrincipals(props.ThingName);
        await sleep(3);
      } while (thingPrincipals);
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        logger.log(LogLevel.WARN, 'The thing can be already removed by CloudFormation, so this will be ignored.');
      } else {
        throw error;
      }
    }

    await iotHandler.updateCertificate(certificateId, 'INACTIVE');
    await iotHandler.deleteCertificate(certificateId);
  }
}