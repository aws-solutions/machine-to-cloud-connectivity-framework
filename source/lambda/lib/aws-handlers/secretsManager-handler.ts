// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SecretsManager, {
  CreateSecretResponse,
  DeleteSecretResponse,
  UpdateSecretResponse
} from 'aws-sdk/clients/secretsmanager';
import Logger, { LoggingLevel } from '../logger';
import { getAwsSdkOptions } from '../utils';

const { LOGGING_LEVEL } = process.env;
const logger = new Logger('SecretsManagerHandler', LOGGING_LEVEL);

const secretsManager = new SecretsManager(getAwsSdkOptions());

export default class SecretsManagerHandler {
  public async createSecret(
    secretId: string,
    secretValue: object
  ): Promise<CreateSecretResponse | UpdateSecretResponse> {
    logger.log(LoggingLevel.DEBUG, `Creating secret`);

    //If the same connector name was previously used, the secret might already exist.
    //Clear the delete flag if so and call update secret instead
    try {
      return await secretsManager
        .createSecret({
          Name: secretId,
          SecretString: JSON.stringify(secretValue)
        })
        .promise();
    } catch (err) {
      if (err.message.toLowerCase().includes('scheduled for deletion')) {
        await secretsManager
          .restoreSecret({
            SecretId: secretId
          })
          .promise();
        return await this.updateSecret(secretId, secretValue);
      } else {
        throw err;
      }
    }
  }

  public async updateSecret(secretId: string, secretValue: object): Promise<UpdateSecretResponse> {
    logger.log(LoggingLevel.DEBUG, `Updating secret`);

    try {
      return await secretsManager
        .updateSecret({
          SecretId: secretId,
          SecretString: JSON.stringify(secretValue)
        })
        .promise();
    } catch (err) {
      if (err.code === 'ResourceNotFoundException') {
        return await this.createSecret(secretId, secretValue);
      } else if (err.message.toLowerCase().includes('scheduled for deletion')) {
        await secretsManager
          .restoreSecret({
            SecretId: secretId
          })
          .promise();
        return await this.updateSecret(secretId, secretValue);
      } else {
        throw err;
      }
    }
  }

  public async deleteSecret(secretId: string): Promise<DeleteSecretResponse> {
    logger.log(LoggingLevel.DEBUG, `Deleting secret`);

    try {
      return await secretsManager
        .deleteSecret({
          SecretId: secretId
        })
        .promise();
    } catch {
      //handle no secret or secret already deleted
      logger.log(LoggingLevel.DEBUG, `Delete failed. Possible there is no secret or the secret was previously deleted`);
      return undefined;
    }
  }
}
