// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DynamoDBHandler from '../lib/dynamodb-handler';
import { LambdaError } from '../lib/errors';
import IoTHandler from '../lib/iot-handler';
import IoTSitewiseHandler from '../lib/iot-sitewise-handler';
import LambdaHandler from '../lib/lambda-handler';
import Logger, { LoggingLevel } from '../lib/logger';
import { DynamoDBHandlerTypes, IoTHandlerTypes, ConnectionBuilderTypes } from '../lib/types';
import { sendAnonymousMetric, trimAllStringInObjectOrArray } from '../lib/utils';
import { validateConnectionDefinition } from '../lib/validations';

const { API_ENDPOINT, LOGGING_LEVEL, SEND_ANONYMOUS_METRIC, SOLUTION_UUID } = process.env;
const dynamoDbHandler = new DynamoDBHandler();
const iotHandler = new IoTHandler();
const iotSitewiseHandler = new IoTSitewiseHandler();
const lambdaHandler = new LambdaHandler();
const logger = new Logger('connection-builder', LOGGING_LEVEL);

/**
 * The Lambda function deals with connections and returns the response to the API Gateway.
 * @param event The request from the API Gateway
 * @returns The response to the API Gateway
 */
exports.handler = async (event: ConnectionBuilderTypes.APIGatewayRequest): Promise<ConnectionBuilderTypes.APIGatewayResponse> => {
  const response: ConnectionBuilderTypes.APIGatewayResponse = {
    headers: {
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept', // NOSONAR: typescript:S5122 - intended CORS to return the result to the UI
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET', // NOSONAR: typescript:S5122 - intended CORS to return the result to the UI
      'Access-Control-Allow-Origin': '*' // NOSONAR: typescript:S5122 - intended CORS to return the result to the UI
    },
    statusCode: 200,
    body: JSON.stringify({})
  };

  try {
    logger.log(LoggingLevel.INFO, `Request: ${JSON.stringify(event, null, 2)}`);

    const { body, headers, httpMethod, path, pathParameters, queryStringParameters, resource } = event;

    if (!headers || !headers.Host || headers.Host !== API_ENDPOINT) {
      throw new LambdaError({
        message: 'Invalid Host header',
        name: 'ConnectionBuilderError',
        statusCode: 400
      });
    }

    const queryStrings = queryStringParameters || {};
    let result: any = {};

    switch (httpMethod) {
      case 'GET':
        switch (resource) {
          case '/connections':
            result = await dynamoDbHandler.getConnections(queryStrings.nextToken);
            break;
          case '/connections/{connectionName}':
            result = await dynamoDbHandler.getConnection(decodeURIComponent(pathParameters.connectionName));
            break;
          case '/sitewise/{serverName}':
            result = await dynamoDbHandler.getOpcUaConnectionByServerName(decodeURIComponent(pathParameters.serverName));
            break;
          case '/logs':
            result = await dynamoDbHandler.getLogs(queryStrings.nextToken);
            break;
          case '/logs/{connectionName}':
            result = await dynamoDbHandler.getLogsByConnection(decodeURIComponent(pathParameters.connectionName), queryStrings.nextToken);
            break;
          default:
            throw new LambdaError({
              message: `Path not found: GET ${path}`,
              name: 'ConnectionBuilderError',
              statusCode: 404
            });
        }

        break;
      case 'POST':
        if (path === '/connections') {
          const connectionDefinition = trimAllStringInObjectOrArray(JSON.parse(body));
          validateConnectionDefinition(connectionDefinition);
          result = await handleConnectionControl(connectionDefinition);
        } else {
          throw new LambdaError({
            message: `Path not found: POST ${path}`,
            name: 'ConnectionBuilderError',
            statusCode: 404
          });
        }

        break;
      default:
        throw new LambdaError({
          message: `Not supported http method: ${httpMethod}`,
          name: 'ConnectionBuilderError',
          statusCode: 405
        });
    }

    response.body = JSON.stringify(result);
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'Error occurred: ', error);

    /**
     * When an error happens, unless the error is controlled by `LambdaError`,
     * it sanitizes the error message to "Internal service error.".
     */
    response.statusCode = error instanceof LambdaError ? error.statusCode : 500;
    response.body = JSON.stringify({
      errorMessage: error instanceof LambdaError ? error.message : 'Internal service error.'
    });
  }

  return response;
}

/**
 * Handles a connection control.
 * @param connectionDefinition The connection definition
 * @throws `ConnectionBuilderError` when the error is controlled
 * @throws General error when the error is uncontrolled
 */
async function handleConnectionControl(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition) {
  const { control, connectionName } = connectionDefinition;

  switch (control) {
    /**
     * When updating, deploying or deleting connections, it invokes the Greengrass deployer Lambda function
     * because at the end of the process, it requires to deploy the Greengrass group
     * and it could take a long time so the API call can be timed out.
     */
    case ConnectionBuilderTypes.ConnectionControl.UPDATE:
    case ConnectionBuilderTypes.ConnectionControl.DEPLOY:
    case ConnectionBuilderTypes.ConnectionControl.DELETE:
      try {
        await dynamoDbHandler.getConnection(connectionName);

        // If the connection control is `deploy`, the connection ID should not exist.
        if (control === ConnectionBuilderTypes.ConnectionControl.DEPLOY) {
          throw new LambdaError({
            message: `\`${connectionName}\` already exists.`,
            name: 'ConnectionBuilderError',
            statusCode: 409
          });
        }
      } catch (error) {
        /**
         * If the connection control is not `deploy`, whenever any error happens, it throws an error.
         * If the connection control is `deploy` and if the error is not `LambdaError`, which is `${connectionName} does not exist.`,
         * it throws an error as it is expected that the DynamoDB client throws an error.
         */
        if ((control !== ConnectionBuilderTypes.ConnectionControl.DEPLOY)
          || (control === ConnectionBuilderTypes.ConnectionControl.DEPLOY && error.message !== `\`${connectionName}\` does not exist.`)) {
          throw error;
        }
      }

      await lambdaHandler.invokeGreengrassDeployer(connectionDefinition);

      return {
        connectionName,
        control,
        message: `Success to request to ${control} the connection: ${connectionName}. It takes time since it's running in the background.`
      };

    /**
     * As control validation check has been done in the previous step, `default` processes the connection.
     * When starting, stoping, pushing, or pulling connections, it publishes a message to the IoT topic
     * so that the Greengrass edge device can process the connection for OPC DA.
     * For OPC UA, it controls the IoT Sitewise gateway configuration or DynamoDB table.
     */
    default:
      return processConnection(connectionDefinition);
  }
}

/**
 * Processes a connection for start, stop, push, and pull control.
 * The connection definition is sent to the IoT topic, and start and stop connections update the DynamoDB table items.
 * @param connectionDefinition The connection definition to process and send throught the IoT topic
 * @returns The result of the processing connection.
 */
async function processConnection(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition): Promise<ConnectionBuilderTypes.ProcessConnectionResponse> {
  const { control, connectionName, protocol } = connectionDefinition;

  try {
    /**
     * Builds a new connection definition, publishes the connection definition to the machine throught the IoT topic,
     * and updates the DynamoDB table item.
     */
    const newConnectionDefinition = await buildConnectionDefinition(connectionName, control, protocol);

    /**
     * Currently, only supporting OPC DA and OPC UA.
     * As protocol validation check has been done in the previous step, `else` statement is for OPC UA.
     */
    if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
      await iotHandler.publishIoTTopicMessage(connectionName, IoTHandlerTypes.IotMessageTypes.JOB, newConnectionDefinition);
    } else {
      /**
       * It does not throw an error for the default as `processConnection` is expected to be executed
       * after the validation checks.
       * So, the default would be pull.
       */
      let source: any;

      switch (control) {
        /**
         * `start` expects that the source configuration has been stored in the DynamoDB table.
         * Since `start` adds the source configuration to the IoT Sitewise gateway capability configuration,
         * it should preserve the existing configuration, so it gets the source configuration from the DynamoDB table.
         */
        case ConnectionBuilderTypes.ConnectionControl.START:
          source = newConnectionDefinition.opcUa.source;
          await iotSitewiseHandler.addExistingSourceToGatewayCapabilityConfiguration(source);
          delete newConnectionDefinition.opcUa.source;

          break;
        /**
         * `stop` deletes the source configuration from the IoT Sitewise gateway capability configuration.
         * Since users could have changed configurations on the IoT Sitewise console, it preserves the configuration
         * in the DynamoDB table so when `start` happens, the source configuration can be used.
         */
        case ConnectionBuilderTypes.ConnectionControl.STOP:
          source = await iotSitewiseHandler.getGatewayCapabilityConfigurationSourceByServerName(newConnectionDefinition.opcUa.serverName);
          newConnectionDefinition.opcUa.source = source;

          await iotSitewiseHandler.deleteGatwayCapabilityConfigurationSource(newConnectionDefinition.opcUa.serverName);
          break;
        /**
         * `push` only returns the source configuration from the IoT Sitewise gateway capability configuration.
         */
        case ConnectionBuilderTypes.ConnectionControl.PUSH:
          source = await iotSitewiseHandler.getGatewayCapabilityConfigurationSourceByServerName(newConnectionDefinition.opcUa.serverName);
          await iotHandler.publishIoTTopicMessage(connectionName, IoTHandlerTypes.IotMessageTypes.INFO, {
            connectivityConfiguration: source
          });
          break;
        /**
         * By default, it's `pull`, and it returns the DynamoDB data through the IoT topic.
         */
        default:
          const opcUa = {
            ...newConnectionDefinition.opcUa
          };
          delete opcUa.source;

          await iotHandler.publishIoTTopicMessage(connectionName, IoTHandlerTypes.IotMessageTypes.INFO, opcUa);
          break;
      }
    }

    await updateConnection(newConnectionDefinition);

    if (SEND_ANONYMOUS_METRIC === 'Yes') {
      await sendAnonymousMetric({ EventType: control, protocol: protocol }, SOLUTION_UUID);
    }

    return {
      connectionName,
      control,
      result: `Success to ${control} the connection: ${connectionName}`
    };
  } catch (error) {
    logger.log(LoggingLevel.ERROR, `Error to process connection [${connectionName}] to [${control}]: `, error);

    if (error instanceof LambdaError) {
      throw error;
    } else {
      throw new LambdaError({
        message: `An error occurred while processing the connection: ${connectionName}`,
        name: 'ConnectionBuilderError',
        statusCode: 500
      });
    }
  }
}

/**
 * Builds the connection definition with the details in the DynamoDB table.
 * @param connectionName The connection name
 * @param control The connection control
 * @param protocol The connection protocol
 * @returns The new connection definition
 */
async function buildConnectionDefinition(connectionName: string, control: ConnectionBuilderTypes.ConnectionControl, protocol: ConnectionBuilderTypes.MachineProtocol): Promise<ConnectionBuilderTypes.ConnectionDefinition> {
  let newConnectionDefinition: ConnectionBuilderTypes.ConnectionDefinition = {
    connectionName,
    control,
    protocol
  };

  const existingConnection = await dynamoDbHandler.getConnection(connectionName);

  /**
   * Currently, only supporting OPC DA and OPC UA.
   * As protocol validation check has been done in the previous step, `else` statement is for OPC UA.
   */
  if (newConnectionDefinition.protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
    newConnectionDefinition.opcDa = existingConnection.opcDa;
  } else {
    newConnectionDefinition.opcUa = existingConnection.opcUa;
  }

  return newConnectionDefinition;
}

/**
 * Updates the connection in the connection DynamoDB table.
 * It only happens for the `start` and `stop` controls.
 * @param connectionDefinition The connection definition
 */
async function updateConnection(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition) {
  const { control, connectionName, opcUa } = connectionDefinition;

  if ([ConnectionBuilderTypes.ConnectionControl.START, ConnectionBuilderTypes.ConnectionControl.STOP].includes(control)) {
    const params: DynamoDBHandlerTypes.UpdateConnectionsRequest = {
      connectionName,
      control
    };

    if (opcUa) {
      params.opcUa = opcUa;
    }

    await dynamoDbHandler.updateConnection(params);
  }
}