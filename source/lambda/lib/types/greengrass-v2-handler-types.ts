// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionControl, ConnectionDefinition, MachineProtocol } from './solution-common-types';
import { ComponentDependencyType, CoreDeviceStatus } from 'aws-sdk/clients/greengrassv2';
export { DeploymentStatus } from 'aws-sdk/clients/greengrassv2';

type ComponentRecipeFormatVersion = '2020-01-25';
type RecipeComponentType = 'aws.greengrass.generic';
type ComponentArtifactUnarchiveType = 'ZIP' | 'NONE';

export enum ComponentType {
  COLLECTOR,
  PUBLISHER
}

export interface CreateComponentRecipeRequest {
  area: string;
  componentType: ComponentType;
  connectionName: string;
  machineName: string;
  process: string;
  siteName: string;
  componentVersion?: string;
  protocol?: MachineProtocol;
  sendDataToIoTSiteWise?: boolean;
  sendDataToIoTTopic?: boolean;
  sendDataToKinesisStreams?: boolean;
  sendDataToTimestream?: boolean;
}

/**
 * The Machine to Cloud Connectivity Framework solution only uses certain configurations of the recipe.
 * For more information, visit the AWS IoT Greengrass v2 developer guide.
 * {@link https://docs.aws.amazon.com/greengrass/v2/developerguide/component-recipe-reference.html}.
 */
export interface CreateComponentRecipeResponse {
  RecipeFormatVersion: ComponentRecipeFormatVersion;
  ComponentName: string;
  ComponentVersion: string;
  ComponentType: RecipeComponentType;
  ComponentDescription: string;
  ComponentConfiguration: ComponentConfiguration;
  ComponentDependencies: Record<string, ComponentDependency>;
  Manifests: ComponentManifest[];
  Lifecycle: Record<string, never>;
}

interface ComponentConfiguration {
  DefaultConfiguration: ComponentDefaultConfiguration;
}

interface ComponentDefaultConfiguration {
  accessControl: Record<string, ComponentAccessControl>;
  connectionMetadata: ComponentConnectionMetadata;
}

interface ComponentAccessControl {
  [key: string]: {
    policyDescription: string;
    operations: string[];
    resources: string[];
  };
}

export interface ComponentConnectionMetadata {
  area: string;
  connectionName: string;
  machineName: string;
  process: string;
  siteName: string;
  streamName: string;
  sendDataToIoTTopic?: string;
  sendDataToIoTSiteWise?: string;
  sendDataToKinesisStreams?: string;
  sendDataToTimestream?: string;
}

interface ComponentManifest {
  Platform: {
    os: string;
  };
  Name: string;
  Lifecycle: {
    Setenv: Record<string, string>;
    Install: string;
    Run: string;
    Shutdown?: string;
  };
  Artifacts: ComponentArtifact[];
}

interface ComponentArtifact {
  Uri: string;
  Algorithm: string;
  Unarchive: ComponentArtifactUnarchiveType;
}

export interface ComponentDependency {
  VersionRequirement: string;
  DependencyType: ComponentDependencyType;
}

export interface CreateDeploymentRequest {
  iotThingArn: string;
  deletedComponents?: string[];
  newComponents?: string[];
  updatedComponents?: Record<string, string>;
}

export interface PostDeploymentRequest {
  connectionDefinition: ConnectionDefinition;
  futureStatus: ConnectionControl;
}

export interface GreengrassCoreDeviceItem {
  coreDeviceThingName: string;
  status: CoreDeviceStatus;
}

export interface ListGreengrassCoreDevicesResponse {
  greengrassCoreDevices: GreengrassCoreDeviceItem[];
}
