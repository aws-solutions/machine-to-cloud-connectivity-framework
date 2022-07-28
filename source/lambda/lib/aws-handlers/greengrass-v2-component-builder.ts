// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ComponentConnectionMetadata,
  ComponentDependency,
  ComponentType,
  CreateComponentRecipeRequest,
  CreateComponentRecipeResponse
} from '../types/greengrass-v2-handler-types';
import { MachineProtocol } from '../types/solution-common-types';

const { ARTIFACT_BUCKET, KINESIS_STREAM, TIMESTREAM_KINESIS_STREAM } = process.env;

/**
 * Python modules have same versions with /source/machine_connector/m2c2_opcda_connector/requirements.txt
 * and /source/machine_connector/m2c2_publisher/requirements.txt
 */
const PYTHON_MODULE_VERSION = {
  awsiotsdk: '1.7.1',
  backoff: '1.10.0',
  greengrasssdk: '1.6.0',
  'OpenOPC-Python3x': '1.3.1',
  Pyro4: '4.81',
  'python-dateutil': '2.8.1'
};

export class GreengrassV2ComponentBuilder {
  /**
   * Creates a Greengrass v2 component recipe based on the parameters.
   * @param params The component recipe build request parameters
   * @returns The component recipe
   */
  public static createRecipe(params: CreateComponentRecipeRequest): CreateComponentRecipeResponse {
    const { area, componentType, componentVersion, connectionName, machineName, process, protocol, siteName } = params;
    const { sendDataToIoTSiteWise, sendDataToIoTTopic, sendDataToKinesisStreams, sendDataToTimestream } = params;

    // By default, all components have the Greengrass Nucleus and stream manager as dependencies.
    const componentDependencies: Record<string, ComponentDependency> = {
      'aws.greengrass.Nucleus': {
        VersionRequirement: '=2.5.6',
        DependencyType: 'HARD'
      },
      'aws.greengrass.StreamManager': {
        VersionRequirement: '>=2.0.10 <3.0.0',
        DependencyType: 'HARD'
      }
    };
    const connectionMetadata: ComponentConnectionMetadata = {
      area,
      connectionName,
      machineName,
      process,
      siteName,
      streamName: `m2c2_${connectionName}_stream`
    };
    const componentEnvironmentVariables: Record<string, string> = {
      AREA: '{configuration:/connectionMetadata/area}',
      CONNECTION_GG_STREAM_NAME: '{configuration:/connectionMetadata/streamName}',
      CONNECTION_NAME: '{configuration:/connectionMetadata/connectionName}',
      MACHINE_NAME: '{configuration:/connectionMetadata/machineName}',
      PROCESS: '{configuration:/connectionMetadata/process}',
      SITE_NAME: '{configuration:/connectionMetadata/siteName}'
    };

    // By default, all components install `awsiotsdk`, `backoff`, `greengrasssdk`, and `python-dateutil` before running.
    const pythonPackages = ['awsiotsdk', 'backoff', 'greengrasssdk', 'python-dateutil'];

    let componentName = `m2c2-${connectionName}`;
    let topic = `m2c2/+/${connectionName}`;
    let artifact = 'm2c2_opcda_connector';

    if (componentType === ComponentType.PUBLISHER) {
      /**
       * The requirements of the publisher components are,
       * 1. publisher components need to send data to `m2c2/data/{connectionName}/#`.
       * 2. publisher components have the IoT SiteWise edge publisher as a dependency to send data to IoT SiteWise.
       * 3. publisher components have the IoT SiteWise edge collector OPC UA as a dependency when the machine protocol is OPC UA.
       * 4. publisher components have the data destination environment variables.
       */
      componentName = `${componentName}-publisher`;
      topic = `${topic}/#`;
      artifact = 'm2c2_publisher';
      componentDependencies['aws.iot.SiteWiseEdgePublisher'] = {
        VersionRequirement: '>=2.0.1 <3.0.0',
        DependencyType: 'HARD'
      };

      if (protocol === MachineProtocol.OPCUA) {
        componentDependencies['aws.iot.SiteWiseEdgeCollectorOpcua'] = {
          VersionRequirement: '>=2.0.2 <3.0.0',
          DependencyType: 'HARD'
        };
      }

      // Set the data destination metadata for the publisher component.
      connectionMetadata.sendDataToIoTTopic = sendDataToIoTTopic ? 'Yes' : '';
      connectionMetadata.sendDataToIoTSiteWise = sendDataToIoTSiteWise ? 'Yes' : '';
      connectionMetadata.sendDataToKinesisStreams = sendDataToKinesisStreams ? 'Yes' : '';
      connectionMetadata.sendDataToTimestream = sendDataToTimestream ? 'Yes' : '';

      // Set the environment variables for the publisher component.
      componentEnvironmentVariables.KINESIS_STREAM_NAME = KINESIS_STREAM;
      componentEnvironmentVariables.PROTOCOL = protocol;
      componentEnvironmentVariables.SEND_TO_IOT_TOPIC = '{configuration:/connectionMetadata/sendDataToIoTTopic}';
      componentEnvironmentVariables.SEND_TO_SITEWISE = '{configuration:/connectionMetadata/sendDataToIoTSiteWise}';
      componentEnvironmentVariables.SEND_TO_KINESIS_STREAM =
        '{configuration:/connectionMetadata/sendDataToKinesisStreams}';
      componentEnvironmentVariables.SEND_TO_TIMESTREAM = '{configuration:/connectionMetadata/sendDataToTimestream}';
      componentEnvironmentVariables.TIMESTREAM_KINESIS_STREAM = TIMESTREAM_KINESIS_STREAM;
    } else {
      /**
       * Currently, only the OPC DA collector component is supported.
       * The OPC DA collector needs to install OpenOPC and Pyro4 before running.
       */
      pythonPackages.push(...['OpenOPC-Python3x', 'Pyro4']);
    }

    const pythonPackagesInstall = pythonPackages
      .map(pythonPackage => `${pythonPackage}==${PYTHON_MODULE_VERSION[pythonPackage]}`)
      .join(' ');

    return {
      RecipeFormatVersion: '2020-01-25',
      ComponentName: componentName,
      ComponentVersion: componentVersion,
      ComponentType: 'aws.greengrass.generic',
      ComponentDescription: `M2C2 ${componentName} component`,
      ComponentConfiguration: {
        DefaultConfiguration: {
          accessControl: {
            'aws.greengrass.ipc.mqttproxy': {
              [`${componentName}:mqttproxy:1`]: {
                policyDescription: `Allows access to subscribe/publish a topic for ${componentName}.`,
                operations: ['aws.greengrass#PublishToIoTCore', 'aws.greengrass#SubscribeToIoTCore'],
                resources: [topic]
              }
            }
          },
          connectionMetadata
        }
      },
      ComponentDependencies: componentDependencies,
      Manifests: [
        {
          Platform: {
            os: 'linux'
          },
          Name: 'Linux',
          Lifecycle: {
            Setenv: componentEnvironmentVariables,
            Install: `pip3 install -I ${pythonPackagesInstall}`,
            Run: `python3 {artifacts:decompressedPath}/${artifact}/${artifact}.py`
          },
          Artifacts: [
            {
              Uri: `s3://${ARTIFACT_BUCKET}/${artifact}.zip`,
              Algorithm: 'SHA-256',
              Unarchive: 'ZIP'
            }
          ]
        }
      ],
      Lifecycle: {}
    };
  }
}
