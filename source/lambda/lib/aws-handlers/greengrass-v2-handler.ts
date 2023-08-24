// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import GreengrassV2, {
  ComponentDeploymentSpecifications,
  CreateComponentVersionResponse,
  CreateDeploymentResponse,
  GetComponentRequest,
  GetComponentResponse
} from 'aws-sdk/clients/greengrassv2';
import { GreengrassV2ComponentBuilder } from './greengrass-v2-component-builder';
import Logger, { LoggingLevel } from '../logger';
import {
  CreateComponentRecipeRequest,
  CreateDeploymentRequest,
  ListGreengrassCoreDevicesResponse,
  GreengrassCoreDeviceItem,
  SecretManagement
} from '../types/greengrass-v2-handler-types';
import { getAwsSdkOptions, isValidVersion, sleep } from '../utils';
import { ConnectionControl } from '../types/solution-common-types';

const { LOGGING_LEVEL } = process.env;

const greengrassV2 = new GreengrassV2(getAwsSdkOptions());
const logger = new Logger('GreengrassV2Handler', LOGGING_LEVEL);

export default class GreengrassV2Handler {
  private componentVersion: string;

  constructor() {
    const { COMPONENT_VERSION } = process.env;

    if (isValidVersion(COMPONENT_VERSION)) {
      this.componentVersion = COMPONENT_VERSION;
    } else {
      this.componentVersion = '1.0.0';
    }
  }

  /**
   * Creates a Greengrass v2 component version.
   * @param params The Greengrass v2 component creation parameter
   * @returns The Greengrass v2 component creation response
   */
  public async createComponent(params: CreateComponentRecipeRequest): Promise<CreateComponentVersionResponse> {
    logger.log(LoggingLevel.DEBUG, `Creating a component: ${JSON.stringify(params)}`);

    params = {
      ...params,
      componentVersion: this.componentVersion
    };

    let retryNumber = 5;
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);
    const componentParams: GreengrassV2.CreateComponentVersionRequest = {
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    };
    let createComponentVersionResponse: CreateComponentVersionResponse;

    while (retryNumber > 0) {
      try {
        createComponentVersionResponse = await greengrassV2.createComponentVersion(componentParams).promise();
        break;
      } catch (error) {
        if (--retryNumber === 0 || error?.code !== 'TooManyRequestsException') {
          throw error;
        }

        await sleep(5 * (5 - retryNumber));
      }
    }

    return createComponentVersionResponse;
  }

  /**
   * Deletes a Greengrass v2 component version.
   * @param componentName The Greengrass v2 component name
   */
  public async deleteComponent(componentName: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting a component: ${componentName}`);

    const versionArn = await this.findComponentArn(componentName);

    if (versionArn) {
      await greengrassV2.deleteComponent({ arn: versionArn }).promise();
    }
  }

  /**
   *
   * @param componentName the name of the public component
   * @returns GetComponentResponse
   */
  public async getPublicComponent(componentName: string): Promise<GetComponentResponse> {
    const versionArn = await this.findPublicComponentArn(componentName);

    const getComponentRequest: GetComponentRequest = {
      arn: versionArn,
      recipeOutputFormat: 'JSON'
    };
    return await greengrassV2.getComponent(getComponentRequest).promise();
  }

  /**
   * Finds the Greengrass v2 component latest version ARN.
   * @param componentName The Greengrass v2 component name
   * @returns The Greengrass v2 component latest version ARN
   */
  private async findComponentArn(componentName: string): Promise<string> {
    logger.log(LoggingLevel.DEBUG, `Finding component ARN: ${componentName}`);

    const params: GreengrassV2.ListComponentsRequest = { scope: 'PRIVATE' };

    do {
      const { components, nextToken } = await greengrassV2.listComponents({ ...params }).promise();
      const component = components.find(c => c.componentName === componentName);

      if (component) {
        return component.latestVersion.arn;
      }

      params.nextToken = nextToken;
    } while (params.nextToken);

    return undefined;
  }

  /**
   * Finds the Greengrass v2 public component latest version ARN.
   * @param componentName The Greengrass v2 component name
   * @returns The Greengrass v2 component latest version ARN
   */
  private async findPublicComponentArn(componentName: string): Promise<string> {
    logger.log(LoggingLevel.DEBUG, `Finding public component ARN: ${componentName}`);

    const params: GreengrassV2.ListComponentsRequest = { scope: 'PUBLIC' };

    do {
      const { components, nextToken } = await greengrassV2.listComponents({ ...params }).promise();
      const component = components.find(c => c.componentName === componentName);

      if (component) {
        return component.latestVersion.arn;
      }

      params.nextToken = nextToken;
    } while (params.nextToken);

    return undefined;
  }

  /**
   * Creates a Greengrass v2 deployment.
   * 1. It retrieves the list of deployments of the IoT thing. By default, it only returns the latest one.
   * 2. If there is a deployment, it gets the deployment.
   * 3. From the deployment, it gets the current components.
   * 4. It deletes/adds/updates components of the deployment and deploys a new deployment.
   * @param params The Greengrass v2 new components, deleted components, and updated components for a new deployment
   * @returns The Greengrass v2 deployment response
   */
  public async createDeployment(params: CreateDeploymentRequest): Promise<CreateDeploymentResponse> {
    logger.log(LoggingLevel.DEBUG, `Creating deployment: ${JSON.stringify(params)}`);

    const {
      iotThingArn,
      newComponents = [],
      deletedComponents = [],
      updatedComponents = {},
      secretManagement = []
    } = params;
    const { deployments } = await greengrassV2.listDeployments({ targetArn: iotThingArn }).promise();
    let deploymentComponents: ComponentDeploymentSpecifications = {};

    if (deployments.length > 0 && deployments[0].deploymentId) {
      const deploymentId = deployments[0].deploymentId;
      const deployment = await this.getDeployment(deploymentId);
      deploymentComponents = deployment.components;
    }

    const hasRemainingComponentsAfterUpdate = this.determineIfAnyCustomComponentsRemaining(
      deploymentComponents,
      newComponents,
      deletedComponents
    );

    if (hasRemainingComponentsAfterUpdate) {
      //If secrets manager already in deployment, dont re-add it. (Greengrass limits public components to a single instance per deployment)
      if (deploymentComponents['aws.greengrass.SecretManager'] == undefined) {
        deploymentComponents['aws.greengrass.SecretManager'] = {
          componentVersion: '2.1.0',
          configurationUpdate: {
            merge: JSON.stringify({
              cloudSecrets: []
            })
          }
        };
      }
    } else {
      //remove secretManager when all other components are gone
      deletedComponents.push('aws.greengrass.SecretManager');
    }

    this.addUpdateSecretConfigList(deploymentComponents, secretManagement, deletedComponents);

    for (const component of deletedComponents) {
      delete deploymentComponents[component];
    }

    for (const component of newComponents) {
      deploymentComponents[component] = {
        componentVersion: this.componentVersion
      };
    }

    for (const componentName in updatedComponents) {
      deploymentComponents[componentName].configurationUpdate = {
        merge: updatedComponents[componentName]
      };
    }

    const deploymentParams: GreengrassV2.CreateDeploymentRequest = {
      targetArn: iotThingArn,
      components: deploymentComponents
    };
    return greengrassV2.createDeployment(deploymentParams).promise();
  }

  private addUpdateSecretConfigList(
    deploymentComponents: GreengrassV2.ComponentDeploymentSpecifications,
    secretManagement: SecretManagement[],
    deletedComponents: string[]
  ) {
    let secretConfigList = [];
    if (deploymentComponents['aws.greengrass.SecretManager'] != undefined) {
      const configUpdate = deploymentComponents['aws.greengrass.SecretManager'].configurationUpdate;
      if (configUpdate != undefined && configUpdate.merge != undefined) {
        const existingSecretConfig = JSON.parse(configUpdate.merge);

        secretConfigList = existingSecretConfig['cloudSecrets'];
      }

      // TODO: this needs to be unit tested, was skipped when osi pi was implemented
      for (const secretInfo of secretManagement) {
        const secretArnIndex = secretConfigList.findIndex(x => x.arn === secretInfo.secretArn);

        //Add/Update secrets config. Uses the AWSCURRENT version stage for all secrets.
        handleSecretInfoAction(secretInfo, secretArnIndex, secretConfigList);
      }

      if (secretConfigList.length > 0) {
        const secretConfig = {
          cloudSecrets: secretConfigList
        };

        deploymentComponents['aws.greengrass.SecretManager'].configurationUpdate = {
          merge: JSON.stringify(secretConfig)
        };
      } else {
        //remove secretManager when all secrets are gone
        deletedComponents.push('aws.greengrass.SecretManager');
      }
    }
  }

  /**
   * Gets the Greengrass v2 deployment.
   * @param deploymentId The Greengrass v2 deployment ID
   * @returns The Greengrass v2 deployment
   */
  public async getDeployment(deploymentId: string): Promise<GreengrassV2.GetDeploymentResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting deployment: ${deploymentId}`);

    return greengrassV2.getDeployment({ deploymentId }).promise();
  }

  /**
   * Gets the whole Greengrass v2 core devices.
   * @returns The Greengrass v2 core devices
   */
  public async listGreengrassCoreDevices(): Promise<ListGreengrassCoreDevicesResponse> {
    logger.log(LoggingLevel.DEBUG, 'Listing Greengrass core devices');

    const greengrassCoreDevices: GreengrassCoreDeviceItem[] = [];
    let nextToken: string;

    do {
      const response = await greengrassV2.listCoreDevices({ nextToken }).promise();

      for (const coreDevice of response.coreDevices) {
        greengrassCoreDevices.push({
          coreDeviceThingName: coreDevice.coreDeviceThingName,
          status: coreDevice.status
        });
      }

      nextToken = response.nextToken;
    } while (typeof nextToken !== 'undefined' && nextToken);

    return { greengrassCoreDevices };
  }

  /**
   * Deletes a Greengrass core device from Greengrass.
   * @param coreDeviceThingName The Greengrass core device thing name
   */
  public async deleteGreengrassCoreDevice(coreDeviceThingName: string) {
    logger.log(LoggingLevel.DEBUG, `Deleting a Greengrass core device: ${coreDeviceThingName}`);

    try {
      await greengrassV2.deleteCoreDevice({ coreDeviceThingName }).promise();
    } catch (error) {
      /**
       * When user hasn't created Greengrass core device, it throws `ResourceNotFoundException`.
       * In order to prevent in case the Greengrass core device doesn't exist,
       * it only throws an error when other the error happens.
       */
      if (error.code !== 'ResourceNotFoundException') throw error;
    }
  }

  /**
   * Check if any non-excluded components will exist after deploying
   * @param existingComponents existing deployed components
   * @param newComponents new components to be deployed
   * @param deletedComponents components to be deleted
   * @returns true if there will be remaining deployment components, otherwise false
   */
  private determineIfAnyCustomComponentsRemaining(
    existingComponents: ComponentDeploymentSpecifications,
    newComponents: string[],
    deletedComponents: string[]
  ) {
    let componentCount = Object.keys(existingComponents).length;

    if (existingComponents['aws.greengrass.SecretManager'] != undefined) {
      componentCount--;
    }

    componentCount += newComponents.length;
    componentCount -= deletedComponents.length;

    return componentCount > 0;
  }
}

/**
 *
 * @param secretInfo
 * @param secretArnIndex
 * @param secretConfigList
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleSecretInfoAction(secretInfo: SecretManagement, secretArnIndex: number, secretConfigList: any[]) {
  switch (secretInfo.action) {
    case ConnectionControl.DEPLOY:
    case ConnectionControl.UPDATE:
      if (secretArnIndex < 0) {
        secretConfigList.push({
          arn: secretInfo.secretArn,
          labels: ['AWSCURRENT']
        });
      } else {
        if (secretConfigList[secretArnIndex]['labels'] == undefined) {
          secretConfigList[secretArnIndex]['labels'] = ['AWSCURRENT'];
        } else {
          //workaround for GreenGrass secret caching to force update to latest version on change
          secretConfigList[secretArnIndex]['labels'].push('AWSCURRENT');
        }
      }
      break;
    case ConnectionControl.DELETE:
      if (secretArnIndex >= 0) {
        secretConfigList.splice(secretArnIndex, 1);
      }
      break;
    default:
      break;
  }
}
