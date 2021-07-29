// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import IotSitewise from 'aws-sdk/clients/iotsitewise';
import { LambdaError } from './errors';
import Logger, { LoggingLevel } from './logger';
import { IoTSitewiseHandlerTypes } from './types';
import { getAwsSdkOptions } from './utils';

const { IOT_SITEWISE_GATEWAY_ID, LOGGING_LEVEL } = process.env;
const iotSitewse = new IotSitewise(getAwsSdkOptions());
const logger = new Logger('IoTSitewiseHandler', LOGGING_LEVEL);

/**
 * @class The IoT Sitewse handler for the IoT Sitewise actions
 */
export default class IoTSitewiseHandler {
  // IoT Sitewise gateway ID
  private readonly gatewayId: string;
  // OPC UA namespace
  private readonly opcUaNamespace: string;

  constructor() {
    this.gatewayId = IOT_SITEWISE_GATEWAY_ID;
    // https://docs.aws.amazon.com/iot-sitewise/latest/userguide/configure-opc-ua-source-cli.html
    this.opcUaNamespace = 'iotsitewise:opcuacollector:1';
  }

  /**
   * Gets the default gateway configuration source for OPC UA.
   * It only returns the default configuration source, and the detailed configuration
   * needs to be updated through the IoT Sitewise console.
   * @param name The OPC UA name
   * @param endpointUri The OPC UA local endpoint
   * @param connectionName The connection name
   * @returns The default gateway configuration source
   */
  public getDefaultSource(name: string, endpointUri: string, connectionName: string): object {
    return {
      name,
      endpoint: {
        certificateTrust: {
          type: 'TrustAny'
        },
        endpointUri,
        securityPolicy: 'NONE',
        messageSecurityMode: 'NONE',
        identityProvider: {
          type: 'Anonymous'
        },
        nodeFilterRules: [
          {
            action: 'INCLUDE',
            definition: {
              type: 'OpcUaRootPath',
              rootPath: '/'
            }
          }
        ]
      },
      measurementDataStreamPrefix: '',
      destination: {
        type: 'StreamManager',
        streamName: `m2c2_${connectionName}_stream`,
        streamBufferSize: 10
      }
    };
  }

  /**
   * Gets the IoT Sitewise gateway capability configuration sources.
   * Currently, only OPC UA is supported.
   * @returns The IoT Sitewise gateway capability configuration sources
   * @throws `GetGatewayCapabilityConfigurationSourcesError` when an error happens
   */
  public async getGatwayCapabilityConfigurationSources(): Promise<any[]> {
    const params: IotSitewise.DescribeGatewayCapabilityConfigurationRequest = {
      gatewayId: this.gatewayId,
      capabilityNamespace: this.opcUaNamespace
    };

    try {
      logger.log(LoggingLevel.DEBUG, `Getting gateway capability configuration sources, gatewasyId: ${this.gatewayId}`);

      const response = await iotSitewse.describeGatewayCapabilityConfiguration(params).promise();
      const configuration: { sources: any[] | undefined } = JSON.parse(response.capabilityConfiguration);

      if (!configuration.sources) {
        logger.log(LoggingLevel.DEBUG, 'Gateway capability configuration sources are empty.');
        return [];
      }

      return configuration.sources;
    } catch (error) {
      /**
       * At first, OPC_UA_NAMESPACE does not exist. If so, handle it reasonably.
       * For other errors, throw an error.
       */
      if (error.code && error.code === 'ResourceNotFoundException'
        && error.message && error.message.includes(this.opcUaNamespace)) {
        return [];
      } else {
        logger.log(LoggingLevel.ERROR, '[getGatwayCapabilityConfigurationSources] Error: ', error);

        throw new LambdaError({
          message: 'Failed to get IoT Sitewise gateway capability configuration sources.',
          name: 'GetGatewayCapabilityConfigurationSourcesError'
        });
      }
    }
  }

  /**
   * Gets the IoT Sitewise gateway capability configuration source by the server name.
   * @param serverName The server name
   * @returns The source of the IoT Sitewise gateway capability configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `GetGatewayCapabilityConfigurationSourceByServerNameError` when an error happens other than other LambdaError
   */
  public async getGatewayCapabilityConfigurationSourceByServerName(serverName: string): Promise<any> {
    try {
      logger.log(LoggingLevel.DEBUG, `Getting gateway capability configuration source by server name, serverName: ${serverName}`);

      const sources = await this.getGatwayCapabilityConfigurationSources();
      return sources.find(src => src.name === serverName) || {};
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[getGatewayCapabilityConfigurationSourceByServerName] serverName: ${serverName}, Error: `, error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : `Failed to get IoT Sitewise gateway capability configuration source for the name: ${serverName}`,
        name: error instanceof LambdaError ? error.name : 'GetGatewayCapabilityConfigurationSourceByServerNameError'
      });
    }
  }

  /**
   * Adds a source to the IoT Sitewise gateway capability configuration.
   * @param input The input parameters of adding gateway capability configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `AddGatwayCapabilityConfigurationSourceError` when other error happens
   */
  public async addGatwayCapabilityConfigurationSource(input: IoTSitewiseHandlerTypes.AddGatewayCapacityConfigurationRequest): Promise<void> {
    const { connectionName, serverName, machineIp, port } = input;

    try {
      logger.log(LoggingLevel.DEBUG, `Adding gateway capability configuration source, input: ${JSON.stringify(input, null, 2)}`);

      const sources = await this.getGatwayCapabilityConfigurationSources();
      const endpointUri = this.getEndpointUri(machineIp, port);
      sources.push(this.getDefaultSource(serverName, endpointUri, connectionName));
      logger.log(LoggingLevel.DEBUG, `New sources to add: ${JSON.stringify({ sources }, null, 2)}`);

      const configuration = JSON.stringify({ sources });
      await this.updateGatewayCapabilityConfiguration(configuration);
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[addGatwayCapabilityConfigurationSource] connectionName: ${connectionName}, Error: `, error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : `Failed to add IoT Sitewise gateway capability configuration source for the connection: ${connectionName}`,
        name: error instanceof LambdaError ? error.name : 'AddGatwayCapabilityConfigurationSourceError'
      });
    }
  }

  /**
   * Adds the source configuration to the IoT Sitewise gateway capability configuration.
   * @param source The source configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `AddExistingSourceToGatewayCapabilityConfigurationError` when other error happens
   */
  public async addExistingSourceToGatewayCapabilityConfiguration(source: any) {
    try {
      logger.log(LoggingLevel.DEBUG, `Adding existing source to gateway capability configuration, source: ${JSON.stringify(source, null, 2)}`);

      const sources = await this.getGatwayCapabilityConfigurationSources();
      sources.push(source);
      logger.log(LoggingLevel.DEBUG, `New sources to add: ${JSON.stringify({ sources }, null, 2)}`);

      const configuration = JSON.stringify({ sources });
      await this.updateGatewayCapabilityConfiguration(configuration);
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[addExistingSourceToGatewayCapabilityConfiguration] Error: ', error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : 'Failed to add IoT Sitewise gateway capability configuration',
        name: error instanceof LambdaError ? error.name : 'AddExistingSourceToGatewayCapabilityConfigurationError'
      });
    }
  }

  /**
   * Deletes a source from the IoT Sitewise gateway capability configuration.
   * @param serverName The server name to delete
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `DeleteGatwayCapabilityConfigurationSourceError` when other error happens
   */
  public async deleteGatwayCapabilityConfigurationSource(serverName: string): Promise<void> {
    try {
      logger.log(LoggingLevel.DEBUG, `Deleting gateway capability configuration source, serverName: ${serverName}`);

      const sources = await this.getGatwayCapabilityConfigurationSources();
      const configuration = JSON.stringify({
        sources: sources.filter(source => source.name !== serverName)
      });
      await this.updateGatewayCapabilityConfiguration(configuration);
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[deleteGatwayCapabilityConfigurationSource] serverName: ${serverName}, Error: `, error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : `Failed to delete IoT Sitewise gateway capability configuration source for the name: ${serverName}`,
        name: error instanceof LambdaError ? error.name : 'DeleteGatwayCapabilityConfigurationSourceError'
      });
    }
  }

  /**
   * Updates the IoT Sitewise gateway capability configuration.
   * @param configuration The IoT Sitewise gateway capability configuration
   * @throws `UpdateGatewayCapabilityConfigurationError` when any error happens
   */
  public async updateGatewayCapabilityConfiguration(configuration: string) {
    try {
      logger.log(LoggingLevel.DEBUG, `Testing new gateway capability configuration, configuration: ${configuration}`);

      const json = JSON.parse(configuration);
      if (!json.sources || !Array.isArray(json.sources)) {
        throw Error('The key `sources` is missing or invalid.');
      }
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[updateGatewayCapabilityConfiguration] Parse Error: ', error);

      throw new LambdaError({
        message: 'Failed to parse the configuration.',
        name: 'ParseConfigurationError'
      });
    }

    try {
      const params: IotSitewise.UpdateGatewayCapabilityConfigurationRequest = {
        gatewayId: this.gatewayId,
        capabilityNamespace: this.opcUaNamespace,
        capabilityConfiguration: configuration
      };

      logger.log(LoggingLevel.DEBUG, `Updating gateway capability configuration: ${JSON.stringify(params, null, 2)}`);

      await iotSitewse.updateGatewayCapabilityConfiguration(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[updateGatewayCapabilityConfiguration] Error: ', error);

      throw new LambdaError({
        message: 'Failed to update the IoT Sitewise gateway capability configuration.',
        name: 'UpdateGatewayCapabilityConfigurationError'
      });
    }
  }

  /**
   * Gets the IoT Sitewise gateway endpoint URI.
   * @param machineIp The endpoint machine IP
   * @param port The endpoint port
   * @returns The IoT Sitewise gateway endpoint URI
   */
  public getEndpointUri(machineIp: string, port?: number) {
    const endpointPort = port ? `:${port}` : '';
    return `opc.tcp://${machineIp}${endpointPort}`;
  }
}