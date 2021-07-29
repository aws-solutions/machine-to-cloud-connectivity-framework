// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Greengrass from 'aws-sdk/clients/greengrass';
import { LambdaError } from './errors';
import Logger, { LoggingLevel } from './logger';
import { GreengrassHandlerTypes, ConnectionBuilderTypes } from './types';
import { getAwsSdkOptions, sleep } from './utils';

type GreengrassDefinitionVersion =
  Greengrass.Connector[]
  | Greengrass.Core[]
  | Greengrass.Device[]
  | Greengrass.Function[]
  | Greengrass.Logger[]
  | Greengrass.Resource[]
  | Greengrass.Subscription[];
type GreengrassCreateDefinitionVersionResponse =
  Greengrass.CreateConnectorDefinitionVersionResponse
  | Greengrass.CreateCoreDefinitionVersionResponse
  | Greengrass.CreateDeviceDefinitionVersionResponse
  | Greengrass.CreateFunctionDefinitionVersionResponse
  | Greengrass.CreateLoggerDefinitionVersionResponse
  | Greengrass.CreateResourceDefinitionVersionResponse
  | Greengrass.CreateSubscriptionDefinitionVersionResponse;
type GreengrassCreateDefinitionResponse =
  Greengrass.CreateConnectorDefinitionResponse
  | Greengrass.CreateCoreDefinitionResponse
  | Greengrass.CreateDeviceDefinitionResponse
  | Greengrass.CreateFunctionDefinitionResponse
  | Greengrass.CreateLoggerDefinitionResponse
  | Greengrass.CreateResourceDefinitionResponse
  | Greengrass.CreateSubscriptionDefinitionResponse;

const { AWS_REGION, GREENGRASS_GROUP_ID, KINESIS_STREAM, LOGGING_LEVEL } = process.env;
const LOCAL_RESOURCE_PATH = '/m2c2/job';

const greengrass = new Greengrass(getAwsSdkOptions());
const logger = new Logger('GreengrassHandler', LOGGING_LEVEL);

/**
 * @class The Greengrass handler for Greengrass group of the solution
 * @param params The parameters of the Greengrass handler
 */
export default class GreengrassHandler {
  public readonly greengrassGroupId: string;
  private readonly hierarchy: { [key: string]: string };
  private readonly connectionName: string;
  private readonly protocol: ConnectionBuilderTypes.MachineProtocol;
  private readonly sendDataTo: { [key: string]: boolean };

  constructor(params: GreengrassHandlerTypes.ConstructorParameters) {
    logger.log(LoggingLevel.VERBOSE, `Creating GreengrassHandler: ${JSON.stringify(params, null, 2)}`);

    this.greengrassGroupId = params.greengrassId || GREENGRASS_GROUP_ID;
    logger.log(LoggingLevel.VERBOSE, `Greengrass group ID: ${this.greengrassGroupId}`);

    if (!this.greengrassGroupId) {
      throw new LambdaError({
        message: 'Greengrass group ID not found.',
        name: GreengrassHandlerTypes.ErrorTypes.GREENGRASS_GROUP_NOT_FOUND_ERROR,
        statusCode: 400
      });
    }

    this.connectionName = params.connectionName;
    this.protocol = params.protocol;
    this.hierarchy = {
      area: params.area,
      machineName: params.machineName,
      process: params.process,
      siteName: params.siteName
    };
    this.sendDataTo = {
      iotSiteWise: params.sendDataToIoTSitewise,
      iotTopic: params.sendDataToIoTTopic,
      kinesisDataStreams: params.sendDataToKinesisDataStreams
    };
  }

  /**
   * Gets the solution Greengrass default definitions.
   * @param lambdaFunctionAliasArn The Lambda function ARN
   * @returns The solution Greengrass default definitions
   */
  public getSolutionGreengrassDefaultDefinitions(input: GreengrassHandlerTypes.DefaultDefinitionsRequest): GreengrassHandlerTypes.DefaultDefinitionResponse {
    logger.log(LoggingLevel.DEBUG, `Getting solution greengrass default definitions: ${JSON.stringify(input, null, 2)}`);

    const functions: any[] = [{
      FunctionArn: 'arn:aws:lambda:::function:GGStreamManager:1',
      FunctionConfiguration: {
        MemorySize: 4194304,
        Pinned: true,
        Timeout: 3
      },
      Id: 'StreamManager'
    }];
    const subscriptions: any[] = [];

    // If the Lambda function alias ARN is not provided, it should be deleting the connection.
    if (input.collectorLambdaFunctionAliasArn) {
      functions.push({
        FunctionArn: input.collectorLambdaFunctionAliasArn,
        FunctionConfiguration: {
          EncodingType: 'json',
          Environment: {
            AccessSysfs: false,
            ResourceAccessPolicies: [
              {
                Permission: 'rw',
                ResourceId: 'M2C2LocalResourceId'
              },
            ],
            Variables: {
              AREA: this.hierarchy.area,
              CONNECTION_GG_STREAM_NAME: `m2c2_${this.connectionName}_stream`,
              MACHINE_NAME: this.hierarchy.machineName,
              PROCESS: this.hierarchy.process,
              SITE_NAME: this.hierarchy.siteName
            }
          },
          Executable: `m2c2_${this.protocol}_connector.function_handler`,
          MemorySize: 128000,
          Pinned: true,
          Timeout: 10
        },
        Id: `Function-id-${this.connectionName}-collector`
      });

      subscriptions.push({
        Id: `${this.connectionName}-to-cloud`,
        Source: 'cloud',
        Subject: `m2c2/job/${this.connectionName}`,
        Target: input.collectorLambdaFunctionAliasArn,
      });

      subscriptions.push({
        Id: `${this.connectionName}-from-collector`,
        Source: input.collectorLambdaFunctionAliasArn,
        Subject: `m2c2/#`,
        Target: 'cloud'
      });
    }

    if (input.publisherLambdaFunctionAliasArn) {
      functions.push({
        FunctionArn: input.publisherLambdaFunctionAliasArn,
        FunctionConfiguration: {
          EncodingType: 'json',
          Environment: {
            AccessSysfs: false,
            ResourceAccessPolicies: [
              {
                Permission: 'rw',
                ResourceId: 'M2C2LocalResourceId'
              },
            ],
            Variables: {
              AREA: this.hierarchy.area,
              CONNECTION_GG_STREAM_NAME: `m2c2_${this.connectionName}_stream`,
              CONNECTION_NAME: this.connectionName,
              KINESIS_STREAM_NAME: KINESIS_STREAM,
              MACHINE_NAME: this.hierarchy.machineName,
              PROCESS: this.hierarchy.process,
              PROTOCOL: this.protocol,
              SEND_TO_IOT_TOPIC: this.sendDataTo.iotTopic ? 'Yes' : undefined,
              SEND_TO_KINESIS_STREAM: this.sendDataTo.kinesisDataStreams ? 'Yes' : undefined,
              SEND_TO_SITEWISE: this.sendDataTo.iotSiteWise ? 'Yes' : undefined,
              SITE_NAME: this.hierarchy.siteName
            }
          },
          Executable: `m2c2_publisher.function_handler`,
          MemorySize: 128000,
          Pinned: true,
          Timeout: 10
        },
        Id: `Function-id-${this.connectionName}-publisher`
      });

      subscriptions.push({
        Id: `${this.connectionName}-from-publisher`,
        Source: input.publisherLambdaFunctionAliasArn,
        Subject: `m2c2/#`,
        Target: 'cloud'
      });
    }

    return {
      Connector: [{
        Id: 'M2C2SitewiseConnector',
        ConnectorArn: `arn:aws:greengrass:${AWS_REGION}::/connectors/IoTSiteWise/versions/11`
      }],
      Core: [],
      Device: [],
      Function: functions,
      Logger: [
        {
          Id: 'M2C2GreengrassFileSystemLogger',
          Type: 'FileSystem',
          Component: 'GreengrassSystem',
          Level: 'INFO',
          Space: 128
        },
        {
          Id: 'GreengrasAWSCloudWatchLogger',
          Type: 'AWSCloudWatch',
          Component: 'GreengrassSystem',
          Level: 'WARN'
        },
        {
          Id: 'M2C2LambdaFileSystemLogger',
          Type: 'FileSystem',
          Component: 'Lambda',
          Level: 'INFO',
          Space: 128
        },
        {
          Id: 'M2C2LambdaAWSCloudWatchLogger',
          Type: 'AWSCloudWatch',
          Component: 'Lambda',
          Level: 'WARN'
        }
      ],
      Resource: [{
        Name: 'M2C2LocalResource',
        Id: 'M2C2LocalResourceId',
        ResourceDataContainer: {
          LocalVolumeResourceData: {
            SourcePath: LOCAL_RESOURCE_PATH,
            DestinationPath: LOCAL_RESOURCE_PATH,
            GroupOwnerSetting: {
              AutoAddGroupOwner: true
            }
          }
        }
      }],
      Subscription: subscriptions
    };
  }

  /**
   * Gets the Greengrass group latest version.
   * If there's no Greengrass group or the latest version, it will throw an error.
   * @returns The Greengrass group latest version
   * @throws `GetGreengrassGroupLatestVersionError` when any error happens
   */
  public async getGreengrassGroupLatestVersion(): Promise<Greengrass.GetGroupVersionResponse> {
    try {
      logger.log(LoggingLevel.DEBUG, 'Getting Greengrass group');
      const greengrassGroupParams: Greengrass.GetGroupRequest = { GroupId: this.greengrassGroupId };
      const greengrassGroup = await greengrass.getGroup(greengrassGroupParams).promise();

      const greengrassGroupVersionParams: Greengrass.GetGroupVersionRequest = {
        GroupId: this.greengrassGroupId,
        GroupVersionId: greengrassGroup.LatestVersion
      };

      logger.log(LoggingLevel.DEBUG, `Getting Greengrass group latest version: ${JSON.stringify(greengrassGroupVersionParams, null, 2)}`);
      return greengrass.getGroupVersion(greengrassGroupVersionParams).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[getGreengrassGroupLatestVersion] Error: ', error);

      throw new LambdaError({
        message: 'Failed to get the Greengrass group latest version.',
        name: GreengrassHandlerTypes.ErrorTypes.GET_GREENGRASS_GROUP_LATEST_VERSION_ERROR
      });
    }
  }

  /**
   * Updates the Greengrass group definition.
   * The function goes through with each Greengrass group definitions and compares with the default definitions.
   * If the latest version does not have the default definitions, it adds to the latest version to make the new definition.
   * @param input The update greengrass group definition request parameters
   * @param lambdaFunctionAliasArn The Lambda function alias ARN
   * @returns The new Greengrass definition version ARNs
   * @throws `UpdateGreengrassGroupDefinitionError` when any error happens
   */
  public async updateGreengrassGroupDefinitions(input: GreengrassHandlerTypes.UpdateGreengrassDefinitionsRequest): Promise<{ [key: string]: string | undefined }> {
    try {
      logger.log(LoggingLevel.DEBUG, `Updating Greengrass group definitions: ${JSON.stringify(input, null, 2)}`);

      const newDefinitionVersionArns: { [key: string]: string | undefined } = {};
      const { greengrassGroupVersion, publisherLambdaFunctionAliasArn, collectorLambdaFunctionAliasArn } = input;
      const solutionGreengrassDefaultDefinitions = this.getSolutionGreengrassDefaultDefinitions({
        collectorLambdaFunctionAliasArn,
        publisherLambdaFunctionAliasArn
      });
      const definitions = Array.from(Object.values(GreengrassHandlerTypes.GreengrassDefinitions));

      for (let definition of definitions) {
        const latestDefinitionVersionArn = greengrassGroupVersion.Definition[`${definition}DefinitionVersionArn`];
        let greengrassDefinitionVersion: GreengrassDefinitionVersion = [];
        let definitionId: string | undefined;
        let definitionName: string | undefined;

        logger.log(LoggingLevel.DEBUG, `definition: ${definition}, latestDefinitionVersionArn: ${latestDefinitionVersionArn}`);

        if (latestDefinitionVersionArn) {
          const greengrassDefinition = await this.findGreengrassDefinition(latestDefinitionVersionArn, definition);
          definitionId = greengrassDefinition.Id;
          definitionName = greengrassDefinition.Name;

          logger.log(LoggingLevel.DEBUG, `definitionId: ${definitionId}, definitionName: ${definitionName}`);

          if (definitionId) {
            greengrassDefinitionVersion = await this.getGreengrassDefinitionVersion(greengrassDefinition.Id, greengrassDefinition.LatestVersion, definition);
          }
        }

        // Combines the current version Greengrass definitions and the default Greengrass definitions.
        let newDefinitions: any[] = solutionGreengrassDefaultDefinitions[definition];
        this.combineDefinitions(definition as GreengrassHandlerTypes.GreengrassDefinitions, newDefinitions, greengrassDefinitionVersion);

        // Only creates a definition when `m2c2-greengrass-${definition}Definition` does not exist.
        if (!definitionName || definitionName !== `m2c2-greengrass-${definition}Definition`) {
          const newDefinition = await this.createGreengrassDefinition(definition);
          definitionId = newDefinition.Id;
        }

        const newDefinitionVersion = await this.createGreengrassDefinitionVersion(definitionId, newDefinitions, definition);
        newDefinitionVersionArns[`${definition}DefinitionVersionArn`] = newDefinitionVersion.Arn;
      }

      return newDefinitionVersionArns;
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[updateGreengrassGroupDefinitions] Error: ', error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : 'Failed to update Greengrass group definitions',
        name: error instanceof LambdaError ? error.name : GreengrassHandlerTypes.ErrorTypes.UPDATE_GREENGRASS_GROUP_DEFINITION_ERROR
      });
    }
  }

  /**
   * Finds the Greengrass definition.
   * The recursion only happens when the next token is returned and the matched version ARN hasn't been found.
   * The function uses JavaScript `Reflect`.
   * @param latestVersionArn The latest versin ARN to get from the Greengrass definitions
   * @param definition The Greengrass definition
   * @param nextToken The next token to get the list of definitions
   * @returns The Greengrass definition
   * @throws `FindGreengrassDefinitionError` when any error happens
   */
  public async findGreengrassDefinition(latestVersionArn: string, definition: string, nextToken?: string): Promise<Greengrass.DefinitionInformation> {
    try {
      logger.log(LoggingLevel.DEBUG, `Finding Greengrass definition, latestVersionArn: ${latestVersionArn}, definition: ${definition}, nextToken: ${nextToken}`);

      /**
       * This `Reflect` calls `greengrass.list{definition}Definitions(params)` based on `definition`.
       * For example, calling `greengrass.listCoreDefinitions(params)` if `definition` is `Core`.
       */
      const response = await Reflect.apply(
        greengrass[`list${definition}Definitions`],
        greengrass,
        [{ NextToken: nextToken }]
      ).promise();

      const definitionInformations: Greengrass.DefinitionInformation[] = response.Definitions.filter(
        (definitionInformation: Greengrass.DefinitionInformation) => definitionInformation.LatestVersionArn === latestVersionArn
      );

      logger.log(LoggingLevel.DEBUG, `Greengrass definitions: ${JSON.stringify(definitionInformations, null, 2)}`);

      // After filter, definition information array has items, it should have an item.
      if (definitionInformations.length > 0) {
        return definitionInformations[0];
      } else if (response.NextToken) {
        return this.findGreengrassDefinition(latestVersionArn, definition, response.NextToken);
      } else {
        return {};
      }
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[findGreengrassDefinition] latestVersionArn: ${latestVersionArn}, definition: ${definition}, Error: `, error);

      throw new LambdaError({
        message: 'Failed to find the Greengrass definition',
        name: GreengrassHandlerTypes.ErrorTypes.FIND_GREENGRASS_DEFINITION_ERROR
      });
    }
  }

  /**
   * Gets the Greengrass definition version.
   * The function uses JavaScript `Reflect`.
   * @param id The definition ID
   * @param versionId The definition version ID
   * @param definition The Greengrass definition: Connector, Core, Device, Function, Logger, Resource, Subscription
   * @returns The Greengrass definition version
   * @throws `GetGreengrassDefinitionVersionError` when any error happens
   */
  public async getGreengrassDefinitionVersion(id: string, versionId: string, definition: string): Promise<GreengrassDefinitionVersion> {
    try {
      logger.log(LoggingLevel.DEBUG, `Getting Greengrass definition version, definition: ${definition}, id: ${id}, versionId: ${versionId}`);

      /**
       * This `Reflect` calls `greengrass.get{definition}DefinitionVersion(params)` based on `definition`.
       * For example, calling `greengrass.getCoreDefinitionVersion(params)` if `definition` is `Core`.
       */
      const response = await Reflect.apply(
        greengrass[`get${definition}DefinitionVersion`],
        greengrass,
        [{ [`${definition}DefinitionId`]: id, [`${definition}DefinitionVersionId`]: versionId }]
      ).promise();

      return response.Definition[`${definition}s`];
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[getGreengrassDefinitionVersion] definition: ${definition}, definitionId: ${id}, definitionVersionId: ${versionId}, Error: `, error);

      throw new LambdaError({
        message: 'Faield to get the Greengrass definition version.',
        name: GreengrassHandlerTypes.ErrorTypes.GET_GREENGRASS_DEFINITION_VERSION_ERROR
      });
    }
  }

  /**
   * Creates a Greengrass definition. The name would be `m2c2-greengrass-${definition}Definition`.
   * The function uses JavaScript `Reflect`.
   * @param definition The Greengrass definition: Connector, Core, Device, Function, Logger, Resource, Subscription
   * @returns The response of creating a Greengrass definition
   * @throws `CreateGreengrassDefinitionError` when any error happens
   */
  public async createGreengrassDefinition(definition: string): Promise<GreengrassCreateDefinitionResponse> {
    try {
      logger.log(LoggingLevel.DEBUG, `Creating Greengrass definition, definition: ${definition}`);

      /**
       * This `Reflect` calls `greengrass.create{definition}Definition({ Name: name })` based on `definition`.
       * For example, calling `greengrass.createCoreDefinition({ Name: name })` if `definition` is `Core`.
       */
      return Reflect.apply(
        greengrass[`create${definition}Definition`],
        greengrass,
        [{ Name: `m2c2-greengrass-${definition}Definition` }]
      ).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[createGreengrassDefinition] definition: ${definition}, Error: `, error);

      throw new LambdaError({
        message: 'Failed to create a Greengrass definition.',
        name: GreengrassHandlerTypes.ErrorTypes.CREATE_GREENGRASS_DEFINITION_ERROR
      });
    }
  }

  /**
   * Creates a Greengrass definition version.
   * The function uses JavaScript `Reflect`.
   * @param id The definition ID
   * @param contents The definition contents
   * @param definition The Greengrass definition: Connector, Core, Device, Function, Logger, Resource, Subscription
   * @returns The response of creating a definition version
   * @throws `CreateGreengrassDefinitionVersionError` when any error happens
   */
  public async createGreengrassDefinitionVersion(id: string, contents: any[], definition: string): Promise<GreengrassCreateDefinitionVersionResponse> {
    try {
      logger.log(LoggingLevel.DEBUG, `Creating Greengrass definition version, definition: ${definition}, id: ${id}, contents: ${JSON.stringify(contents, null, 2)}`);

      /**
       * This `Reflect` calls `greengrass.create{definition}DefinitionVersion(params)` based on `definition`.
       * For example, calling `greengrass.createCoreDefinitionVersion(params)` if `definition` is `Core`.
       */
      return Reflect.apply(
        greengrass[`create${definition}DefinitionVersion`],
        greengrass,
        [{ [`${definition}DefinitionId`]: id, [`${definition}s`]: contents }]
      ).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, `[createGreengrassDefinitionVersion] id: ${id}, definition: ${definition}, Error: `, error);

      throw new LambdaError({
        message: 'Failed to create a Greengrass definition version.',
        name: GreengrassHandlerTypes.ErrorTypes.CREATE_GREENGRASS_DEFINITION_VERSION_ERROR
      });
    }
  }

  /**
   * Creates a Greengrass group version.
   * @returns The new Greengrass group version
   * @throws `CreateGreengrassGroupVersionError` when any error happens
   */
  public async createGreengrassGroupVersion(newDefinitionVersionArns: { [key: string]: string | undefined }): Promise<Greengrass.CreateGroupVersionResponse> {
    try {
      logger.log(LoggingLevel.DEBUG, `Creating Greengrass group version: ${JSON.stringify(newDefinitionVersionArns, null, 2)}`);

      return greengrass.createGroupVersion({
        GroupId: this.greengrassGroupId,
        ConnectorDefinitionVersionArn: newDefinitionVersionArns.ConnectorDefinitionVersionArn,
        CoreDefinitionVersionArn: newDefinitionVersionArns.CoreDefinitionVersionArn,
        DeviceDefinitionVersionArn: newDefinitionVersionArns.DeviceDefinitionVersionArn,
        FunctionDefinitionVersionArn: newDefinitionVersionArns.FunctionDefinitionVersionArn,
        LoggerDefinitionVersionArn: newDefinitionVersionArns.LoggerDefinitionVersionArn,
        ResourceDefinitionVersionArn: newDefinitionVersionArns.ResourceDefinitionVersionArn,
        SubscriptionDefinitionVersionArn: newDefinitionVersionArns.SubscriptionDefinitionVersionArn
      }).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[createGreengrassGroupVersion] Error: ', error);

      throw new LambdaError({
        message: 'Failed to create a Greengrass group version.',
        name: GreengrassHandlerTypes.ErrorTypes.CREATE_GREENGRASS_GROUP_VERSION_ERROR
      });
    }
  }

  /**
   * Creates a Greengrass group deployment. It also waits until the deployment is done.
   * @param groupVersionId The Greengrass group version ID
   * @throws `GreengrassDeploymentError` when the Greengrass group deployment fails
   * @throws `CreateGreengrassDeploymentError` when any other error happens
   */
  public async createGreengrassDeployment(groupVersionId: string): Promise<void> {
    try {
      const params: Greengrass.CreateDeploymentRequest = {
        DeploymentType: 'NewDeployment',
        GroupId: this.greengrassGroupId,
        GroupVersionId: groupVersionId
      };

      logger.log(LoggingLevel.DEBUG, `Creating Greengrass deployment, groupVersionId: ${groupVersionId}`);

      const result = await greengrass.createDeployment(params).promise();
      const deploymentId = result.DeploymentId;
      let deploymentStatus = '';
      let statusResult: Greengrass.GetDeploymentStatusResponse;

      do {
        logger.log(LoggingLevel.DEBUG, `Waiting deployment until deployment completes, deploymentStatus: ${deploymentStatus}`);

        if (deploymentStatus === 'Failure') {
          logger.log(LoggingLevel.ERROR, '[createGreengrassDeployment] The Greengrass group deployment has failed: ', statusResult.ErrorMessage);
          logger.log(LoggingLevel.ERROR, '[createGreengrassDeployment] Error details: ', statusResult.ErrorDetails);

          throw new LambdaError({
            message: 'The Greengrass group deployment has failed.',
            name: GreengrassHandlerTypes.ErrorTypes.GREENGRASS_DEPLOYMENT_ERROR
          });
        }

        const statusParams: Greengrass.GetDeploymentStatusRequest = {
          DeploymentId: deploymentId,
          GroupId: this.greengrassGroupId
        };

        statusResult = await greengrass.getDeploymentStatus(statusParams).promise();
        deploymentStatus = statusResult.DeploymentStatus;

        await sleep(10);
      } while (deploymentStatus !== 'Success');

      // Buffer for running Lambda functions in the edge deveice.
      await sleep(20);
    } catch (error) {
      if (error instanceof LambdaError) throw error;

      logger.log(LoggingLevel.ERROR, '[createGreengrassDeployment] Error: ', error);

      throw new LambdaError({
        message: 'Failed to deploy the Greengrass group.',
        name: GreengrassHandlerTypes.ErrorTypes.CREATE_GREENGRASS_DEPLOYMENT_ERROR
      });
    }
  }

  /**
   * Deletes the connection related resources from the Greengrass definitions.
   * Since the solution only adds functions and subscriptions dynamically,
   * the function only deletes the functions and subscriptions related to the connection.
   *
   * After deleting the connection related functions and subscriptions from the definitions,
   * it creates a new Greengrass group version.
   * @param greengrassGroupVersion The Greengrass group version
   * @returns The new Greengrass definition version ARNs and to-be-deleted Lambda function names
   * @throws `DeleteConnectionFromGreengrassDefinitionsError` when any error happens
   */
  public async deleteConnectionFromGreengrassDefinitions(greengrassGroupVersion: Greengrass.GetGroupVersionResponse): Promise<GreengrassHandlerTypes.DeleteConnectionFromGreengrassDefinitionResponse> {
    try {
      logger.log(LoggingLevel.DEBUG, `Deleting connection from Greengrass definitionss: ${JSON.stringify(greengrassGroupVersion, null, 2)}`);

      const newDefinitionVersionArns: { [key: string]: string | undefined } = {};
      const lambdaFunctionNames: string[] = [];

      const solutionGreengrassDefaultDefinitions = this.getSolutionGreengrassDefaultDefinitions({});
      const defitionsToDelete: GreengrassHandlerTypes.GreengrassDefinitions[] = [
        GreengrassHandlerTypes.GreengrassDefinitions.FUNCTION,
        GreengrassHandlerTypes.GreengrassDefinitions.SUBSCRIPTION
      ];

      for (let definition of defitionsToDelete) {
        const latestDefinitionVersionArn = greengrassGroupVersion.Definition[`${definition}DefinitionVersionArn`];
        const greengrassDefinition = await this.findGreengrassDefinition(latestDefinitionVersionArn, definition);
        let greengrassDefinitionVersion = await this.getGreengrassDefinitionVersion(greengrassDefinition.Id, greengrassDefinition.LatestVersion, definition);

        logger.log(LoggingLevel.DEBUG, `definition: ${definition}, latestDefinitionVersionArn: ${latestDefinitionVersionArn}`);

        if (definition === GreengrassHandlerTypes.GreengrassDefinitions.FUNCTION) {
          const lambdaFunctionIds = [
            `Function-id-${this.connectionName}-collector`,
            `Function-id-${this.connectionName}-publisher`
          ];

          // Gets the Lambda function ARNs.
          const lambdaFunctions = (<Greengrass.Function[]>greengrassDefinitionVersion)
            .filter(func => lambdaFunctionIds.includes(func.Id));

          for (let lambdaFunction of lambdaFunctions) {
            /**
             * Since Greengrass definition version has Lambda function alias ARN ending with the function name,
             * the function ARN from the Greengrass definition version can't be used directly.
             */
            lambdaFunctionNames.push(lambdaFunction.FunctionArn.split(':').pop());
          }

          // Removes the to-be-deleted funtions from the Greengrass definition version.
          greengrassDefinitionVersion = (<Greengrass.Function[]>greengrassDefinitionVersion)
            .filter(func => !(lambdaFunctionIds.includes(func.Id)));
        } else {
          const subscriptions = [
            `${this.connectionName}-to-cloud`,
            `${this.connectionName}-from-collector`,
            `${this.connectionName}-from-publisher`
          ];

          // Removes the to-be-deleted subscriptions from the Greengrass definition version.
          greengrassDefinitionVersion = (<Greengrass.Subscription[]>greengrassDefinitionVersion)
            .filter(subscription => !subscriptions.includes(subscription.Id));
        }

        // Combines the current version Greengrass definitions and the default Greengrass definitions.
        let newDefinitions: any[] = solutionGreengrassDefaultDefinitions[definition];
        this.combineDefinitions(definition, newDefinitions, greengrassDefinitionVersion);

        // Only creates a definition when `m2c2-greengrass-${definition}Definition` does not exist.
        let definitionId = greengrassDefinition.Id;
        if (!greengrassDefinition.Name || greengrassDefinition.Name !== `m2c2-greengrass-${definition}Definition`) {
          const newDefinition = await this.createGreengrassDefinition(definition);
          definitionId = newDefinition.Id;
        }

        const newDefinitionVersion = await this.createGreengrassDefinitionVersion(definitionId, newDefinitions, definition);
        newDefinitionVersionArns[`${definition}DefinitionVersionArn`] = newDefinitionVersion.Arn;
      }

      // Sets other definitions' ARN and creates a new Greengrass version
      newDefinitionVersionArns.ConnectorDefinitionVersionArn = greengrassGroupVersion.Definition.ConnectorDefinitionVersionArn;
      newDefinitionVersionArns.CoreDefinitionVersionArn = greengrassGroupVersion.Definition.CoreDefinitionVersionArn;
      newDefinitionVersionArns.DeviceDefinitionVersionArn = greengrassGroupVersion.Definition.DeviceDefinitionVersionArn;
      newDefinitionVersionArns.LoggerDefinitionVersionArn = greengrassGroupVersion.Definition.LoggerDefinitionVersionArn;
      newDefinitionVersionArns.ResourceDefinitionVersionArn = greengrassGroupVersion.Definition.ResourceDefinitionVersionArn;

      return {
        newDefinitionVersionArns,
        lambdaFunctionNames
      };
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[deleteConnectionFromGreengrassDefinitions] Error: ', error);

      throw new LambdaError({
        message: error instanceof LambdaError ? error.message : 'Failed to delete a connection completely.',
        name: error instanceof LambdaError ? error.name : GreengrassHandlerTypes.ErrorTypes.DELETE_CONNECTION_FROM_GREENGRASS_DEFINITIONS_ERROR
      });
    }
  }

  /**
   * Combines the current version Greengrass definitions and the default Greengrass definitions by filtering.
   * @param definition The Greengrass definition
   * @param newDefinitions The new definitions array
   * @param greengrassDefinitionVersion The Greengrass definition version
   */
  public combineDefinitions(definition: GreengrassHandlerTypes.GreengrassDefinitions, newDefinitions: any[], greengrassDefinitionVersion: GreengrassDefinitionVersion) {
    logger.log(LoggingLevel.DEBUG, `Combining definitions, defintion: ${definition}, newDefinitions: ${JSON.stringify(newDefinitions, null, 2)}, greengrassDefinitionVersion: ${JSON.stringify(greengrassDefinitionVersion, null, 2)}`);

    for (let definitionVersion of greengrassDefinitionVersion) {
      if (!newDefinitions.some(
        (definitionItem: any) => {
          switch (definition) {
            case GreengrassHandlerTypes.GreengrassDefinitions.CONNECTOR:
              /**
               * For the connectors, there is a possibility to see the different ID for the same connector.
               * Therefore, it checks the connector ARN instead.
               */
              return definitionItem.ConnectorArn === (definitionVersion as Greengrass.Connector).ConnectorArn;
            case GreengrassHandlerTypes.GreengrassDefinitions.FUNCTION:
              /**
               * For the functions, there is a possibility to see the different ID of the stream manager.
               * Therefore, it checks with the function ARN instead.
               */
              return definitionItem.FunctionArn === (definitionVersion as Greengrass.Function).FunctionArn;
            case GreengrassHandlerTypes.GreengrassDefinitions.LOGGER:
              /**
               * For the loggers, there is a possibility to see the different IDs for the logging definitions.
               * Therefore, it checks with type and component.
               */
              return definitionItem.Type === (definitionVersion as Greengrass.Logger).Type
                && definitionItem.Component === (definitionVersion as Greengrass.Logger).Component
            default:
              // For others, only compares the ID
              return definitionItem.Id === definitionVersion.Id;
          }
        }
      )) {
        newDefinitions.push(definitionVersion);
      }
    }

    logger.log(LoggingLevel.DEBUG, `New definitions, defintion: ${definition}, newDefinitions: ${JSON.stringify(newDefinitions, null, 2)}`);
  }

  /**
   * Resets the Greengrass deployment. It always tries force reset.
   * @throws `ResetGreengrassDeploymentError` when any error happens.
   */
  public async resetGreengrassDeployment(): Promise<void> {
    try {
      const params: Greengrass.ResetDeploymentsRequest = {
        GroupId: this.greengrassGroupId,
        Force: true
      };

      logger.log(LoggingLevel.DEBUG, `Resetting Greengrass deployment: ${JSON.stringify(params, null, 2)}`);

      await greengrass.resetDeployments(params).promise();
    } catch (error) {
      logger.log(LoggingLevel.ERROR, '[deleteConnectionFromGreengrassDefinitions] Error: ', error);

      throw new LambdaError({
        message: 'Failed to reset the Greengrass group.',
        name: GreengrassHandlerTypes.ErrorTypes.RESET_GREENGRASS_DEPLOYMENT_ERROR
      });
    }
  }
}