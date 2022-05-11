// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, mockAwsIoTSiteWise } from './mock';
import { LambdaError } from '../errors';
import IotSiteWiseHandler from '../aws-handlers/iot-sitewise-handler';

const iotSiteWiseHandler = new IotSiteWiseHandler();
const sources = [{ name: 'mock-source-1' }, { name: 'mock-source-2' }];
const configuration = JSON.stringify({ sources });
const opcUaNamespace = 'iotsitewise:opcuacollector:2';
const gatewayId = 'mock-gateway';

test('Test getDefaultSource() function', () => {
  expect(
    iotSiteWiseHandler.getDefaultSource({
      connectionName: 'mock-connection-name',
      endpointUri: 'mock-uri',
      name: 'mock-opc-ua'
    })
  ).toEqual({
    name: 'mock-opc-ua',
    endpoint: {
      certificateTrust: {
        type: 'TrustAny'
      },
      endpointUri: 'mock-uri',
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
      streamName: 'm2c2_mock-connection-name_stream',
      streamBufferSize: 10
    }
  });
});

test('Test getEndpointUri() function', () => {
  expect(iotSiteWiseHandler.getEndpointUri('10.10.10.10', 8080)).toEqual('opc.tcp://10.10.10.10:8080');
  expect(iotSiteWiseHandler.getEndpointUri('10.10.10.10')).toEqual('opc.tcp://10.10.10.10');
});

describe('Unit tests of getGatewayCapabilityConfigurationSources() function', () => {
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to get the gateway capability configuration sources', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: configuration
        });
      }
    }));

    const response = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSources(gatewayId);
    expect(response).toEqual(sources);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get the empty gateway capability configuration sources', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));

    const response = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSources(gatewayId);
    expect(response).toEqual([]);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test `ResourceNotfoundException`', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject({
          code: 'ResourceNotFoundException',
          message: `Gateway ${process.env.IOT_SITEWISE_GATEWAY_ID} does not have capability ${opcUaNamespace}`
        });
      }
    }));

    const response = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSources(gatewayId);
    expect(response).toEqual([]);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test `ResourceNotfoundException` but different error message', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject({
          code: 'ResourceNotFoundException',
          message: `Gateway ${process.env.IOT_SITEWISE_GATEWAY_ID} does not have capability other namespace`
        });
      }
    }));

    await expect(iotSiteWiseHandler.getGatewayCapabilityConfigurationSources(gatewayId)).rejects.toEqual(
      new LambdaError({
        message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
        name: 'GetGatewayCapabilityConfigurationSourcesError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      {
        code: 'ResourceNotFoundException',
        message: `Gateway ${process.env.IOT_SITEWISE_GATEWAY_ID} does not have capability other namespace`
      }
    );
  });

  test('Test failure to get the gateway capability configuration sources', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(iotSiteWiseHandler.getGatewayCapabilityConfigurationSources(gatewayId)).rejects.toEqual(
      new LambdaError({
        message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
        name: 'GetGatewayCapabilityConfigurationSourcesError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      'Failure'
    );
  });
});

describe('Unit tests of getGatewayCapabilityConfigurationSourceByServerName() function', () => {
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to get the gateway capability configuration source', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: configuration
        });
      }
    }));

    const response = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({
      gatewayId,
      serverName: 'mock-source-1'
    });
    expect(response).toEqual({ name: 'mock-source-1' });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to get the empty gateway capability configuration source', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));

    const response = await iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({
      gatewayId,
      serverName: 'mock-source-not-found'
    });
    expect(response).toEqual({});
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to get the gateway capability configuration source due to `describeGatewayCapabilityConfiguration` failure', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
      name: 'GetGatewayCapabilityConfigurationSourcesError'
    });

    await expect(
      iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({ gatewayId, serverName: 'mock-source-1' })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSourceByServerName] serverName: mock-source-1, Error: ',
      error
    );
  });

  test('Test failure to get the gateway capability configuration source due to other error', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({ sources: {} })
        });
      }
    }));

    await expect(
      iotSiteWiseHandler.getGatewayCapabilityConfigurationSourceByServerName({ gatewayId, serverName: 'mock-source-1' })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to get IoT SiteWise gateway capability configuration source for the name: mock-source-1',
        name: 'GetGatewayCapabilityConfigurationSourceByServerNameError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSourceByServerName] serverName: mock-source-1, Error: ',
      TypeError('sources.find is not a function')
    );
  });
});

describe('Unit tests of updateGatewayCapabilityConfiguration() function', () => {
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to update the gateway capability configuration', async () => {
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.updateGatewayCapabilityConfiguration({ gatewayId, configuration });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: configuration
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to update the gateway capability configuration when JSON parsing error happens', async () => {
    await expect(
      iotSiteWiseHandler.updateGatewayCapabilityConfiguration({ gatewayId, configuration: '{' })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to parse the configuration.',
        name: 'ParseConfigurationError'
      })
    );
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Parse Error: ',
      SyntaxError('Unexpected end of JSON input')
    );
  });

  test('Test failure to update the gateway capability configuration when `sources` are missing from the configuration', async () => {
    await expect(
      iotSiteWiseHandler.updateGatewayCapabilityConfiguration({ gatewayId, configuration: '{}' })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to parse the configuration.',
        name: 'ParseConfigurationError'
      })
    );
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Parse Error: ',
      Error('The key `sources` is missing or invalid.')
    );
  });

  test('Test failure to update the gateway capability configuration when `sources` are not an array', async () => {
    await expect(
      iotSiteWiseHandler.updateGatewayCapabilityConfiguration({
        gatewayId,
        configuration: JSON.stringify({ sources: 'not array' })
      })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to parse the configuration.',
        name: 'ParseConfigurationError'
      })
    );
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Parse Error: ',
      Error('The key `sources` is missing or invalid.')
    );
  });

  test('Test failure to update the gateway capability configuration', async () => {
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(iotSiteWiseHandler.updateGatewayCapabilityConfiguration({ gatewayId, configuration })).rejects.toEqual(
      new LambdaError({
        message: 'Failed to update the IoT SiteWise gateway capability configuration.',
        name: 'UpdateGatewayCapabilityConfigurationError'
      })
    );
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: configuration
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Error: ',
      'Failure'
    );
  });
});

describe('Unit tests of addGatewayCapabilityConfigurationSource() function', () => {
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockReset();
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to add a source to the empty gateway capability configuration', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.addGatewayCapabilityConfigurationSource({
      gatewayId,
      connectionName: 'mock-opc-ua',
      serverName: 'mock-server-name',
      machineIp: '10.10.10.10'
    });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to add a source to the existing gateway capability configuration', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({
            sources: [
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-existing-opc-ua',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
                name: 'mock-existing-server-name'
              })
            ]
          })
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.addGatewayCapabilityConfigurationSource({
      gatewayId,
      connectionName: 'mock-opc-ua',
      serverName: 'mock-server-name',
      machineIp: '10.10.10.10'
    });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-existing-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-existing-server-name'
          }),
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure when getting the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
      name: 'GetGatewayCapabilityConfigurationSourcesError'
    });

    await expect(
      iotSiteWiseHandler.addGatewayCapabilityConfigurationSource({
        gatewayId,
        connectionName: 'mock-opc-ua',
        serverName: 'mock-server-name',
        machineIp: '10.10.10.10'
      })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      '[addGatewayCapabilityConfigurationSource] connectionName: mock-opc-ua, Error: ',
      error
    );
  });

  test('Test failure when updating the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to update the IoT SiteWise gateway capability configuration.',
      name: 'UpdateGatewayCapabilityConfigurationError'
    });

    await expect(
      iotSiteWiseHandler.addGatewayCapabilityConfigurationSource({
        gatewayId,
        connectionName: 'mock-opc-ua',
        serverName: 'mock-server-name',
        machineIp: '10.10.10.10'
      })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      '[addGatewayCapabilityConfigurationSource] connectionName: mock-opc-ua, Error: ',
      error
    );
  });

  test('Test failure when any other error happens', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({ sources: {} })
        });
      }
    }));

    await expect(
      iotSiteWiseHandler.addGatewayCapabilityConfigurationSource({
        gatewayId,
        connectionName: 'mock-opc-ua',
        serverName: 'mock-server-name',
        machineIp: '10.10.10.10'
      })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to add IoT SiteWise gateway capability configuration source for the connection: mock-opc-ua',
        name: 'AddGatewayCapabilityConfigurationSourceError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[addGatewayCapabilityConfigurationSource] connectionName: mock-opc-ua, Error: ',
      TypeError('sources.push is not a function')
    );
  });
});

describe('Unit tests of addExistingSourceToGatewayCapabilityConfiguration() function', () => {
  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockReset();
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to add an existing source to the empty gateway capability configuration', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
      gatewayId,
      source: iotSiteWiseHandler.getDefaultSource({
        connectionName: 'mock-opc-ua',
        endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
        name: 'mock-server-name'
      })
    });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test success to add an existing source to the existing gateway capability configuration', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({
            sources: [
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-existing-opc-ua',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
                name: 'mock-existing-server-name'
              })
            ]
          })
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
      gatewayId,
      source: iotSiteWiseHandler.getDefaultSource({
        connectionName: 'mock-opc-ua',
        endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
        name: 'mock-server-name'
      })
    });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-existing-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-existing-server-name'
          }),
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure when getting the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
      name: 'GetGatewayCapabilityConfigurationSourcesError'
    });

    await expect(
      iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
        gatewayId,
        source: iotSiteWiseHandler.getDefaultSource({
          connectionName: 'mock-opc-ua',
          endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
          name: 'mock-server-name'
        })
      })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      '[addExistingSourceToGatewayCapabilityConfiguration] Error: ',
      error
    );
  });

  test('Test failure when updating the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({})
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to update the IoT SiteWise gateway capability configuration.',
      name: 'UpdateGatewayCapabilityConfigurationError'
    });

    await expect(
      iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
        gatewayId,
        source: iotSiteWiseHandler.getDefaultSource({
          connectionName: 'mock-opc-ua',
          endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
          name: 'mock-server-name'
        })
      })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
            name: 'mock-server-name'
          })
        ]
      })
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      '[addExistingSourceToGatewayCapabilityConfiguration] Error: ',
      error
    );
  });

  test('Test failure when any other error happens', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({ sources: {} })
        });
      }
    }));

    await expect(
      iotSiteWiseHandler.addExistingSourceToGatewayCapabilityConfiguration({
        gatewayId,
        source: iotSiteWiseHandler.getDefaultSource({
          connectionName: 'mock-opc-ua',
          endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
          name: 'mock-server-name'
        })
      })
    ).rejects.toEqual(
      new LambdaError({
        message: 'Failed to add IoT SiteWise gateway capability configuration',
        name: 'AddExistingSourceToGatewayCapabilityConfigurationError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      '[addExistingSourceToGatewayCapabilityConfiguration] Error: ',
      TypeError('sources.push is not a function')
    );
  });
});

describe('Unit tests of deleteGatewayCapabilityConfigurationSource() function', () => {
  const serverName = 'mock-server-name-1';

  beforeEach(() => {
    consoleErrorSpy.mockReset();
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockReset();
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockReset();
  });

  test('Test success to delete a source from the gateway capability configuration', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({
            sources: [
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-opc-ua-1',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
                name: 'mock-server-name-1'
              }),
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-opc-ua-2',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.11'),
                name: 'mock-server-name-2'
              })
            ]
          })
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.deleteGatewayCapabilityConfigurationSource({ gatewayId, serverName });
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua-2',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.11'),
            name: 'mock-server-name-2'
          })
        ]
      })
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure when getting the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to get IoT SiteWise gateway capability configuration sources.',
      name: 'GetGatewayCapabilityConfigurationSourcesError'
    });

    await expect(
      iotSiteWiseHandler.deleteGatewayCapabilityConfigurationSource({ gatewayId, serverName })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[getGatewayCapabilityConfigurationSources] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      `[deleteGatewayCapabilityConfigurationSource] serverName: ${serverName}, Error: `,
      error
    );
  });

  test('Test failure when updating the gateway capability configuration fails', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({
            sources: [
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-opc-ua-1',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.10'),
                name: 'mock-server-name-1'
              }),
              iotSiteWiseHandler.getDefaultSource({
                connectionName: 'mock-opc-ua-2',
                endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.11'),
                name: 'mock-server-name-2'
              })
            ]
          })
        });
      }
    }));
    mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));
    const error = new LambdaError({
      message: 'Failed to update the IoT SiteWise gateway capability configuration.',
      name: 'UpdateGatewayCapabilityConfigurationError'
    });

    await expect(
      iotSiteWiseHandler.deleteGatewayCapabilityConfigurationSource({ gatewayId, serverName })
    ).rejects.toEqual(error);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace,
      capabilityConfiguration: JSON.stringify({
        sources: [
          iotSiteWiseHandler.getDefaultSource({
            connectionName: 'mock-opc-ua-2',
            endpointUri: iotSiteWiseHandler.getEndpointUri('10.10.10.11'),
            name: 'mock-server-name-2'
          })
        ]
      })
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      1,
      '[IoTSiteWiseHandler]',
      '[updateGatewayCapabilityConfiguration] Error: ',
      'Failure'
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      '[IoTSiteWiseHandler]',
      `[deleteGatewayCapabilityConfigurationSource] serverName: ${serverName}, Error: `,
      error
    );
  });

  test('Test failure when any other error happens', async () => {
    mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({
          capabilityConfiguration: JSON.stringify({ sources: {} })
        });
      }
    }));

    await expect(
      iotSiteWiseHandler.deleteGatewayCapabilityConfigurationSource({ gatewayId, serverName })
    ).rejects.toEqual(
      new LambdaError({
        message: `Failed to delete IoT SiteWise gateway capability configuration source for the name: ${serverName}`,
        name: 'DeleteGatewayCapabilityConfigurationSourceError'
      })
    );
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.describeGatewayCapabilityConfiguration).toHaveBeenCalledWith({
      gatewayId,
      capabilityNamespace: opcUaNamespace
    });
    expect(mockAwsIoTSiteWise.updateGatewayCapabilityConfiguration).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[IoTSiteWiseHandler]',
      `[deleteGatewayCapabilityConfigurationSource] serverName: ${serverName}, Error: `,
      TypeError('sources.filter is not a function')
    );
  });
});

describe('Unit tests of createGreengrassV2Gateway() function', () => {
  const name = 'mock-gateway';

  beforeEach(() => mockAwsIoTSiteWise.createGateway.mockReset());

  test('Test success to create Greengrass v2 gateway', async () => {
    const mockResponse = {
      gatewayId: 'mock-gateway-id',
      gatewayArn: 'arn:of:iotsitewise:gateway'
    };
    mockAwsIoTSiteWise.createGateway.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve(mockResponse);
      }
    }));

    const response = await iotSiteWiseHandler.createGreengrassV2Gateway(name);

    expect(response).toEqual(mockResponse);
    expect(mockAwsIoTSiteWise.createGateway).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.createGateway).toHaveBeenCalledWith({
      gatewayName: name,
      gatewayPlatform: {
        greengrassV2: {
          coreDeviceThingName: name
        }
      }
    });
  });

  test('Test failure to create Greengrass v2 gateway', async () => {
    mockAwsIoTSiteWise.createGateway.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(iotSiteWiseHandler.createGreengrassV2Gateway(name)).rejects.toEqual('Failure');
    expect(mockAwsIoTSiteWise.createGateway).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.createGateway).toHaveBeenCalledWith({
      gatewayName: name,
      gatewayPlatform: {
        greengrassV2: {
          coreDeviceThingName: name
        }
      }
    });
  });
});

describe('Unit tests of deleteGreengrassV2Gateway() function', () => {
  const gatewayId = 'mock-gateway-id';

  beforeEach(() => mockAwsIoTSiteWise.deleteGateway.mockReset());

  test('Test success to delete Greengrass v2 gateway', async () => {
    mockAwsIoTSiteWise.deleteGateway.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await iotSiteWiseHandler.deleteGreengrassV2Gateway(gatewayId);

    expect(mockAwsIoTSiteWise.deleteGateway).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.deleteGateway).toHaveBeenCalledWith({ gatewayId });
  });

  test('Test failure to create Greengrass v2 gateway', async () => {
    mockAwsIoTSiteWise.deleteGateway.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(iotSiteWiseHandler.deleteGreengrassV2Gateway(gatewayId)).rejects.toEqual('Failure');
    expect(mockAwsIoTSiteWise.deleteGateway).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.deleteGateway).toHaveBeenCalledWith({ gatewayId });
  });
});

describe('Unit tests of listGreengrassV2Gateway() function', () => {
  const gatewaySummaries = [
    {
      gatewayId: 'mock-gateway-1',
      gatewayPlatform: {
        greengrassV2: {
          coreDeviceThingName: 'mock-core-device-thing-1'
        }
      }
    },
    {
      gatewayId: 'mock-gateway-2',
      gatewayPlatform: {
        greengrass: {
          groupArn: 'arn:of:greengrass:group'
        }
      }
    },
    {
      gatewayId: 'this-will-not-happen-in-the-real-world'
    }
  ];

  beforeEach(() => mockAwsIoTSiteWise.listGateways.mockReset());

  test('Test success to list Greengrass v2 gateways', async () => {
    mockAwsIoTSiteWise.listGateways.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ gatewaySummaries });
      }
    }));

    const response = await iotSiteWiseHandler.listGreengrassV2Gateways();

    expect(response).toEqual({
      gateways: [{ gatewayId: 'mock-gateway-1', coreDeviceThingName: 'mock-core-device-thing-1' }]
    });
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledWith({ nextToken: undefined });
  });

  test('Test success to list Greengrass v2 gateways when no gateway', async () => {
    mockAwsIoTSiteWise.listGateways.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve({ gatewaySummaries: [] });
      }
    }));

    const response = await iotSiteWiseHandler.listGreengrassV2Gateways();

    expect(response).toEqual({ gateways: [] });
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledWith({ nextToken: undefined });
  });

  test('Test success to list Greengrass v2 gateways when next token exists', async () => {
    mockAwsIoTSiteWise.listGateways
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({ gatewaySummaries, nextToken: 'mock-next-token' });
        }
      }))
      .mockImplementationOnce(() => ({
        promise() {
          return Promise.resolve({ gatewaySummaries });
        }
      }));

    const response = await iotSiteWiseHandler.listGreengrassV2Gateways();

    expect(response).toEqual({
      gateways: [
        { gatewayId: 'mock-gateway-1', coreDeviceThingName: 'mock-core-device-thing-1' },
        { gatewayId: 'mock-gateway-1', coreDeviceThingName: 'mock-core-device-thing-1' }
      ]
    });
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledTimes(2);
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenNthCalledWith(1, { nextToken: undefined });
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenNthCalledWith(2, { nextToken: 'mock-next-token' });
  });

  test('Test failure to list Greengrass v2 gateways', async () => {
    mockAwsIoTSiteWise.listGateways.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    await expect(iotSiteWiseHandler.listGreengrassV2Gateways()).rejects.toEqual('Failure');
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledTimes(1);
    expect(mockAwsIoTSiteWise.listGateways).toHaveBeenCalledWith({ nextToken: undefined });
  });
});
