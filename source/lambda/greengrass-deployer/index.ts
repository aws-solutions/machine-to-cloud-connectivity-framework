// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DynamoDBHandler from '../lib/aws-handlers/dynamodb-handler';
import SecretsManagerHandler from '../lib/aws-handlers/secretsManager-handler';
import GreengrassV2Handler from '../lib/aws-handlers/greengrass-v2-handler';
import IoTHandler from '../lib/aws-handlers/iot-handler';
import IoTSiteWiseHandler from '../lib/aws-handlers/iot-sitewise-handler';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import {
  DeleteComponentRequest,
  MetricData,
  UpdateOpcUaConfigurationRequest
} from '../lib/types/greengrass-deployer-types';
import {
  ComponentConnectionMetadata,
  ComponentType,
  CreateComponentRecipeRequest,
  CreateDeploymentRequest,
  DeploymentStatus,
  PostDeploymentRequest,
  SecretManagement
} from '../lib/types/greengrass-v2-handler-types';
import { IoTMessageTypes } from '../lib/types/iot-handler-types';
import { CapabilityConfigurationSource } from '../lib/types/iot-sitewise-handler-types';
import {
  ConnectionControl,
  ConnectionDefinition,
  MachineProtocol,
  OsiPiAuthMode
} from '../lib/types/solution-common-types';
import { sendAnonymousMetric, sleep } from '../lib/utils';

const { LOGGING_LEVEL, SOLUTION_UUID } = process.env;
const dynamoDbHandler = new DynamoDBHandler();
const secretsManagerHandler = new SecretsManagerHandler();
const greengrassV2Handler = new GreengrassV2Handler();
const iotHandler = new IoTHandler();
const iotSitewiseHandler = new IoTSiteWiseHandler();
const logger = new Logger('greengrass-deployer', LOGGING_LEVEL);

/**
 * The Lambda function controls the Greengrass v2 components and deployments.
 * @param event The connection builder definition event to handle the Greengrass v2.
 */
export async function handler(event: ConnectionDefinition): Promise<void> {
  logger.log(LoggingLevel.DEBUG, `Event: ${JSON.stringify(event, null, 2)}`);

  const newComponents: string[] = [];
  const deletedComponents: string[] = [];
  const { connectionName, control, greengrassCoreDeviceName, protocol } = event;
  const greengrassCoreDevice = await dynamoDbHandler.getGreengrassCoreDevice(greengrassCoreDeviceName);
  const { iotSiteWiseGatewayId, iotThingArn } = greengrassCoreDevice;

  let updatedComponents: Record<string, string> = {};
  const secretManagement: SecretManagement[] = [];
  let futureStatus: ConnectionControl;

  switch (control) {
    case ConnectionControl.UPDATE: {
      const connection = await dynamoDbHandler.getConnection(connectionName);
      futureStatus = connection.control;

      await dynamoDbHandler.updateConnection({
        connectionName,
        control: ConnectionControl.UPDATE
      });
      updatedComponents = {
        ...updateComponents(event)
      };

      if (protocol === MachineProtocol.OPCUA) {
        await updateOpcUaConfiguration({
          currentConfiguration: connection,
          currentControl: futureStatus,
          gatewayId: iotSiteWiseGatewayId,
          newConfiguration: event
        });
      } else if (event.protocol === MachineProtocol.OSIPI) {
        if (
          event.osiPi?.authMode === OsiPiAuthMode.BASIC &&
          !isNullOrWhitespace(event.osiPi.username) &&
          !isNullOrWhitespace(event.osiPi.password)
        ) {
          const secretResponse = await secretsManagerHandler.updateSecret(`m2c2-${event.connectionName}`, {
            username: event.osiPi.username,
            password: event.osiPi.password
          });

          //remove basic creds from osiPi obj
          delete event.osiPi.username;
          delete event.osiPi.password;

          secretManagement.push({
            secretArn: secretResponse.ARN,
            action: ConnectionControl.UPDATE
          });
        }
      }

      break;
    }
    case ConnectionControl.DELETE:
      await dynamoDbHandler.updateConnection({
        connectionName,
        control: ConnectionControl.DELETE
      });
      deletedComponents.push(
        ...(await deleteComponents({ connectionName, gatewayId: iotSiteWiseGatewayId, protocol }))
      );

      try {
        const deletedSecret = await secretsManagerHandler.deleteSecret(`m2c2-${event.connectionName}`);

        secretManagement.push({
          secretArn: deletedSecret.ARN,
          action: ConnectionControl.DELETE
        });
      } catch (err) {
        logger.log(
          LoggingLevel.DEBUG,
          `Secret deletion failed. Most likely this is due to the component not having a secret`
        );
      }

      break;
    case ConnectionControl.DEPLOY:
      if (event.protocol == MachineProtocol.OSIPI) {
        if (event.osiPi?.authMode == OsiPiAuthMode.BASIC) {
          const secretResponse = await secretsManagerHandler.createSecret(`m2c2-${event.connectionName}`, {
            username: event.osiPi.username,
            password: event.osiPi.password
          });
          event.osiPi.credentialSecretArn = secretResponse.ARN;

          //remove basic creds from osiPi obj
          event.osiPi.username = undefined;
          event.osiPi.password = undefined;

          secretManagement.push({
            secretArn: secretResponse.ARN,
            action: ConnectionControl.DEPLOY
          });
        }
      }

      await dynamoDbHandler.addConnection(event);
      newComponents.push(...(await createComponents({ ...event, gatewayId: iotSiteWiseGatewayId })));
      futureStatus = ConnectionControl.START;

      break;
    default:
      throw new LambdaError({
        message: `Unsupported connection control ${control}.`,
        name: 'GreengrassDeployerError'
      });
  }

  const deploymentStatus = await createDeployment({
    iotThingArn,
    deletedComponents,
    newComponents,
    updatedComponents,
    secretManagement
  });

  if (['CANCELED', 'FAILED'].includes(deploymentStatus)) {
    const errorMessage = 'The greengrass deployment has been canceled or failed.';
    iotHandler.publishIoTTopicMessage({
      connectionName,
      type: IoTMessageTypes.ERROR,
      data: {
        error: errorMessage
      }
    });

    throw new LambdaError({
      message: errorMessage,
      name: 'DeploymentFailure',
      statusCode: 500
    });
  }

  await postDeployment({
    connectionDefinition: event,
    futureStatus
  });

  if (process.env.SEND_ANONYMOUS_METRIC === 'Yes') {
    const data: MetricData = {
      EventType: control,
      protocol
    };

    // For updating and deploying connections, it adds more data.
    if (control !== ConnectionControl.DELETE) {
      createMetricsData(data, event);
    }

    await sendAnonymousMetric(data, SOLUTION_UUID);
  }
}

/**
 * Creates Greengrass v2 components or IoT SiteWise gateway data source of a connection.
 * @param connectionDefinition The connection definition
 * @returns The new Greengrass components
 * @throws `GreengrassDeployerError` when any error happens
 */
async function createComponents(connectionDefinition: ConnectionDefinition): Promise<string[]> {
  logger.log(LoggingLevel.DEBUG, `Deploying a connection: ${JSON.stringify(connectionDefinition, null, 2)}`);

  const {
    connectionName,
    area,
    gatewayId,
    machineName,
    process,
    logLevel,
    protocol,
    sendDataToIoTSiteWise,
    sendDataToIoTTopic,
    sendDataToKinesisDataStreams,
    sendDataToTimestream,
    siteName
  } = connectionDefinition;

  try {
    const newComponents: string[] = [];
    const createComponentParameters: CreateComponentRecipeRequest = {
      area: area,
      componentType: ComponentType.COLLECTOR,
      connectionName: connectionName,
      machineName: machineName,
      process: process,
      siteName: siteName,
      logLevel: logLevel,
      protocol: protocol
    };

    if (protocol === MachineProtocol.OPCDA || protocol === MachineProtocol.OSIPI) {
      /**
       * When the protocol is OPC DA, create a collector component.
       */
      const collectorComponentResponse = await greengrassV2Handler.createComponent({ ...createComponentParameters });
      newComponents.push(collectorComponentResponse.componentName);
    } else if (protocol === MachineProtocol.OPCUA) {
      /**
       * When the protocol is OPC UA,
       * create a source configuration in the IoT SiteWise gateway capability configuration.
       */
      await iotSitewiseHandler.addGatewayCapabilityConfigurationSource({
        connectionName,
        gatewayId,
        serverName: connectionDefinition.opcUa.serverName,
        machineIp: connectionDefinition.opcUa.machineIp,
        port: connectionDefinition.opcUa.port
      });
    }

    // Creates a publisher component.
    createComponentParameters.componentType = ComponentType.PUBLISHER;
    createComponentParameters.sendDataToIoTSiteWise = sendDataToIoTSiteWise;
    createComponentParameters.sendDataToIoTTopic = sendDataToIoTTopic;
    createComponentParameters.sendDataToKinesisStreams = sendDataToKinesisDataStreams;
    createComponentParameters.sendDataToTimestream = sendDataToTimestream;

    const publisherComponentResponse = await greengrassV2Handler.createComponent(createComponentParameters);
    newComponents.push(publisherComponentResponse.componentName);

    return newComponents;
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'An error occurred while creating Greengrass v2 components. Error: ', error);

    let errorMessage = 'An error occurred while creating Greengrass v2 components.';

    if (error instanceof LambdaError) {
      errorMessage = error.message;
    }

    logger.log(LoggingLevel.ERROR, 'Trying to roll back...');
    await iotHandler.publishIoTTopicMessage({
      connectionName,
      type: IoTMessageTypes.ERROR,
      data: {
        error: errorMessage
      }
    });
    await deleteComponents({
      connectionName,
      gatewayId,
      protocol
    });
    await dynamoDbHandler.deleteConnection(connectionName);

    throw new LambdaError({
      message: 'An error occurred while creating Greengrass v2 components.',
      name: 'GreengrassDeployerError'
    });
  }
}

/**
 * Deletes Greengrass v2 components or IoT SiteWise gateway data source of a connection.
 * @param params The connection name, the IoT SiteWise gateway Id, and the machine protocol
 * @returns The deleted Greengrass v2 components
 */
async function deleteComponents(params: DeleteComponentRequest): Promise<string[]> {
  const { connectionName, gatewayId, protocol } = params;
  logger.log(
    LoggingLevel.DEBUG,
    `Deleting a connection, connectionName: ${connectionName}, gatewayId: ${gatewayId}, protocol: ${protocol}`
  );

  try {
    const deletedComponents: string[] = [];
    let componentName = `m2c2-${connectionName}`;

    if (protocol === MachineProtocol.OPCDA || protocol === MachineProtocol.OSIPI) {
      await iotHandler.publishIoTTopicMessage({
        connectionName,
        type: IoTMessageTypes.JOB,
        data: {
          connectionName,
          control: ConnectionControl.STOP
        }
      });
      await greengrassV2Handler.deleteComponent(componentName);

      deletedComponents.push(componentName);
    } else if (protocol === MachineProtocol.OPCUA) {
      const connection = await dynamoDbHandler.getConnection(connectionName);

      /**
       * Stopped connection means IoT SiteWise gateway does not have the source in the capability configuration.
       * Therefore, there is nothing to delete from IoT SiteWise gateway.
       */
      if (connection.control !== ConnectionControl.STOP) {
        await iotSitewiseHandler.deleteGatewayCapabilityConfigurationSource({
          gatewayId,
          serverName: connection.opcUa.serverName
        });
      }
    }

    componentName = `${componentName}-publisher`;
    await greengrassV2Handler.deleteComponent(componentName);
    deletedComponents.push(componentName);

    return deletedComponents;
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'An error occurred while deleting Greengrass v2 components. Error: ', error);

    let errorMessage = 'An error occurred while deleting Greengrass v2 components.';

    if (error instanceof LambdaError) {
      errorMessage = error.message;
    }

    await iotHandler.publishIoTTopicMessage({
      connectionName,
      type: IoTMessageTypes.ERROR,
      data: {
        error: errorMessage
      }
    });

    throw new LambdaError({
      message: 'An error occurred while deleting Greengrass v2 components.',
      name: 'GreengrassDeployerError'
    });
  }
}

/**
 * Updates the Greengrass v2 components configuration.
 * @param connectionDefinition The connection definition
 * @returns The updated Greengrass v2 components configuration
 */
function updateComponents(connectionDefinition: ConnectionDefinition): Record<string, string> {
  const {
    area,
    connectionName,
    machineName,
    process,
    logLevel,
    protocol,
    siteName,
    sendDataToIoTTopic,
    sendDataToIoTSiteWise,
    sendDataToKinesisDataStreams,
    sendDataToTimestream
  } = connectionDefinition;
  const connectionMetadata: ComponentConnectionMetadata = {
    area,
    connectionName,
    machineName,
    process,
    siteName,
    logLevel: logLevel,
    streamName: `m2c2_${connectionName}_stream`
  };
  const updatedComponents: Record<string, string> = {};

  if (protocol === MachineProtocol.OPCDA || protocol === MachineProtocol.OSIPI) {
    updatedComponents[`m2c2-${connectionName}`] = JSON.stringify({ connectionMetadata });
  }

  connectionMetadata.sendDataToIoTTopic = sendDataToIoTTopic ? 'Yes' : '';
  connectionMetadata.sendDataToIoTSiteWise = sendDataToIoTSiteWise ? 'Yes' : '';
  connectionMetadata.sendDataToKinesisStreams = sendDataToKinesisDataStreams ? 'Yes' : '';
  connectionMetadata.sendDataToTimestream = sendDataToTimestream ? 'Yes' : '';
  updatedComponents[`m2c2-${connectionName}-publisher`] = JSON.stringify({ connectionMetadata });

  return updatedComponents;
}

/**
 * Updates the OPC UA configuration in IoT SiteWise
 * @param params The updating OPC UA configuration parameters
 */
async function updateOpcUaConfiguration(params: UpdateOpcUaConfigurationRequest): Promise<void> {
  const { currentConfiguration, currentControl, gatewayId, newConfiguration } = params;
  const { connectionName, control, opcUa } = currentConfiguration;
  const { machineIp, port } = newConfiguration.opcUa;
  const currentServerName = opcUa.serverName;
  const newServerName = newConfiguration.opcUa.serverName;
  const newEndpointUri = iotSitewiseHandler.getEndpointUri(machineIp, port);

  /**
   * When the server name is changed, check if the changed server name exists
   * as IoT SiteWise only supports unique server names in a gateway.
   */
  if (currentServerName !== newServerName) {
    const opcUaConnection = await dynamoDbHandler.getOpcUaConnectionByServerName(newServerName);

    // The DynamoDB handler returns empty JSON when the server name does not exist in the DynamoDB table.
    if (Object.keys(opcUaConnection).length > 0) {
      const errorMessage = `The server name should be unique. The server name is already used by the other connection: ${newServerName}`;
      logger.log(LoggingLevel.ERROR, errorMessage);

      await iotHandler.publishIoTTopicMessage({
        connectionName,
        type: IoTMessageTypes.ERROR,
        data: {
          error: errorMessage
        }
      });

      await dynamoDbHandler.updateConnection({
        connectionName,
        control: currentControl
      });

      throw new LambdaError({
        message: errorMessage,
        name: 'DuplicatedServerNameError',
        statusCode: 400
      });
    }
  }

  /**
   * When the current connection is running (`START`), updates the server name and endpoint URI.
   */
  if (control === ConnectionControl.START) {
    const sourceConfiguration = await iotSitewiseHandler.getGatewayCapabilityConfigurationSourceByServerName({
      gatewayId,
      serverName: currentServerName
    });
    sourceConfiguration.endpoint.endpointUri = newEndpointUri;
    sourceConfiguration.name = newServerName;

    await iotSitewiseHandler.deleteGatewayCapabilityConfigurationSource({
      gatewayId,
      serverName: currentServerName
    });
    await iotSitewiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
      gatewayId,
      source: <CapabilityConfigurationSource>sourceConfiguration
    });
  }

  if (typeof opcUa.source !== 'undefined') {
    opcUa.source.endpoint.endpointUri = newEndpointUri;
    opcUa.source.name = newServerName;
  }

  opcUa.machineIp = machineIp;
  opcUa.port = port;
  opcUa.serverName = newServerName;
  await dynamoDbHandler.updateConnection({
    connectionName,
    control: ConnectionControl.UPDATE,
    opcUa
  });
}

/**
 * Creates a new Greengrass v2 deployment. It waits until the deployment is completed, canceled, or failed.
 * @param params The Greengrass v2 new components, deleted components, and updated components for the new deployment
 * @returns The Greengrass v2 new deployment status
 */
async function createDeployment(params: CreateDeploymentRequest): Promise<DeploymentStatus> {
  const { iotThingArn, deletedComponents, newComponents, updatedComponents, secretManagement } = params;
  const { deploymentId } = await greengrassV2Handler.createDeployment({
    iotThingArn,
    deletedComponents,
    newComponents,
    updatedComponents,
    secretManagement
  });
  let deploymentStatus: DeploymentStatus;

  do {
    const deployment = await greengrassV2Handler.getDeployment(deploymentId);
    deploymentStatus = deployment.deploymentStatus;
    await sleep(5);
  } while (!['COMPLETED', 'CANCELED', 'FAILED'].includes(deploymentStatus));

  return deploymentStatus;
}

/**
 * Manages the connection after deployment.
 * If the connection protocol is OPC DA and it is for deploying a new connection, it starts the connection.
 * If the connection protocol is OPC DA and it is for updating a new connection, it stops and starts the connection
 * only if the connection is currently running. This is to update the local configuration.
 * The connection DynamoDB table item updates the control for deploying and updating the connection.
 * When it is for deleting a connection, delete the connection Item from the DynamoDB table.
 * @param params The Greengrass v2 post deployment parameters
 */
async function postDeployment(params: PostDeploymentRequest): Promise<void> {
  const { connectionDefinition, futureStatus } = params;
  const { connectionName, control, greengrassCoreDeviceName, protocol } = connectionDefinition;

  // Sometimes it takes time to deploy the components, so it gives a term.
  if (protocol === MachineProtocol.OPCDA || protocol === MachineProtocol.OSIPI) {
    if (control === ConnectionControl.DEPLOY) {
      await sleep(30);
      await startComponentBasedConnection(connectionDefinition);
    } else if (control === ConnectionControl.UPDATE && futureStatus === ConnectionControl.START) {
      await sleep(30);
      await iotHandler.publishIoTTopicMessage({
        connectionName,
        type: IoTMessageTypes.JOB,
        data: {
          connectionName,
          control: ConnectionControl.STOP
        }
      });

      await sleep(3);
      await startComponentBasedConnection(connectionDefinition);
    }
  }

  if ([ConnectionControl.DEPLOY, ConnectionControl.UPDATE].includes(control)) {
    const promises: Promise<unknown>[] = [
      dynamoDbHandler.updateConnection({
        connectionName,
        control: futureStatus,
        area: connectionDefinition.area,
        greengrassCoreDeviceName: connectionDefinition.greengrassCoreDeviceName,
        machineName: connectionDefinition.machineName,
        opcDa: connectionDefinition.opcDa,
        opcUa: connectionDefinition.opcUa,
        osiPi: connectionDefinition.osiPi,
        process: connectionDefinition.process,
        sendDataToIoTSiteWise: connectionDefinition.sendDataToIoTSiteWise,
        sendDataToIoTTopic: connectionDefinition.sendDataToIoTTopic,
        sendDataToKinesisDataStreams: connectionDefinition.sendDataToKinesisDataStreams,
        sendDataToTimestream: connectionDefinition.sendDataToTimestream,
        siteName: connectionDefinition.siteName,
        logLevel: connectionDefinition.logLevel
      })
    ];

    if (control === ConnectionControl.DEPLOY) {
      promises.push(dynamoDbHandler.updateGreengrassCoreDevice({ name: greengrassCoreDeviceName, increment: true }));
    }

    await Promise.all(promises);
  } else {
    await Promise.all([
      dynamoDbHandler.deleteConnection(connectionName),
      dynamoDbHandler.updateGreengrassCoreDevice({ name: greengrassCoreDeviceName, increment: false })
    ]);
  }
}

/**
 * Starts connection for a component based consumer of data (OPC DA / OSI PI)
 * @param connectionDefinition The connection definition
 */
async function startComponentBasedConnection(connectionDefinition: ConnectionDefinition): Promise<void> {
  const { connectionName } = connectionDefinition;
  await iotHandler.publishIoTTopicMessage({
    connectionName,
    type: IoTMessageTypes.JOB,
    data: {
      ...connectionDefinition,
      control: ConnectionControl.START
    }
  });
}

/**
 * Creates metrics data based on the connection definition.
 * It assumes that every validation has been checked in the connection builder Lambda function.
 * @param data The metrics data
 * @param connectionDefinition The connection definition
 */
function createMetricsData(data: MetricData, connectionDefinition: ConnectionDefinition) {
  const { protocol } = connectionDefinition;

  if (protocol === MachineProtocol.OPCDA) {
    const { opcDa } = connectionDefinition;
    data.interval = opcDa.interval;
    data.iterations = opcDa.iterations;
    data.numberOfLists = opcDa.listTags ? opcDa.listTags.length : 0;
    data.numberOfTags = opcDa.tags ? opcDa.tags.length : 0;
  } else if (protocol === MachineProtocol.OSIPI) {
    const { osiPi } = connectionDefinition;
    data.interval = osiPi.requestFrequency;
    data.iterations = 1;
    data.numberOfTags = osiPi.tags ? osiPi.tags.length : 0;
  }
}

/**
 *
 * @param str the string to check if null/undefined/empty
 * @returns true if the string is null/undefined/empty, otherwise false
 */
function isNullOrWhitespace(str: string) {
  return str == undefined || str.trim().length == 0;
}
