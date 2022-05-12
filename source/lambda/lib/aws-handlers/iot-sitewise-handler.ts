// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import IotSitewise from 'aws-sdk/clients/iotsitewise';
import { LambdaError } from '../errors';
import Logger, { LoggingLevel } from '../logger';
import {
  AddGatewayCapacityConfigurationRequest,
  CapabilityConfigurationSource,
  GatewayIdAndConfiguration,
  GatewayIdAndServerName,
  GatewayIdAndSource,
  GetDefaultSourceRequest,
  ListGateway,
  ListGatewayResponse
} from '../types/iot-sitewise-handler-types';
import { getAwsSdkOptions } from '../utils';

type ConfigurationType = CapabilityConfigurationSource[] | undefined;

const { LOGGING_LEVEL } = process.env;
const iotSiteWise = new IotSitewise(getAwsSdkOptions());
const logger = new Logger('IoTSiteWiseHandler', LOGGING_LEVEL);

export default class IoTSiteWiseHandler {
  private readonly opcUaNamespace: string;

  constructor() {
    /**
     * {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/IoTSiteWise.html#describeGatewayCapabilityConfiguration-property}
     * The OPC UA capability configuration has the namespace `iotsitewise:opcuacollector:version`, where `version` is a number such as `1`.
     * Since the solution supports Greengrass v2, the version is `2`.
     */
    this.opcUaNamespace = 'iotsitewise:opcuacollector:2';
  }

  /**
   * Creates a Greengrass v2 IoT SiteWise gateway.
   * @param name The name of gateway and core device thing
   * @returns The IoT SiteWise gateway creation response
   */
  public async createGreengrassV2Gateway(name: string): Promise<IotSitewise.CreateGatewayResponse> {
    const params: IotSitewise.CreateGatewayRequest = {
      gatewayName: name,
      gatewayPlatform: {
        greengrassV2: {
          coreDeviceThingName: name
        }
      }
    };
    return iotSiteWise.createGateway(params).promise();
  }

  /**
   * Deletes a Greengrass v2 IoT SiteWise gateway.
   * @param gatewayId The gateway ID
   */
  public async deleteGreengrassV2Gateway(gatewayId: string): Promise<void> {
    await iotSiteWise.deleteGateway({ gatewayId }).promise();
  }

  /**
   * Gets the default gateway configuration source for OPC UA.
   * It only returns the default configuration source.
   * The detailed configuration needs to be updated through the IoT SiteWise console.
   * @param params The parameters to get the default source including the name, endpoint, and connection name of the OPC UA connection
   * @returns The default gateway configuration source
   */
  public getDefaultSource(params: GetDefaultSourceRequest): CapabilityConfigurationSource {
    const { connectionName, endpointUri, name } = params;
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
   * Gets the IoT SiteWise gateway capability configuration sources.
   * Currently, only OPC UA is supported.
   * @param gatewayId The gateway ID
   * @returns The IoT SiteWise gateway capability configuration sources
   * @throws `GetGatewayCapabilityConfigurationSourcesError` when an error happens
   */
  public async getGatewayCapabilityConfigurationSources(gatewayId: string): Promise<CapabilityConfigurationSource[]> {
    const params: IotSitewise.DescribeGatewayCapabilityConfigurationRequest = {
      gatewayId,
      capabilityNamespace: this.opcUaNamespace
    };

    try {
      logger.log(LoggingLevel.DEBUG, `Getting gateway capability configuration sources, gatewayId: ${gatewayId}`);

      const response = await iotSiteWise.describeGatewayCapabilityConfiguration(params).promise();
      const configuration: { sources: ConfigurationType } = JSON.parse(response.capabilityConfiguration);

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
      if (
        error.code &&
        error.code === 'ResourceNotFoundException' &&
        error.message &&
        error.message.includes(this.opcUaNamespace)
      ) {
        return [];
      } else {
        logger.log(LoggingLevel.ERROR, '[getGatewayCapabilityConfigurationSources] Error: ', error);

        throw new LambdaError({
          message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
          name: 'GetGatewayCapabilityConfigurationSourcesError'
        });
      }
    }
  }

  /**
   * Gets the IoT SiteWise gateway capability configuration source by the server name.
   * @param input The gateway ID and the server name
   * @returns The source of the IoT SiteWise gateway capability configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `GetGatewayCapabilityConfigurationSourceByServerNameError` when an error happens other than other LambdaError
   */
  public async getGatewayCapabilityConfigurationSourceByServerName(
    input: GatewayIdAndServerName
  ): Promise<Partial<CapabilityConfigurationSource>> {
    const { gatewayId, serverName } = input;

    try {
      logger.log(
        LoggingLevel.DEBUG,
        `Getting gateway capability configuration source by server name, serverName: ${serverName}`
      );

      const sources = await this.getGatewayCapabilityConfigurationSources(gatewayId);
      return sources.find(src => src.name === serverName) || {};
    } catch (error) {
      logger.log(
        LoggingLevel.ERROR,
        `[getGatewayCapabilityConfigurationSourceByServerName] serverName: ${serverName}, Error: `,
        error
      );

      throw new LambdaError({
        message:
          error instanceof LambdaError
            ? error.message
            : `Failed to get IoT SiteWise gateway capability configuration source for the name: ${serverName}`,
        name: error instanceof LambdaError ? error.name : 'GetGatewayCapabilityConfigurationSourceByServerNameError'
      });
    }
  }

  /**
   * Adds a source to the IoT SiteWise gateway capability configuration.
   * @param input The input parameters of adding gateway capability configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `addGatewayCapabilityConfigurationSourceError` when other error happens
   */
  public async addGatewayCapabilityConfigurationSource(input: AddGatewayCapacityConfigurationRequest): Promise<void> {
    const { connectionName, gatewayId, serverName, machineIp, port } = input;

    try {
      logger.log(
        LoggingLevel.DEBUG,
        `Adding gateway capability configuration source, input: ${JSON.stringify(input, null, 2)}`
      );

      const sources = await this.getGatewayCapabilityConfigurationSources(gatewayId);
      const endpointUri = this.getEndpointUri(machineIp, port);
      sources.push(this.getDefaultSource({ connectionName, endpointUri, name: serverName }));
      logger.log(LoggingLevel.DEBUG, `New sources to add: ${JSON.stringify({ sources }, null, 2)}`);

      const configuration = JSON.stringify({ sources });
      await this.updateGatewayCapabilityConfiguration({ gatewayId, configuration });
    } catch (error) {
      logger.log(
        LoggingLevel.ERROR,
        `[addGatewayCapabilityConfigurationSource] connectionName: ${connectionName}, Error: `,
        error
      );

      throw new LambdaError({
        message:
          error instanceof LambdaError
            ? error.message
            : `Failed to add IoT SiteWise gateway capability configuration source for the connection: ${connectionName}`,
        name: error instanceof LambdaError ? error.name : 'AddGatewayCapabilityConfigurationSourceError'
      });
    }
  }

  /**
   * Adds the source configuration to the IoT SiteWise gateway capability configuration.
   * @param input The gateway ID and the source configuration
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `AddExistingSourceToGatewayCapabilityConfigurationError` when other error happens
   */
  public async addExistingSourceToGatewayCapabilityConfiguration(input: GatewayIdAndSource): Promise<void> {
    const { gatewayId, source } = input;

    try {
      logger.log(
        LoggingLevel.DEBUG,
        `Adding existing source to gateway capability configuration, source: ${JSON.stringify(source, null, 2)}`
      );

      const sources = await this.getGatewayCapabilityConfigurationSources(gatewayId);
      sources.push(source);
      logger.log(LoggingLevel.DEBUG, `New sources to add: ${JSON.stringify({ sources }, null, 2)}`);

      const configuration = JSON.stringify({ sources });
      await this.updateGatewayCapabilityConfiguration({ gatewayId, configuration });
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[addExistingSourceToGatewayCapabilityConfiguration] Error: ', error);

      throw new LambdaError({
        message:
          error instanceof LambdaError ? error.message : 'Failed to add IoT SiteWise gateway capability configuration',
        name: error instanceof LambdaError ? error.name : 'AddExistingSourceToGatewayCapabilityConfigurationError'
      });
    }
  }

  /**
   * Deletes a source from the IoT SiteWise gateway capability configuration.
   * @param input The gateway ID and the server name to delete
   * @throws Cascaded LambdaError when LambdaError happens
   * @throws `DeleteGatewayCapabilityConfigurationSourceError` when other error happens
   */
  public async deleteGatewayCapabilityConfigurationSource(input: GatewayIdAndServerName): Promise<void> {
    const { gatewayId, serverName } = input;

    try {
      logger.log(LoggingLevel.DEBUG, `Deleting gateway capability configuration source, serverName: ${serverName}`);

      const sources = await this.getGatewayCapabilityConfigurationSources(gatewayId);
      const configuration = JSON.stringify({
        sources: sources.filter(source => source.name !== serverName)
      });
      await this.updateGatewayCapabilityConfiguration({ gatewayId, configuration });
    } catch (error) {
      logger.log(
        LoggingLevel.ERROR,
        `[deleteGatewayCapabilityConfigurationSource] serverName: ${serverName}, Error: `,
        error
      );

      throw new LambdaError({
        message:
          error instanceof LambdaError
            ? error.message
            : `Failed to delete IoT SiteWise gateway capability configuration source for the name: ${serverName}`,
        name: error instanceof LambdaError ? error.name : 'DeleteGatewayCapabilityConfigurationSourceError'
      });
    }
  }

  /**
   * Updates the IoT SiteWise gateway capability configuration.
   * @param input The IoT SiteWise gateway capability configuration and the gateway ID
   * @throws `UpdateGatewayCapabilityConfigurationError` when any error happens
   */
  public async updateGatewayCapabilityConfiguration(input: GatewayIdAndConfiguration): Promise<void> {
    const { configuration, gatewayId } = input;

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
        gatewayId: gatewayId,
        capabilityNamespace: this.opcUaNamespace,
        capabilityConfiguration: configuration
      };

      logger.log(LoggingLevel.DEBUG, `Updating gateway capability configuration: ${JSON.stringify(params, null, 2)}`);

      await iotSiteWise.updateGatewayCapabilityConfiguration(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[updateGatewayCapabilityConfiguration] Error: ', error);

      throw new LambdaError({
        message: 'Failed to update the IoT SiteWise gateway capability configuration.',
        name: 'UpdateGatewayCapabilityConfigurationError'
      });
    }
  }

  /**
   * Gets the IoT SiteWise gateway endpoint URI.
   * @param machineIp The endpoint machine IP
   * @param port The endpoint port
   * @returns The IoT SiteWise gateway endpoint URI
   */
  public getEndpointUri(machineIp: string, port?: number): string {
    const endpointPort = port ? `:${port}` : '';
    return `opc.tcp://${machineIp}${endpointPort}`;
  }

  /**
   * Gets the list of Greengrass v2 IoT SiteWise gateways.
   * @returns The list of Greengrass v2 IoT SiteWise gateways
   */
  public async listGreengrassV2Gateways(): Promise<ListGatewayResponse> {
    const siteWiseGateways: ListGateway[] = [];
    let nextToken: string;

    do {
      const response = await iotSiteWise.listGateways({ nextToken }).promise();

      for (const gateway of response.gatewaySummaries) {
        if (typeof gateway.gatewayPlatform?.greengrassV2 !== 'undefined') {
          siteWiseGateways.push({
            gatewayId: gateway.gatewayId,
            coreDeviceThingName: gateway.gatewayPlatform.greengrassV2.coreDeviceThingName
          });
        }
      }
      nextToken = response.nextToken;
    } while (typeof nextToken !== 'undefined' && nextToken);

    return { gateways: siteWiseGateways };
  }
}
