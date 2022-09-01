// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockAwsGreengrassV2 } from './mock';
import { GreengrassV2ComponentBuilder } from '../aws-handlers/greengrass-v2-component-builder';
import GreengrassV2Handler from '../aws-handlers/greengrass-v2-handler';
import {
  ComponentType,
  CreateComponentRecipeRequest,
  CreateDeploymentRequest
} from '../types/greengrass-v2-handler-types';
import { MachineProtocol } from '../types/solution-common-types';
import * as utils from '../utils';

const sleepSpy = jest.spyOn(utils, 'sleep');
const mockValues = {
  area: 'area',
  componentArn: 'arn:of:greengrass:component',
  componentName: 'mock-component',
  connectionName: 'mock-connection',
  deploymentId: 'mock-deployment-id',
  iotThingArn: 'arn:of:iot:thing',
  machineName: 'machine',
  logLevel: undefined,
  nextToken: 'next-token',
  process: 'process',
  siteName: 'site',
  protocol: MachineProtocol.OPCDA
};

describe('Unit tests of createComponent() function', () => {
  const params: CreateComponentRecipeRequest = {
    area: mockValues.area,
    componentType: ComponentType.COLLECTOR,
    componentVersion: '1.0.0',
    connectionName: mockValues.connectionName,
    machineName: mockValues.machineName,
    logLevel: mockValues.logLevel,
    process: mockValues.process,
    siteName: mockValues.siteName
  };

  beforeEach(() => {
    mockAwsGreengrassV2.createComponentVersion.mockReset();
    sleepSpy.mockReset();
  });

  test('Test success to create a collector component', async () => {
    params.protocol = mockValues.protocol;
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          arn: mockValues.componentArn,
          componentName: recipe.ComponentName
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.createComponent(params);

    expect(response).toEqual({
      arn: mockValues.componentArn,
      componentName: recipe.ComponentName
    });
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test success to create a publisher component for OPC DA', async () => {
    params.componentType = ComponentType.PUBLISHER;
    params.protocol = MachineProtocol.OPCDA;
    params.sendDataToIoTSiteWise = true;
    params.sendDataToIoTTopic = false;
    params.sendDataToKinesisStreams = true;
    params.sendDataToTimestream = false;

    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          arn: mockValues.componentArn,
          componentName: recipe.ComponentName
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.createComponent(params);

    expect(response).toEqual({
      arn: mockValues.componentArn,
      componentName: recipe.ComponentName
    });
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test success to create a publisher component for OPC UA', async () => {
    params.protocol = MachineProtocol.OPCUA;
    params.sendDataToIoTSiteWise = false;
    params.sendDataToIoTTopic = true;
    params.sendDataToKinesisStreams = false;
    params.sendDataToTimestream = true;

    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          arn: mockValues.componentArn,
          componentName: recipe.ComponentName
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.createComponent(params);

    expect(response).toEqual({
      arn: mockValues.componentArn,
      componentName: recipe.ComponentName
    });
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test success to create a collector component within retry number when TooManyRequestsException happens', async () => {
    const retryNumber = 2;
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.reject({ code: 'TooManyRequestsException' });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            arn: mockValues.componentArn,
            componentName: recipe.ComponentName
          });
        }
      }));
    sleepSpy.mockResolvedValue(undefined);

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.createComponent(params);

    expect(response).toEqual({
      arn: mockValues.componentArn,
      componentName: recipe.ComponentName
    });
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(retryNumber);
    for (let i = 1; i <= retryNumber; i++) {
      expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenNthCalledWith(i, {
        inlineRecipe: Buffer.from(JSON.stringify(recipe))
      });
    }
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(5);
  });

  test('Test failure to create a collector component when it exceeds retry number when TooManyRequestsException happens', async () => {
    const retryNumber = 5;
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementation(() => ({
      promise() {
        return Promise.reject({ code: 'TooManyRequestsException' });
      }
    }));
    sleepSpy.mockResolvedValue(undefined);

    const greengrassV2Handler = new GreengrassV2Handler();
    await expect(greengrassV2Handler.createComponent(params)).rejects.toEqual({ code: 'TooManyRequestsException' });

    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(retryNumber);
    for (let i = 1; i <= retryNumber; i++) {
      expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenNthCalledWith(i, {
        inlineRecipe: Buffer.from(JSON.stringify(recipe))
      });
    }
    expect(sleepSpy).toHaveBeenCalledTimes(4);
    for (let i = 1; i <= 4; i++) {
      expect(sleepSpy).toHaveBeenNthCalledWith(i, 5 * i);
    }
  });

  test('Test failure to create a collector component when error code is not TooManyRequestsException', async () => {
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject({ code: 'DifferentError' });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await expect(greengrassV2Handler.createComponent(params)).rejects.toEqual({ code: 'DifferentError' });

    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test failure to create a collector component when error is undefined', async () => {
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject();
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await expect(greengrassV2Handler.createComponent(params)).rejects.toEqual(undefined);

    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('Test failure to create a collector component when other error happens', async () => {
    const recipe = GreengrassV2ComponentBuilder.createRecipe(params);

    mockAwsGreengrassV2.createComponentVersion.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await expect(greengrassV2Handler.createComponent(params)).rejects.toEqual('Failure');

    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createComponentVersion).toHaveBeenCalledWith({
      inlineRecipe: Buffer.from(JSON.stringify(recipe))
    });
    expect(sleepSpy).not.toHaveBeenCalled();
  });
});

describe('Unit tests of deleteComponent() function', () => {
  beforeEach(() => {
    mockAwsGreengrassV2.deleteComponent.mockReset();
    mockAwsGreengrassV2.listComponents.mockReset();
  });

  test('Test success to delete a component', async () => {
    mockAwsGreengrassV2.deleteComponent.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    mockAwsGreengrassV2.listComponents.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          components: [
            {
              componentName: mockValues.componentName,
              latestVersion: {
                arn: mockValues.componentArn
              }
            }
          ]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await greengrassV2Handler.deleteComponent(mockValues.componentName);

    expect(mockAwsGreengrassV2.deleteComponent).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.deleteComponent).toHaveBeenCalledWith({
      arn: mockValues.componentArn
    });
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenCalledWith({
      scope: 'PRIVATE'
    });
  });

  test('Test success to delete a component after list components iteration', async () => {
    mockAwsGreengrassV2.deleteComponent.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));
    mockAwsGreengrassV2.listComponents
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            components: [
              {
                componentName: 'you-need-to-search-next',
                latestVersion: {
                  arn: 'arn:of:greengrass:component:for:next:search'
                }
              }
            ],
            nextToken: mockValues.nextToken
          });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            components: [
              {
                componentName: mockValues.componentName,
                latestVersion: {
                  arn: mockValues.componentArn
                }
              }
            ]
          });
        }
      }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await greengrassV2Handler.deleteComponent(mockValues.componentName);

    expect(mockAwsGreengrassV2.deleteComponent).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.deleteComponent).toHaveBeenCalledWith({
      arn: mockValues.componentArn
    });
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenCalledTimes(2);
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenNthCalledWith(1, {
      scope: 'PRIVATE'
    });
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenNthCalledWith(2, {
      scope: 'PRIVATE',
      nextToken: mockValues.nextToken
    });
  });

  test('Test not delete a component when the component does not exist', async () => {
    mockAwsGreengrassV2.listComponents.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          components: [
            {
              componentName: 'you-do-not-have-component',
              latestVersion: {
                arn: 'arn:of:greengrass:component:for:nothing'
              }
            }
          ]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await greengrassV2Handler.deleteComponent(mockValues.componentName);

    expect(mockAwsGreengrassV2.deleteComponent).not.toHaveBeenCalled();
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listComponents).toHaveBeenCalledWith({
      scope: 'PRIVATE'
    });
  });
});

describe('Unit tests of createDeployment() function', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAwsGreengrassV2.createDeployment.mockReset();
    mockAwsGreengrassV2.getDeployment.mockReset();
    mockAwsGreengrassV2.listDeployments.mockReset();
  });

  test('Test success to create a deployment for connection delete', async () => {
    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.getDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          components: {
            [mockValues.componentName]: {}
          }
        });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: [{ deploymentId: mockValues.deploymentId }]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      deletedComponents: [mockValues.componentName],
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {}
    });
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledWith({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });

  test('Test success to create a deployment for connection update', async () => {
    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.getDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          components: {
            [mockValues.componentName]: {}
          }
        });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: [{ deploymentId: mockValues.deploymentId }]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      updatedComponents: {
        [mockValues.componentName]: JSON.stringify({ newKey: 'newValue' })
      },
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {
        [mockValues.componentName]: {
          configurationUpdate: {
            merge: JSON.stringify({ newKey: 'newValue' })
          }
        }
      }
    });
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledWith({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });

  test('Test success to create a deployment for connection create for the first time with the default component version', async () => {
    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: []
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      newComponents: [mockValues.componentName],
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {
        [mockValues.componentName]: {
          componentVersion: '1.0.0'
        }
      }
    });
    expect(mockAwsGreengrassV2.getDeployment).not.toHaveBeenCalled();
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });

  test('Test success to create a deployment for connection create for the first time with the default component version and the deploymentId is null', async () => {
    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: [{ deploymentId: null }]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      newComponents: [mockValues.componentName],
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {
        [mockValues.componentName]: {
          componentVersion: '1.0.0'
        }
      }
    });
    expect(mockAwsGreengrassV2.getDeployment).not.toHaveBeenCalled();
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });

  test('Test success to create a deployment for connection create for the first time with the specific component version', async () => {
    process.env.COMPONENT_VERSION = '3.0.0';

    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: []
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      newComponents: [mockValues.componentName],
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {
        [mockValues.componentName]: {
          componentVersion: process.env.COMPONENT_VERSION
        }
      }
    });
    expect(mockAwsGreengrassV2.getDeployment).not.toHaveBeenCalled();
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });

  test('Test success to create a deployment for connection create with existing deployment', async () => {
    mockAwsGreengrassV2.createDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ deploymentId: mockValues.deploymentId });
      }
    }));
    mockAwsGreengrassV2.getDeployment.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          components: {
            'existing-component': {}
          }
        });
      }
    }));
    mockAwsGreengrassV2.listDeployments.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          deployments: [{ deploymentId: mockValues.deploymentId }]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const params: CreateDeploymentRequest = {
      iotThingArn: mockValues.iotThingArn,
      newComponents: [mockValues.componentName],
      secretManagement: []
    };
    const response = await greengrassV2Handler.createDeployment(params);

    expect(response).toEqual({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.createDeployment).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn,
      components: {
        'existing-component': {},
        [mockValues.componentName]: {
          componentVersion: process.env.COMPONENT_VERSION
        }
      }
    });
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.getDeployment).toHaveBeenCalledWith({
      deploymentId: mockValues.deploymentId
    });
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listDeployments).toHaveBeenCalledWith({
      targetArn: mockValues.iotThingArn
    });
  });
});

describe('Unit tests of listGreengrassCoreDevices() function', () => {
  const coreDevice = {
    coreDeviceThingName: 'mock-core-device',
    status: 'HEALTHY'
  };

  beforeEach(() => mockAwsGreengrassV2.listCoreDevices.mockReset());

  test('Test success to get Greengrass core devices', async () => {
    mockAwsGreengrassV2.listCoreDevices.mockImplementation(() => ({
      promise() {
        return Promise.resolve({
          coreDevices: [coreDevice]
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.listGreengrassCoreDevices();

    expect(response).toEqual({ greengrassCoreDevices: [coreDevice] });
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenCalledWith({});
  });

  test('Test success to get Greengrass core devices when next token exists', async () => {
    mockAwsGreengrassV2.listCoreDevices
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            coreDevices: [coreDevice],
            nextToken: 'mock-nextToken'
          });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({
            coreDevices: [coreDevice]
          });
        }
      }));

    const greengrassV2Handler = new GreengrassV2Handler();
    const response = await greengrassV2Handler.listGreengrassCoreDevices();

    expect(response).toEqual({ greengrassCoreDevices: [coreDevice, coreDevice] });
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenCalledTimes(2);
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenNthCalledWith(1, {});
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenNthCalledWith(2, { nextToken: 'mock-nextToken' });
  });

  test('Failed to get Greengrass core devices', async () => {
    mockAwsGreengrassV2.listCoreDevices.mockImplementation(() => ({
      promise() {
        return Promise.reject('Error');
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();

    await expect(greengrassV2Handler.listGreengrassCoreDevices()).rejects.toEqual('Error');
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.listCoreDevices).toHaveBeenCalledWith({});
  });
});

describe('Unit tests of deleteGreengrassCoreDevice() function', () => {
  const coreDeviceThingName = 'mock-core-device';

  beforeEach(() => mockAwsGreengrassV2.deleteCoreDevice.mockReset());

  test('Test success to delete Greengrass core device', async () => {
    mockAwsGreengrassV2.deleteCoreDevice.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    await greengrassV2Handler.deleteGreengrassCoreDevice(coreDeviceThingName);

    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledWith({ coreDeviceThingName });
  });

  test('Test success to delete Greengrass core device when ResourceNotFoundException happens', async () => {
    mockAwsGreengrassV2.deleteCoreDevice.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject({
          code: 'ResourceNotFoundException'
        });
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();
    expect(async () => await greengrassV2Handler.deleteGreengrassCoreDevice(coreDeviceThingName)).not.toThrow();

    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledWith({ coreDeviceThingName });
  });

  test('Test failure to delete Greengrass core device', async () => {
    mockAwsGreengrassV2.deleteCoreDevice.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Error');
      }
    }));

    const greengrassV2Handler = new GreengrassV2Handler();

    await expect(greengrassV2Handler.deleteGreengrassCoreDevice(coreDeviceThingName)).rejects.toEqual('Error');
    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledTimes(1);
    expect(mockAwsGreengrassV2.deleteCoreDevice).toHaveBeenCalledWith({ coreDeviceThingName });
  });
});
