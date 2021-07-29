// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DynamoDBHandler from '../lib/dynamodb-handler';
import { LambdaError } from '../lib/errors';
import GreengrassHandler from '../lib/greengrass-handler';
import IoTHandler from '../lib/iot-handler';
import IoTSitewiseHandler from '../lib/iot-sitewise-handler';
import LambdaHandler from '../lib/lambda-handler';
import Logger, { LoggingLevel } from '../lib/logger';
import { DynamoDBHandlerTypes, IoTHandlerTypes, ConnectionBuilderTypes, LambdaHandlerTypes } from '../lib/types';
import { sendAnonymousMetric } from '../lib/utils';

const { KINESIS_STREAM, LOGGING_LEVEL, SEND_ANONYMOUS_METRIC, SOLUTION_UUID } = process.env;
const dynamoDbHandler = new DynamoDBHandler();
const iotHandler = new IoTHandler();
const iotSitewiseHandler = new IoTSitewiseHandler();
const lambdaHalder = new LambdaHandler();
const logger = new Logger('greengrass-deployer', LOGGING_LEVEL);

/**
 * The Lambda function deploys the Greengrass group.
 * It also restarts connections which have been already started.
 * @param event The connection builder definition event to handle the Greengrass group deployment
 */
exports.handler = async (event: ConnectionBuilderTypes.ConnectionDefinition): Promise<void> => {
  logger.log(LoggingLevel.DEBUG, `Event: ${JSON.stringify(event, null, 2)}`);

  const { control, connectionName, protocol } = event;
  switch (control) {
    case ConnectionBuilderTypes.ConnectionControl.UPDATE:
    case ConnectionBuilderTypes.ConnectionControl.DELETE: // NOSONAR: typescript:S128 - this is intentional to go through the switch statement.
      /**
       * Deleting a connection only deletes Lambda functions and subscriptions from the Greengrass group definitions.
       * It will create a new Greengrass group version, but it won't deploy the new Greegrass group version
       * to the edge device since deleting a connection shouldn't impact the existing connections.
       * It also stops the OPC DA connection, removes the OPC UA connection from IoT Sitewise gateway, and deletes the connection
       * from the DynamoDB table.
       */
      await deleteConnection(connectionName, protocol);

      // Only breaks here when deleting a connection.
      if (control === ConnectionBuilderTypes.ConnectionControl.DELETE) break;
    case ConnectionBuilderTypes.ConnectionControl.DEPLOY:
      /**
       * Deploying a connection creates a collector Lambda function (only for OPC DA) and a publisher Lambda function.
       * With the newly created Lambda functions, it updates the existing Greengrass group definitions.
       * After updating all Greengrass group definitions, it creates a new Greengrass group version.
       * Then, it stops the existing running connections on the edge device and deploys the new Greengrass group version
       * to the Greeengrass group so the edge device can have the latest Lambda functions and configurations
       * of the Greengrass group.
       * Finally, it restarts the stopped connections by the Lambda function.
       */
      await deployConnection(event);
      break;
    default:
      throw new LambdaError({
        message: `Unsupported connection control ${control}.`,
        name: 'GreengrassDeployerError'
      });
  }

  if (SEND_ANONYMOUS_METRIC === 'Yes') {
    const data: any = {
      EventType: control,
      protocol
    };

    // For updating and deploying connections, it adds more data.
    if (control !== ConnectionBuilderTypes.ConnectionControl.DELETE) {
      createMetricsData(data, event);
    }

    await sendAnonymousMetric(data, SOLUTION_UUID);
  }
}

/**
 * Deploys a connection to Greengrass group.
 * @param connectionDefinition The connection definition
 * @throws `GreengrassDeployerError` when any error happens
 */
async function deployConnection(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition): Promise<void> {
  logger.log(LoggingLevel.DEBUG, `Deploying a connection: ${JSON.stringify(connectionDefinition, null, 2)}`);

  let collectorLambdaFunctionName: string;
  let publisherLambdaFunctionName: string;
  let collectorLambdaFunctionAliasArn: string;
  let publisherLambdaFunctionAliasArn: string;

  try {
    const { connectionName, area, machineName, process, protocol, sendDataToIoTSitewise, sendDataToIoTTopic, sendDataToKinesisDataStreams, siteName } = connectionDefinition;
    const greengrassHandler = new GreengrassHandler({
      connectionName,
      area,
      machineName,
      process,
      protocol,
      sendDataToIoTSitewise,
      sendDataToIoTTopic,
      sendDataToKinesisDataStreams,
      siteName
    });
    const greengrassGroupVersion = await greengrassHandler.getGreengrassGroupLatestVersion();

    if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
      /**
       * When the protocol is OPC DA,
       * create a collector Lambda function for the connection.
       */
      const collectorLambdaFunction = await lambdaHalder.createLambdaFunction({
        environmentVariables: {
          AREA: area,
          CONNECTION_GG_STREAM_NAME: `m2c2_${connectionName}_stream`,
          MACHINE_NAME: machineName,
          PROCESS: process,
          SITE_NAME: siteName
        },
        functionType: LambdaHandlerTypes.LambdaFunctionType.COLLECTOR,
        connectionName,
        protocol
      });
      collectorLambdaFunctionName = collectorLambdaFunction.FunctionName;

      const collectorLambdaFunctionAlias = await lambdaHalder.createFunctionAlias(collectorLambdaFunctionName, collectorLambdaFunction.FunctionArn);
      collectorLambdaFunctionAliasArn = collectorLambdaFunctionAlias.AliasArn;
    } else if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCUA) {
      /**
       * When the protocol is OPC UA,
       * create a source configuration in the IoT Sitewise gateway capability configuration.
       */
      await iotSitewiseHandler.addGatwayCapabilityConfigurationSource({
        connectionName,
        serverName: connectionDefinition.opcUa.serverName,
        machineIp: connectionDefinition.opcUa.machineIp,
        port: connectionDefinition.opcUa.port
      });
    }

    const publisherLambdaFunction = await lambdaHalder.createLambdaFunction({
      environmentVariables: {
        AREA: area,
        CONNECTION_GG_STREAM_NAME: `m2c2_${connectionName}_stream`,
        CONNECTION_NAME: connectionName,
        KINESIS_STREAM_NAME: KINESIS_STREAM,
        MACHINE_NAME: machineName,
        PROCESS: process,
        PROTOCOL: protocol,
        SEND_TO_IOT_TOPIC: sendDataToIoTTopic ? 'Yes' : undefined,
        SEND_TO_KINESIS_STREAM: sendDataToKinesisDataStreams ? 'Yes' : undefined,
        SEND_TO_SITEWISE: sendDataToIoTSitewise ? 'Yes' : undefined,
        SITE_NAME: siteName
      },
      functionType: LambdaHandlerTypes.LambdaFunctionType.PUBLISHER,
      connectionName,
      protocol
    });
    publisherLambdaFunctionName = publisherLambdaFunction.FunctionName;

    const publisherLambdaFunctionAlias = await lambdaHalder.createFunctionAlias(publisherLambdaFunctionName, publisherLambdaFunction.FunctionArn);
    publisherLambdaFunctionAliasArn = publisherLambdaFunctionAlias.AliasArn;

    const newDefinitionVersionArns = await greengrassHandler.updateGreengrassGroupDefinitions({
      greengrassGroupVersion,
      publisherLambdaFunctionAliasArn,
      collectorLambdaFunctionAliasArn
    });

    const response = await greengrassHandler.createGreengrassGroupVersion(newDefinitionVersionArns);
    const newConnection = await dynamoDbHandler.addConnection(connectionDefinition);

    const connectionsToRestart = await stopRunningConnections();

    if (newConnection.protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
      connectionsToRestart.push(newConnection);
    }

    await greengrassHandler.createGreengrassDeployment(response.Version);
    await startConnections(connectionsToRestart);

    if (newConnection.protocol !== ConnectionBuilderTypes.MachineProtocol.OPCDA) {
      await dynamoDbHandler.updateConnection({
        connectionName: newConnection.connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.START
      });
    }
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'An error occurred while deploying a connection to the Greengrass group. Error: ', error);

    let errorMessage = 'An error occurred while deploying a connection to the Greengrass group.';

    if (error instanceof LambdaError) {
      errorMessage = error.message;
    }

    logger.log(LoggingLevel.ERROR, 'Trying to roll back...');
    await iotHandler.publishIoTTopicMessage(connectionDefinition.connectionName, IoTHandlerTypes.IotMessageTypes.ERROR, {
      error: errorMessage
    });
    await deleteConnection(connectionDefinition.connectionName, connectionDefinition.protocol);

    throw new LambdaError({
      message: 'An error occurred while deploying a connection to the Greengrass group.',
      name: 'GreengrassDeployerError'
    });
  }
}

/**
 * Deletes a connection from the Greengrass group.
 * @param connectionName The connection name
 * @param protocol The machine protocol
 */
async function deleteConnection(connectionName: string, protocol: ConnectionBuilderTypes.MachineProtocol): Promise<void> {
  logger.log(LoggingLevel.DEBUG, `Deleting a connection, connectionName: ${connectionName}, protocol: ${protocol}`);

  try {
    const greengrassHandler = new GreengrassHandler({ connectionName });
    const greengrassGroupVersion = await greengrassHandler.getGreengrassGroupLatestVersion();
    const deleteResponse = await greengrassHandler.deleteConnectionFromGreengrassDefinitions(greengrassGroupVersion);

    const { newDefinitionVersionArns, lambdaFunctionNames } = deleteResponse;
    await greengrassHandler.createGreengrassGroupVersion(newDefinitionVersionArns);

    for (let lambdaFunctionName of lambdaFunctionNames) {
      await lambdaHalder.deleteLambdaFunction(lambdaFunctionName);
    }

    if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
      await iotHandler.publishIoTTopicMessage(connectionName, IoTHandlerTypes.IotMessageTypes.JOB, {
        connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.STOP
      });
    } else if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCUA) {
      const connection = await dynamoDbHandler.getConnection(connectionName);
      await iotSitewiseHandler.deleteGatwayCapabilityConfigurationSource(connection.opcUa.serverName);
    }

    await dynamoDbHandler.deleteConnection(connectionName);
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'An error occurred while deleting a connection from the Greengrass group. Error: ', error);

    let errorMessage = 'An error occurred while deleting a connection from the Greengrass group.';

    if (error instanceof LambdaError) {
      errorMessage = error.message;
    }

    await iotHandler.publishIoTTopicMessage(connectionName, IoTHandlerTypes.IotMessageTypes.ERROR, {
      error: errorMessage
    });

    throw new LambdaError({
      message: 'An error occurred while deleting a connection from the Greengrass group.',
      name: 'GreengrassDeployerError'
    });
  }
}

/**
 * Stops the running connections by publishing a message to the IoT topic and update the connection DynamoDB table.
 * @returns The stopped connections
 */
async function stopRunningConnections(): Promise<DynamoDBHandlerTypes.GetConnectionsItem[]> {
  let nextToken: string | undefined = undefined;
  let stoppedConnections: DynamoDBHandlerTypes.GetConnectionsItem[] = [];

  /**
   * Gets all connections from the connection DynamoDB table and filters the running connections.
   * For the OPC UA, it doesn't have a collector Lambda function in the Greegrass edge device,
   * no action is needed, so it filters only OPC DA connections.
   */
  do {
    const response = await dynamoDbHandler.getConnections(nextToken);
    const { connections } = response;
    stoppedConnections = stoppedConnections.concat(
      connections.filter(connection =>
        connection.status === 'start' && connection.protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA
      )
    );

    nextToken = response.nextToken;
  } while (nextToken);

  /**
   * Stops all running connections.
   * This is only for the graceful stop of existing running connections.
   * Therefore, it doesn't care if it succeeds for every connection or not.
   */
  for (let connection of stoppedConnections) {
    try {
      await iotHandler.publishIoTTopicMessage(connection.connectionName, IoTHandlerTypes.IotMessageTypes.JOB, {
        connectionName: connection.connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.STOP
      });

      await dynamoDbHandler.updateConnection({
        connectionName: connection.connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.STOP
      });
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `Failed to stop the connection: ${connection.connectionName}`, error);
      continue;
    }
  }

  logger.log(LoggingLevel.INFO, `Stopped connections: ${JSON.stringify(stoppedConnections, null, 2)}`);
  return stoppedConnections;
}

/**
 * Starts the OPC DA connections by publishing a message to the IoT topic and update the connection DynamoDB table.
 * Each messages contain the connection details by retrieving from the connection DynamoDB table.
 * @param connections The connections to start
 */
async function startConnections(connections: DynamoDBHandlerTypes.GetConnectionsItem[]): Promise<void> {
  logger.log(LoggingLevel.INFO, `Connections to start: ${JSON.stringify(connections, null, 2)}`);

  /**
   * Restarts all stopped connections which used to be running.
   * If any error happens, publish an error message.
   */
  for (let connection of connections) {
    try {
      const connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition = {
        connectionName: connection.connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.START,
        protocol: connection.protocol
      };

      const { connectionName } = connection;
      const startingConnection = await dynamoDbHandler.getConnection(connectionName);
      connectionDefinition.opcDa = startingConnection.opcDa;
      await iotHandler.publishIoTTopicMessage(connection.connectionName, IoTHandlerTypes.IotMessageTypes.JOB, connectionDefinition);

      await dynamoDbHandler.updateConnection({
        connectionName: connection.connectionName,
        control: ConnectionBuilderTypes.ConnectionControl.START
      });
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `Failed to restart the connection: ${connection.connectionName}`, error);
      await iotHandler.publishIoTTopicMessage(connection.connectionName, IoTHandlerTypes.IotMessageTypes.ERROR, {
        error: 'Failed to restart the connection.'
      });
    }
  }
}

/**
 * Creates metrics data based on the connection definition.
 * It assumes that every validation has been checked in the connection builder Lambda function.
 * @param data The metrics data
 * @param connectionDefinition The connection definition
 */
function createMetricsData(data: any, connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition) {
  const { protocol } = connectionDefinition;

  if (protocol === ConnectionBuilderTypes.MachineProtocol.OPCDA) {
    const { opcDa } = connectionDefinition;
    data.interval = opcDa.interval;
    data.iterations = opcDa.iterations;
    data.numberOfLists = opcDa.listTags ? opcDa.listTags.length : 0;
    data.numberOfTags = opcDa.tags ? opcDa.tags.length : 0;
  }
}