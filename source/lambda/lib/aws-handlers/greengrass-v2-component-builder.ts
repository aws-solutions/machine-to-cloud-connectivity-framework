// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LambdaError } from '../errors';
import {
  ComponentConnectionMetadata,
  ComponentDependency,
  ComponentType,
  CreateComponentRecipeRequest,
  CreateComponentRecipeResponse,
  ComponentManifest
} from '../types/greengrass-v2-handler-types';
import { MachineProtocol } from '../types/solution-common-types';
import { GreengrassCoreDeviceOsPlatform } from '../types/connection-builder-types';

const { ARTIFACT_BUCKET, KINESIS_STREAM, TIMESTREAM_KINESIS_STREAM, COLLECTOR_ID } = process.env;

/**
 * Python modules have same versions with /source/machine_connector/m2c2_opcda_connector/requirements.txt
 * and /source/machine_connector/m2c2_publisher/requirements.txt
 */
const PYTHON_MODULE_VERSION = {
  awsiotsdk: '1.11.1',
  backoff: '1.10.0',
  greengrasssdk: '1.6.0',
  'OpenOPC-Python3x': '1.3.1',
  Pyro4: '4.81',
  'python-dateutil': '2.8.1',
  requests_ntlm: '1.2.0',
  testresources: '2.0.1',
  wheel: '0.37.1',
  'twisted[serial]': '20.3.0',
  pymodbus: '3.0.0.dev4',
  pyserial: '3.5',
  'pyserial-asyncio': '0.6'
};

export class GreengrassV2ComponentBuilder {
  /**
   * Creates a Greengrass v2 component recipe based on the parameters.
   * @param params The component recipe build request parameters
   * @returns The component recipe
   */
  public static createRecipe(params: CreateComponentRecipeRequest): CreateComponentRecipeResponse {
    const {
      area,
      componentType,
      componentVersion,
      connectionName,
      machineName,
      process,
      logLevel,
      protocol,
      siteName,
      osPlatform
    } = params;
    const {
      sendDataToIoTSiteWise,
      sendDataToIoTTopic,
      sendDataToKinesisStreams,
      sendDataToTimestream,
      sendDataToHistorian,
      historianKinesisDatastreamName
    } = params;

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
      area: area,
      connectionName: connectionName,
      machineName: machineName,
      process: process,
      siteName: siteName,
      logLevel: logLevel,
      streamName: `m2c2_${connectionName}_stream`
    };
    const componentEnvironmentVariables: Record<string, string> = {
      AREA: '{configuration:/connectionMetadata/area}',
      CONNECTION_GG_STREAM_NAME: '{configuration:/connectionMetadata/streamName}',
      CONNECTION_NAME: '{configuration:/connectionMetadata/connectionName}',
      MACHINE_NAME: '{configuration:/connectionMetadata/machineName}',
      PROCESS: '{configuration:/connectionMetadata/process}',
      SITE_NAME: '{configuration:/connectionMetadata/siteName}',
      LOG_LEVEL: '{configuration:/connectionMetadata/logLevel}'
    };

    // By default, all components install `awsiotsdk`, `backoff`, `greengrasssdk`, and `python-dateutil` before running.
    const pythonPackages = ['awsiotsdk', 'backoff', 'greengrasssdk', 'python-dateutil', 'wheel'];
    const pythonUnversionedPackages = [];

    let componentName = `m2c2-${connectionName}`;
    let topic = `m2c2/+/${connectionName}`;
    let artifact = '';

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
      connectionMetadata.sendDataToHistorian = sendDataToHistorian ? 'Yes' : '';

      // Set the environment variables for the publisher component.
      componentEnvironmentVariables.KINESIS_STREAM_NAME = KINESIS_STREAM;
      componentEnvironmentVariables.PROTOCOL = protocol;
      componentEnvironmentVariables.SEND_TO_IOT_TOPIC = '{configuration:/connectionMetadata/sendDataToIoTTopic}';
      componentEnvironmentVariables.SEND_TO_SITEWISE = '{configuration:/connectionMetadata/sendDataToIoTSiteWise}';
      componentEnvironmentVariables.SEND_TO_KINESIS_STREAM =
        '{configuration:/connectionMetadata/sendDataToKinesisStreams}';
      componentEnvironmentVariables.SEND_TO_TIMESTREAM = '{configuration:/connectionMetadata/sendDataToTimestream}';
      componentEnvironmentVariables.SEND_TO_HISTORIAN = '{configuration:/connectionMetadata/sendDataToHistorian}';
      componentEnvironmentVariables.TIMESTREAM_KINESIS_STREAM = TIMESTREAM_KINESIS_STREAM;
      componentEnvironmentVariables.HISTORIAN_KINESIS_STREAM = historianKinesisDatastreamName
        ? historianKinesisDatastreamName
        : '';
      componentEnvironmentVariables.COLLECTOR_ID = COLLECTOR_ID;
    } else {
      if (params.protocol == MachineProtocol.OPCDA) {
        artifact = 'm2c2_opcda_connector';

        /**
         * The OPC DA collector needs to install OpenOPC and Pyro4 before running.
         */
        pythonPackages.push(...['OpenOPC-Python3x', 'Pyro4']);
      } else if (params.protocol == MachineProtocol.OSIPI) {
        artifact = 'm2c2_osipi_connector';

        pythonPackages.push(...['testresources', 'requests_ntlm']);
        pythonUnversionedPackages.push(
          ...['git+https://github.com/dcbark01/PI-Web-API-Client-Python.git@b620f72f2d2551632f406df44bd409f5cc305055']
        );

        componentDependencies['aws.greengrass.SecretManager'] = {
          VersionRequirement: '>=2.1.0 <3.0.0',
          DependencyType: 'HARD'
        };
      } else if (params.protocol == MachineProtocol.MODBUSTCP) {
        artifact = 'm2c2_modbus_tcp_connector';

        pythonPackages.push(...['twisted[serial]', 'pymodbus', 'pyserial', 'pyserial-asyncio']);
      } else {
        throw new LambdaError({
          message: `no handler exists for protocol: "${params.protocol}".`,
          name: 'IoTProtocolHandlerNotFoundError',
          statusCode: 400
        });
      }
    }

    let pythonPackagesInstall = pythonPackages
      .map(pythonPackage => `${pythonPackage}==${PYTHON_MODULE_VERSION[pythonPackage]}`)
      .join(' ');

    pythonPackagesInstall += ' ' + pythonUnversionedPackages.join(' ');

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
            },
            'aws.greengrass.SecretManager': {
              [`${componentName}:secrets:1`]: {
                policyDescription: `Allows access to secrets ${componentName}.`,
                operations: ['aws.greengrass#GetSecretValue'],
                resources: ['*']
              }
            }
          },
          connectionMetadata
        }
      },
      ComponentDependencies: componentDependencies,
      Manifests: [this.constructManifest(osPlatform, componentEnvironmentVariables, pythonPackagesInstall, artifact)],
      Lifecycle: {}
    };
  }

  public static constructManifest(
    osPlatform: string,
    componentEnvironmentVariables: Record<string, string>,
    pythonPackagesInstall: string,
    artifact: string
  ): ComponentManifest {
    if (osPlatform == GreengrassCoreDeviceOsPlatform.LINUX) {
      return {
        Platform: {
          os: GreengrassCoreDeviceOsPlatform.LINUX
        },
        Name: GreengrassCoreDeviceOsPlatform.LINUX,
        Lifecycle: {
          Setenv: componentEnvironmentVariables,
          Install: `
                python3 -m venv .venv
                . .venv/bin/activate
                pip3 install wheel
                pip3 install -I ${pythonPackagesInstall}
                `,
          Run: `
                . .venv/bin/activate
                python3 {artifacts:decompressedPath}/${artifact}/${artifact}.py
                `
        },
        Artifacts: [
          {
            Uri: `s3://${ARTIFACT_BUCKET}/${artifact}.zip`,
            Algorithm: 'SHA-256',
            Unarchive: 'ZIP'
          }
        ]
      };
    } else if (osPlatform == GreengrassCoreDeviceOsPlatform.WINDOWS) {
      return {
        Platform: {
          os: GreengrassCoreDeviceOsPlatform.WINDOWS
        },
        Name: GreengrassCoreDeviceOsPlatform.WINDOWS,
        Lifecycle: {
          Setenv: componentEnvironmentVariables,
          Install: `python -m venv .venv & .venv\\Scripts\\activate & pip install wheel & pip install -I ${pythonPackagesInstall}`,
          Run: `.venv\\Scripts\\activate & python {artifacts:decompressedPath}/${artifact}/${artifact}.py`
        },
        Artifacts: [
          {
            Uri: `s3://${ARTIFACT_BUCKET}/${artifact}.zip`,
            Algorithm: 'SHA-256',
            Unarchive: 'ZIP'
          }
        ]
      };
    } else {
      throw new LambdaError({
        message: `Failed to build manifest for recipe because ${osPlatform} not in supportyed os platforms`,
        name: 'ComponentBuilderError'
      });
    }
  }
}
