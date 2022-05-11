// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import S3Handler from '../../lib/aws-handlers/s3-handler';
import Logger, { LoggingLevel as LogLevel } from '../../lib/logger';
import { CopyUiAssetsRequest, CreateUiConfigRequest, RequestTypes } from '../../lib/types/custom-resource-types';
import { CopyObjectRequest, GetObjectRequest, PutObjectRequest } from '../../lib/types/s3-handler-types';

const { LOGGING_LEVEL } = process.env;
const logger = new Logger('ui-custom-resources', LOGGING_LEVEL);
const s3Handler = new S3Handler();

/**
 * Copies UI assets to the solution UI bucket when creating or updating the solution.
 * @param params The copying UI assets parameters
 */
export async function copyUiAssets(params: CopyUiAssetsRequest): Promise<void> {
  const { requestType, resourceProperties } = params;

  if ([RequestTypes.CREATE, RequestTypes.UPDATE].includes(requestType)) {
    const { DestinationBucket, ManifestFile, SourceBucket, SourcePrefix } = resourceProperties;
    const getParams: GetObjectRequest = {
      bucket: SourceBucket,
      key: `${SourcePrefix}/${ManifestFile}`
    };

    logger.log(LogLevel.DEBUG, `Getting manifest file: ${JSON.stringify(getParams, null, 2)}`);

    const response = await s3Handler.getObject(getParams);
    const manifest: string[] = JSON.parse(response.Body.toString());

    await Promise.all(
      manifest.map(async (fileName: string) => {
        const keyName = fileName.split('/').slice(1).join('/');
        const copyParams: CopyObjectRequest = {
          destinationBucket: DestinationBucket,
          destinationKey: keyName,
          sourceBucketKey: [SourceBucket, SourcePrefix, fileName].join('/')
        };

        logger.log(LogLevel.DEBUG, `Copying ${fileName} to ${DestinationBucket}`);
        return s3Handler.copyObject(copyParams);
      })
    );
  }
}

/**
 * Creates the UI config to the UI bucket when creating or updating the solution.
 * @param params The creating UI config parameters
 */
export async function createUiConfig(params: CreateUiConfigRequest): Promise<void> {
  const { requestType, resourceProperties } = params;

  if ([RequestTypes.CREATE, RequestTypes.UPDATE].includes(requestType)) {
    const {
      ApiEndpoint,
      DestinationBucket,
      ConfigFileName,
      IdentityPoolId,
      LoggingLevel,
      S3Bucket,
      UserPoolId,
      WebClientId
    } = resourceProperties;
    const { AWS_REGION } = process.env;
    const uiConfig = {
      apiEndpoint: ApiEndpoint,
      identityPoolId: IdentityPoolId,
      loggingLevel: LoggingLevel,
      region: AWS_REGION,
      s3Bucket: S3Bucket,
      userPoolId: UserPoolId,
      webClientId: WebClientId
    };

    const putObjectParams: PutObjectRequest = {
      body: `var config = ${JSON.stringify(uiConfig, null, 2)};`,
      contentType: 'application/javascript',
      destinationBucket: DestinationBucket,
      destinationKey: ConfigFileName
    };
    logger.log(LogLevel.DEBUG, `Putting UI config: ${JSON.stringify(uiConfig, null, 2)}`);
    await s3Handler.putObject(putObjectParams);
  }
}
