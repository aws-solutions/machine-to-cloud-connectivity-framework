// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DynamoDBHandler from '../lib/aws-handlers/dynamodb-handler';
import GreengrassV2Handler from '../lib/aws-handlers/greengrass-v2-handler';
import IoTHandler from '../lib/aws-handlers/iot-handler';
import IoTSiteWiseHandler from '../lib/aws-handlers/iot-sitewise-handler';
import LambdaHandler from '../lib/aws-handlers/lambda-handler';
import S3Handler from '../lib/aws-handlers/s3-handler';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import {
  APIResponseBodyType,
  GreengrassCoreDeviceControl,
  GreengrassCoreDeviceEventTypes,
  PostApiRequestInput,
  PostGreengrassRequestBodyInput,
  ProcessConnectionResponse,
  ProcessGreengrassCoreDeviceResponse
} from '../lib/types/connection-builder-types';
import { CreatedBy, UpdateConnectionsRequest } from '../lib/types/dynamodb-handler-types';
import { IoTMessageTypes } from '../lib/types/iot-handler-types';
import { CapabilityConfigurationSource } from '../lib/types/iot-sitewise-handler-types';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../lib/types/solution-common-types';
import { sendAnonymousMetric, trimAllStringInObjectOrArray } from '../lib/utils';
import { validateConnectionDefinition, validateGreengrassCoreDeviceRequest } from '../lib/validations';

const { GREENGRASS_RESOURCE_BUCKET, IOT_CERTIFICATE_ARN, LOGGING_LEVEL, SOLUTION_UUID } = process.env;
const dynamoDbHandler = new DynamoDBHandler();
const greengrassV2Handler = new GreengrassV2Handler();
const iotHandler = new IoTHandler();
const iotSiteWiseHandler = new IoTSiteWiseHandler();
const lambdaHandler = new LambdaHandler();
const logger = new Logger('connection-builder', LOGGING_LEVEL);
const s3Handler = new S3Handler();

/**
 * Handles POST API request.
 * @param params The parameters to execute POST API
 * @returns The POST API result
 */
export async function handlePostRequest(params: PostApiRequestInput): Promise<APIResponseBodyType> {
  const { body, resource } = params;

  switch (resource) {
    case '/connections': {
      const connectionDefinition = <ConnectionDefinition>trimAllStringInObjectOrArray(JSON.parse(body));
      validateConnectionDefinition(connectionDefinition);
      return handleConnectionControl(connectionDefinition);
    }
    case '/greengrass': {
      const requestBody = <PostGreengrassRequestBodyInput>trimAllStringInObjectOrArray(JSON.parse(body));
      validateGreengrassCoreDeviceRequest(requestBody);
      return handleGreengrassCoreDevice(requestBody);
    }
    default:
      throw new LambdaError({
        message: `Path not found: POST ${resource}`,
        name: 'ConnectionBuilderError',
        statusCode: 404
      });
  }
}

/**
 * Handles a connection control.
 * @param connectionDefinition The connection definition
 * @throws `ConnectionBuilderError` when the error is controlled
 * @throws General error when the error is uncontrolled
 * @returns The result message of handling the connection action
 */
async function handleConnectionControl(connectionDefinition: ConnectionDefinition): Promise<ProcessConnectionResponse> {
  const { control, connectionName } = connectionDefinition;
  let greengrassCoreDeviceName: string;

  switch (control) {
    /**
     * When updating, deploying or deleting connections, it invokes the Greengrass deployer Lambda function
     * because at the end of the process, it requires to deploy a new Greengrass v2 deployment
     * and it could take a long time so the API call can be timed out.
     * In order to improve the user experience,
     * the Greengrass v2 deployment happens asynchronously on the Greengrass deployer Lambda function.
     */
    case ConnectionControl.UPDATE:
    case ConnectionControl.DEPLOY:
    case ConnectionControl.DELETE:
      try {
        const connection = await dynamoDbHandler.getConnection(connectionName);

        // If the connection control is `deploy`, the connection ID should not exist.
        if (control === ConnectionControl.DEPLOY) {
          throw new LambdaError({
            message: `\`${connectionName}\` already exists.`,
            name: 'ConnectionBuilderError',
            statusCode: 409
          });
        }

        // When `update` and `delete`, gets Greengrass core device name from the connections DynamoDB table.
        greengrassCoreDeviceName = connection.greengrassCoreDeviceName;
        connectionDefinition.greengrassCoreDeviceName = greengrassCoreDeviceName;
      } catch (error) {
        /**
         * If the connection control is not `deploy`, whenever any error happens, it throws an error.
         * If the connection control is `deploy` and if the error is not `LambdaError`, which is `${connectionName} does not exist.`,
         * it throws an error as it is expected that the DynamoDB client throws an error.
         */
        if (
          control !== ConnectionControl.DEPLOY ||
          (control === ConnectionControl.DEPLOY && error.message !== `\`${connectionName}\` does not exist.`)
        ) {
          throw error;
        }

        // When `deploy`, gets Greengrass core device name from the connection definition.
        greengrassCoreDeviceName = connectionDefinition.greengrassCoreDeviceName;
      }

      // When Greengrass core device does not exist, it throws an error.
      try {
        const greengrassCoreDevice = await dynamoDbHandler.getGreengrassCoreDevice(greengrassCoreDeviceName);

        if (typeof greengrassCoreDevice === 'undefined') {
          throw new Error('Greengrass core device not found.');
        }
      } catch (error) {
        const errorMessage = 'Greengrass core device for the connection might not exist.';
        logger.log(LoggingLevel.ERROR, errorMessage);

        throw new LambdaError({
          message: errorMessage,
          name: 'ConnectionBuilderError',
          statusCode: 400
        });
      }

      await lambdaHandler.invokeGreengrassDeployer(connectionDefinition);

      return {
        connectionName,
        control,
        message: `Success to request to ${control} the connection: ${connectionName}. It takes time since it's running in the background.`
      };

    /**
     * As control validation check has been done in the previous step, `default` processes the connection.
     * When starting, stopping, pushing, or pulling connections, it publishes a message to the IoT topic
     * so that the Greengrass edge device can process the connection for OPC DA.
     * For OPC UA, it controls the IoT SiteWise gateway configuration or DynamoDB table.
     */
    default:
      return processConnection(connectionDefinition);
  }
}

/**
 * Processes a connection for start, stop, push, and pull control.
 * The connection definition is sent to the IoT topic, and start and stop connections update the DynamoDB table items.
 * @param connectionDefinition The connection definition to process and send through the IoT topic
 * @returns The result of the processing connection.
 */
async function processConnection(connectionDefinition: ConnectionDefinition): Promise<ProcessConnectionResponse> {
  const { control, connectionName, protocol } = connectionDefinition;

  try {
    /**
     * Builds a new connection definition, publishes the connection definition to the machine through the IoT topic,
     * and updates the DynamoDB table item.
     */
    const newConnectionDefinition = await buildConnectionDefinition(connectionName, control, protocol);

    /**
     * Currently, only supporting OPC DA and OPC UA.
     * As protocol validation check has been done in the previous step, `else` statement is for OPC UA.
     */
    if (protocol === MachineProtocol.OPCDA) {
      await iotHandler.publishIoTTopicMessage({
        connectionName,
        type: IoTMessageTypes.JOB,
        data: newConnectionDefinition
      });
    } else {
      const greengrassCoreDevice = await dynamoDbHandler.getGreengrassCoreDevice(
        newConnectionDefinition.greengrassCoreDeviceName
      );
      const gatewayId = greengrassCoreDevice.iotSiteWiseGatewayId;

      /**
       * It does not throw an error for the default as `processConnection` is expected to be executed
       * after the validation checks.
       * So, the default would be pull.
       */
      switch (control) {
        /**
         * `start` expects that the source configuration has been stored in the DynamoDB table.
         * Since `start` adds the source configuration to the IoT SiteWise gateway capability configuration,
         * it should preserve the existing configuration, so it gets the source configuration from the DynamoDB table.
         */
        case ConnectionControl.START: {
          const source = newConnectionDefinition.opcUa.source;
          await iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({ gatewayId, source });
          delete newConnectionDefinition.opcUa.source;

          break;
        }
        /**
         * `stop` deletes the source configuration from the IoT SiteWise gateway capability configuration.
         * Since users could have changed configurations on the IoT SiteWise console, it preserves the configuration
         * in the DynamoDB table so when `start` happens, the source configuration can be used.
         */
        case ConnectionControl.STOP: {
          const source = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({
            gatewayId,
            serverName: newConnectionDefinition.opcUa.serverName
          });
          newConnectionDefinition.opcUa.source = <CapabilityConfigurationSource>source;

          await iotSiteWiseHandler.deleteGatewayCapabilityConfigurationSource({
            gatewayId,
            serverName: newConnectionDefinition.opcUa.serverName
          });
          break;
        }
        /**
         * `push` only returns the source configuration from the IoT SiteWise gateway capability configuration.
         */
        case ConnectionControl.PUSH: {
          const source = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({
            gatewayId,
            serverName: newConnectionDefinition.opcUa.serverName
          });
          await iotHandler.publishIoTTopicMessage({
            connectionName,
            type: IoTMessageTypes.INFO,
            data: {
              connectivityConfiguration: source
            }
          });
          break;
        }
        /**
         * By default, it's `pull`, and it returns the DynamoDB data through the IoT topic.
         */
        default: {
          const opcUa = {
            ...newConnectionDefinition.opcUa
          };
          delete opcUa.source;

          await iotHandler.publishIoTTopicMessage({
            connectionName,
            type: IoTMessageTypes.INFO,
            data: opcUa
          });
          break;
        }
      }
    }

    await updateConnection(newConnectionDefinition);

    const { SEND_ANONYMOUS_METRIC } = process.env;
    if (SEND_ANONYMOUS_METRIC === 'Yes') {
      await sendAnonymousMetric({ EventType: control, protocol: protocol }, SOLUTION_UUID);
    }

    return {
      connectionName,
      control,
      message: `Success to ${control} the connection: ${connectionName}`
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
async function buildConnectionDefinition(
  connectionName: string,
  control: ConnectionControl,
  protocol: MachineProtocol
): Promise<ConnectionDefinition> {
  const newConnectionDefinition: ConnectionDefinition = {
    connectionName,
    control,
    protocol
  };

  const existingConnection = await dynamoDbHandler.getConnection(connectionName);
  newConnectionDefinition.area = existingConnection.area;
  newConnectionDefinition.greengrassCoreDeviceName = existingConnection.greengrassCoreDeviceName;
  newConnectionDefinition.machineName = existingConnection.machineName;
  newConnectionDefinition.process = existingConnection.process;
  newConnectionDefinition.sendDataToIoTSiteWise = existingConnection.sendDataToIoTSiteWise;
  newConnectionDefinition.sendDataToIoTTopic = existingConnection.sendDataToIoTTopic;
  newConnectionDefinition.sendDataToKinesisDataStreams = existingConnection.sendDataToKinesisDataStreams;
  newConnectionDefinition.siteName = existingConnection.siteName;

  /**
   * Currently, only supporting OPC DA and OPC UA.
   * As protocol validation check has been done in the previous step, `else` statement is for OPC UA.
   */
  if (newConnectionDefinition.protocol === MachineProtocol.OPCDA) {
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
async function updateConnection(connectionDefinition: ConnectionDefinition) {
  const { control, connectionName, opcUa } = connectionDefinition;

  if ([ConnectionControl.START, ConnectionControl.STOP].includes(control)) {
    const params: UpdateConnectionsRequest = {
      connectionName,
      control
    };

    if (opcUa) {
      params.opcUa = opcUa;
    }

    await dynamoDbHandler.updateConnection(params);
  }
}

/**
 * Handles Greengrass core device request.
 * @param input The Greengrass core device request input
 * @returns The Greengrass core device request result message
 */
async function handleGreengrassCoreDevice(
  input: PostGreengrassRequestBodyInput
): Promise<ProcessGreengrassCoreDeviceResponse> {
  const { control } = input;

  if (control === GreengrassCoreDeviceControl.CREATE) {
    return createGreengrassCoreDevice(input);
  } else {
    return deleteGreengrassCoreDevice(input);
  }
}

/**
 * Creates a Greengrass core device for the solution.
 * @param input The Greengrass core device request input
 * @returns The Greengrass core device creation result message
 * @throws `DuplicatedGreengrassCoreDeviceName` when Greengrass core device name exists
 */
async function createGreengrassCoreDevice(
  input: PostGreengrassRequestBodyInput
): Promise<ProcessGreengrassCoreDeviceResponse> {
  const { name, createdBy } = input;
  let message: string = `"${name}" Greengrass core device is created/registered.`;

  // Checks duplicated name in the Greengrass core device DynamoDB table.
  const greengrassCoreDeviceDynamoDbItem = await dynamoDbHandler.getGreengrassCoreDevice(name);
  if (typeof greengrassCoreDeviceDynamoDbItem !== 'undefined') {
    throw new LambdaError({
      message: 'The Greengrass core device name is already used by the system.',
      name: 'DuplicatedGreengrassCoreDeviceName',
      statusCode: 400
    });
  }

  // Checks Greengrass core device in the Greengrass.
  const { greengrassCoreDevices } = await greengrassV2Handler.listGreengrassCoreDevices();
  const greengrassCoreDeviceGreengrass = greengrassCoreDevices.find(
    greengrassCoreDevice => greengrassCoreDevice.coreDeviceThingName === name
  );
  let iotSiteWiseGatewayId: string;
  let iotThingArn: string;

  if (createdBy === CreatedBy.SYSTEM) {
    if (typeof greengrassCoreDeviceGreengrass !== 'undefined') {
      throw new LambdaError({
        message: 'The Greengrass core device name is already used in Greengrass.',
        name: 'DuplicatedGreengrassCoreDeviceNameError',
        statusCode: 400
      });
    }

    try {
      /**
       * When user choose to create a Greengrass core device, there are several steps.
       * 1. Create an IoT thing for the Greengrass core device.
       * 2. Attach an existing certificate created by the CloudFormation stack to the thing.
       * 3. Get a Greengrass installation base script, replace the thing name, and upload the script to S3 bucket.
       * 4. Create an IoT SiteWise gateway.
       */
      iotThingArn = await iotHandler.createThing(name);
      await iotHandler.attachThingPrincipal({ thingName: name, principal: IOT_CERTIFICATE_ARN });

      const baseScript = await s3Handler.getObject({
        bucket: GREENGRASS_RESOURCE_BUCKET,
        key: 'm2c2-install.sh'
      });
      const body = baseScript.Body.toString().replace('THING_NAME_PLACEHOLDER', name);
      await s3Handler.putObject({
        body,
        contentType: 'text/x-sh',
        destinationBucket: GREENGRASS_RESOURCE_BUCKET,
        destinationKey: `public/${name}.sh`
      });

      const createGatewayResponse = await iotSiteWiseHandler.createGreengrassV2Gateway(name);
      iotSiteWiseGatewayId = createGatewayResponse.gatewayId;

      message = `${message} You must install the installation script on your machine.`;
    } catch (error) {
      await rollbackCreateGreengrassCoreDevice(name);
      throw error;
    }
  } else {
    if (typeof greengrassCoreDeviceGreengrass === 'undefined') {
      throw new LambdaError({
        message: 'The Greengrass core device name does not exist in Greengrass.',
        name: 'GreengrassCoreDeviceNameNotFoundError',
        statusCode: 404
      });
    }

    /**
     * When user brings their own Greengrass core device,
     * it checks if IoT SiteWise gateway with the Greengrass core device exists.
     */
    const { gateways } = await iotSiteWiseHandler.listGreengrassV2Gateways();
    const greengrassCoreDeviceGateway = gateways.find(gateway => gateway.coreDeviceThingName === name);

    if (typeof greengrassCoreDeviceGateway === 'undefined') {
      message = `${message} "${name}" Greengrass core device is not attached to IoT SiteWise gateway. This Greengrass core device would not allow OPC UA connections.`;
    } else {
      iotSiteWiseGatewayId = greengrassCoreDeviceGateway.gatewayId;
    }

    const thing = await iotHandler.getThing(name);
    iotThingArn = thing.thingArn;

    message = `${message} You must add relative permissions on your Greengrass. Please refer to the implementation guide.`;
  }

  await dynamoDbHandler.addGreengrassCoreDevice({ name, createdBy, iotSiteWiseGatewayId, iotThingArn });

  const { SEND_ANONYMOUS_METRIC } = process.env;
  if (SEND_ANONYMOUS_METRIC === 'Yes') {
    await sendAnonymousMetric({ EventType: GreengrassCoreDeviceEventTypes.CREATE, createdBy }, SOLUTION_UUID);
  }

  return { name, message };
}

/**
 * Rolls back Greengrass core device creation.
 * To roll back, it does not care when the process fails. It only cares cleaning up the resources.
 * @param thingName The IoT thing name
 */
async function rollbackCreateGreengrassCoreDevice(thingName: string): Promise<void> {
  logger.log(LoggingLevel.ERROR, 'Rollback Greengrass core device... thingName: ', thingName);

  try {
    await iotHandler.detachThingPrincipal({ thingName, principal: IOT_CERTIFICATE_ARN });
  } catch (error) {
    logger.log(
      LoggingLevel.ERROR,
      'An error occurred while detaching thing from principal. IoT thing principal might not exist nor be detached completely: ',
      error
    );
  }

  try {
    await iotHandler.deleteThing(thingName);
  } catch (error) {
    logger.log(
      LoggingLevel.ERROR,
      'An error occurred while deleting thing. IoT thing might not exist nor be deleted completely: ',
      error
    );
  }
}

/**
 * Deletes a Greengrass core device of the solution.
 * @param input The Greengrass core device request input
 * @returns The Greengrass core device deletion result message
 * @throws `GreengrassCoreDeviceNotFoundError` when the Greengrass core device does not exist
 * @throws `ExistingConnectionError` when the Greengrass core device has connections
 */
async function deleteGreengrassCoreDevice(
  input: PostGreengrassRequestBodyInput
): Promise<ProcessGreengrassCoreDeviceResponse> {
  const { createdBy, name } = input;
  const greengrassCoreDevice = await dynamoDbHandler.getGreengrassCoreDevice(name);

  if (typeof greengrassCoreDevice === 'undefined') {
    throw new LambdaError({
      message: `"${name}" Greengrass core device does not exist.`,
      name: 'GreengrassCoreDeviceNotFoundError',
      statusCode: 404
    });
  }

  // Checks if the Greengrass core device has any connections.
  if (greengrassCoreDevice.numberOfConnections > 0) {
    throw new LambdaError({
      message: `"${name}" Greengrass core device has connections. You need to remove connections first.`,
      name: 'ExistingConnectionError',
      statusCode: 428
    });
  }

  if (createdBy === CreatedBy.SYSTEM) {
    /**
     * When user choose to delete a Greengrass core device created by the solution,
     * 1. Delete an IoT SiteWise gateway.
     * 2. Delete a Greengrass core device.
     * 3. Detach the certificate from the IoT thing.
     * 4. Delete the IoT thing.
     * 5. Deletes a Greengrass core device installation script from the S3 bucket.
     */
    await Promise.all([
      iotSiteWiseHandler.deleteGreengrassV2Gateway(greengrassCoreDevice.iotSiteWiseGatewayId),
      iotHandler.detachThingPrincipal({ thingName: name, principal: IOT_CERTIFICATE_ARN }),
      s3Handler.deleteObject({ sourceBucket: GREENGRASS_RESOURCE_BUCKET, sourceKey: `public/${name}.sh` })
    ]);
    await Promise.all([greengrassV2Handler.deleteGreengrassCoreDevice(name), iotHandler.deleteThing(name)]);
  }

  await dynamoDbHandler.deleteGreengrassCoreDevice(name);

  const { SEND_ANONYMOUS_METRIC } = process.env;
  if (SEND_ANONYMOUS_METRIC === 'Yes') {
    await sendAnonymousMetric({ EventType: GreengrassCoreDeviceEventTypes.DELETE, createdBy }, SOLUTION_UUID);
  }

  return {
    name,
    message: `"${name}" Greengrass core device is deleted/deregistered.`
  };
}
