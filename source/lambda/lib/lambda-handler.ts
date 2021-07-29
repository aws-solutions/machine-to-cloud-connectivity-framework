// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Lambda from 'aws-sdk/clients/lambda';
import { LambdaError } from './errors';
import Logger, { LoggingLevel } from './logger';
import { ConnectionBuilderTypes, LambdaHandlerTypes } from './types';
import { generateUniqueId, getAwsSdkOptions, getLambdaRuntime } from './utils';

const { LAMBDA_ROLE, LOGGING_LEVEL, GREENGRASS_DEPLOYER_LAMBDA_FUNCTION, SOURCE_S3_BUCKET, SOURCE_S3_PREFIX } = process.env;
const lambda = new Lambda(getAwsSdkOptions());
const logger = new Logger('LambdaHandler', LOGGING_LEVEL);

/**
 * @class The Lambda handler to control Lambda functions
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
  public async invokeGreengrassDeployer(payload: ConnectionBuilderTypes.ConnectionDefinition): Promise<void> {
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

  /**
   * Creates a Lambda function.
   * @param input The Lambda function input parameters: the connection name, protocol, function type, and environment variables
   * @returns The response of the Lambda function creation
   * @throws `LambdaHandlerError` when it fails to create a Lambda function
   */
  async createLambdaFunction(input: LambdaHandlerTypes.CreateLambdaRequest): Promise<Lambda.FunctionConfiguration> {
    const { environmentVariables, functionType, connectionName, protocol } = input;
    let handler: string;
    let fileName: string;

    if (functionType === LambdaHandlerTypes.LambdaFunctionType.COLLECTOR) {
      // Collector Lambda function configuration
      handler = `m2c2_${protocol}_connector.function_handler`;
      fileName = `m2c2-${protocol}-connector.zip`;
    } else {
      // Publisher Lambda function configuration
      handler = `m2c2_publisher.function_handler`;
      fileName = `m2c2_publisher.zip`;
    }

    try {
      const params: Lambda.CreateFunctionRequest = {
        FunctionName: `m2c2-${protocol}-${functionType}-${connectionName}-${generateUniqueId()}`,
        Runtime: getLambdaRuntime(protocol),
        Role: LAMBDA_ROLE,
        Handler: handler,
        Code: {
          S3Bucket: SOURCE_S3_BUCKET,
          S3Key: `${SOURCE_S3_PREFIX}/${fileName}`
        },
        Description: `M2C2 ${protocol.toUpperCase()} ${functionType} Lambda for ${connectionName}`,
        Environment: {
          Variables: environmentVariables
        },
        Timeout: 10,
        MemorySize: 128,
        Publish: true
      };

      logger.log(LoggingLevel.DEBUG, `Creating a Lambda function: ${JSON.stringify(params, null, 2)}`);

      return lambda.createFunction(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[createLambdaFunction] input: ${JSON.stringify(input, null, 2)}, Error: `, error);

      throw new LambdaError({
        message: `Failed to create a Lambda function for the connection: "${connectionName}".`,
        name: 'LambdaHandlerError'
      });
    }
  }

  /**
   * Creates a Lambda function alias.
   * @param functionName The Lambda function name
   * @param functionArn The Lambda function ARN
   * @returns The response of the Lambda function alias creation
   * @throws `LambdaHandlerError` when it fails to create a function alias
   */
  async createFunctionAlias(functionName: string, functionArn: string): Promise<Lambda.AliasConfiguration> {
    try {
      const params: Lambda.CreateAliasRequest = {
        FunctionName: functionArn,
        Name: functionName,
        FunctionVersion: '1'
      };

      logger.log(LoggingLevel.DEBUG, `Creating a Lambda function alias: ${JSON.stringify(params, null, 2)}`);

      return lambda.createAlias(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[createFunctionAlias] functionName: ${functionName}, Error: `, error);

      throw new LambdaError({
        message: `Failed to create a connector Lambda function alias for the function: "${functionName}".`,
        name: 'LambdaHandlerError'
      });
    }
  }

  /**
   * Deletes the Lambda function.
   * @param functionName The Lambda function name
   */
  async deleteLambdaFunction(functionName: string): Promise<void> {
    try {
      const params: Lambda.DeleteFunctionRequest = {
        FunctionName: functionName
      };

      await lambda.deleteFunction(params).promise();
    } catch (error) {
      // It does not throw an error not to block the rest of steps.
      logger.log(LoggingLevel.ERROR, `[deleteLambdaFunction] functionName: ${functionName}, Error: `, error);
    }
  }
}