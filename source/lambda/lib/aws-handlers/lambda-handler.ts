// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Lambda from 'aws-sdk/clients/lambda';
import { LambdaError } from '../errors';
import Logger, { LoggingLevel } from '../logger';
import { ConnectionDefinition } from '../types/solution-common-types';
import { getAwsSdkOptions } from '../utils';

const { LOGGING_LEVEL, GREENGRASS_DEPLOYER_LAMBDA_FUNCTION } = process.env;
const lambda = new Lambda(getAwsSdkOptions());
const logger = new Logger('LambdaHandler', LOGGING_LEVEL);

/**
 * The Lambda handler to control Lambda functions
 */
export default class LambdaHandler {
  private readonly greengrassDeployerLambdaFunction: string;

  constructor() {
    this.greengrassDeployerLambdaFunction = GREENGRASS_DEPLOYER_LAMBDA_FUNCTION;
  }

  /**
   * Invokes the Greengrass deployer Lambda function.
   * @param payload The event payload to send to the Greengrass deployer Lambda function
   * @throws `LambdaHandlerError` when it fails to invoke the Greengrass deployer Lambda function
   */
  public async invokeGreengrassDeployer(payload: ConnectionDefinition): Promise<void> {
    try {
      const params: Lambda.InvocationRequest = {
        FunctionName: this.greengrassDeployerLambdaFunction,
        InvocationType: 'Event',
        Payload: JSON.stringify(payload)
      };

      logger.log(LoggingLevel.DEBUG, `Invoking Greengrass deployer: ${JSON.stringify(params, null, 2)}`);

      await lambda.invoke(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[invokeGreengrassDeployer] Error: ', error);

      throw new LambdaError({
        message: `Failed to ${payload.control} the connection.`,
        name: 'LambdaHandlerError'
      });
    }
  }
}
