// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// PREPARE
import { LambdaError } from '../errors';
import { ConnectionControl, MachineProtocol } from '../types/solution-common-types';
import { ValidationsLimit, validateConnectionDefinition } from '../validations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectionDefinition: any = {};

test('When `connectionName` is missing, it throws an error', () => {
  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `connectionName` is not a string, it throws an error', () => {
  connectionDefinition.connectionName = 1;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `connectionName` is an empty string, it throws an error', () => {
  connectionDefinition.connectionName = '   ';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `connectionName` contains characters other than alphanumeric characters, hyphens and underscores, it throws an error', () => {
  connectionDefinition.connectionName = 'other character';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `connectionName` is longer than the maximum characters, it throws an error', () => {
  connectionDefinition.connectionName = 'it-is-a-valid-name-but-it-is-too-long';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"connectionName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `control` is missing, it throws an error', () => {
  connectionDefinition.connectionName = 'test-connection';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"control" is missing or invalid from the connection definition. It should be one of these: ${Object.values(
        ConnectionControl
      )}.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `control` is invalid, it throws an error', () => {
  connectionDefinition.control = 'invalid';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"control" is missing or invalid from the connection definition. It should be one of these: ${Object.values(
        ConnectionControl
      )}.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `protocol` is invalid, it throws an error', () => {
  connectionDefinition.control = 'start';
  connectionDefinition.protocol = 'invalid';
  connectionDefinition.connectionName = 'test-connection';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"protocol" (${
        connectionDefinition.protocol
      }) is invalid from the connection definition. It should be one of these: ${Object.values(MachineProtocol)}.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `control` is not `deploy` nor `update` and `protocol` is valid, it does not throw an error', () => {
  connectionDefinition.protocol = 'opcda';

  expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
  expect(connectionDefinition).toEqual({
    connectionName: 'test-connection',
    control: 'start',
    protocol: 'opcda'
  });
});

test('When `control` is `deploy` and `greengrassCoreDeviceName` is not string, it does not throw an error', () => {
  connectionDefinition.control = 'deploy';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"greengrassCoreDeviceName" is invalid from the connection definition. Please provide existing Greengrass core device in the system.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `control` is `deploy` and `greengrassCoreDeviceName` is invalid, it does not throw an error', () => {
  connectionDefinition.greengrassCoreDeviceName = '@@@@invalid####';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"greengrassCoreDeviceName" is invalid from the connection definition. Please provide existing Greengrass core device in the system.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

// From the below test case, it only happens when `control` is `deploy` or `update`.
test('When destination is not set, it throws an error', () => {
  connectionDefinition.greengrassCoreDeviceName = 'mock-greengrass-core';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message:
        'At least one data destination should be set: sendDataToIoTSiteWise, sendDataToIoTTopic, sendDataToKinesisDataStreams, sendDataToTimestream, sendDataToHistorian.',
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When all destinations are false, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = false;
  connectionDefinition.sendDataToIoTTopic = false;
  connectionDefinition.sendDataToKinesisDataStreams = false;
  connectionDefinition.sendDataToTimestream = false;
  connectionDefinition.sendDataToHistorian = false;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message:
        'At least one data destination should be set: sendDataToIoTSiteWise, sendDataToIoTTopic, sendDataToKinesisDataStreams, sendDataToTimestream, sendDataToHistorian.',
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `sendDataToIoTSiteWise` is not a boolean value, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = 0;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"sendDataToIoTSiteWise" is invalid from the connection definition. It is optional and should be boolean.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `sendDataToIoTTopic` is not a boolean value, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = true;
  connectionDefinition.sendDataToIoTTopic = 'false';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"sendDataToIoTTopic" is invalid from the connection definition. It is optional and should be boolean.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `sendDataToKinesisDataStreams` is not a boolean value, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = false;
  connectionDefinition.sendDataToIoTTopic = true;
  connectionDefinition.sendDataToKinesisDataStreams = {};

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"sendDataToKinesisDataStreams" is invalid from the connection definition. It is optional and should be boolean.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `sendDataToTimestream` is not a boolean value, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = false;
  connectionDefinition.sendDataToIoTTopic = true;
  connectionDefinition.sendDataToKinesisDataStreams = false;
  connectionDefinition.sendDataToTimestream = [];

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"sendDataToTimestream" is invalid from the connection definition. It is optional and should be boolean.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `siteName` is undefined, it throws an error', () => {
  connectionDefinition.sendDataToIoTSiteWise = false;
  connectionDefinition.sendDataToIoTTopic = false;
  connectionDefinition.sendDataToKinesisDataStreams = true;
  connectionDefinition.sendDataToTimestream = false;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"siteName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `siteName` is an empty string, it throws an error', () => {
  connectionDefinition.siteName = ' ';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"siteName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `siteName` is not a string, it throws an error', () => {
  connectionDefinition.siteName = 1;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"siteName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `area` is undefined, it throws an error', () => {
  connectionDefinition.siteName = 'site';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"area" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `area` is an empty string, it throws an error', () => {
  connectionDefinition.area = ' ';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"area" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `area` is not a string, it throws an error', () => {
  connectionDefinition.area = 1;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"area" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `process` is undefined, it throws an error', () => {
  connectionDefinition.area = 'area';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"process" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `process` is an empty string, it throws an error', () => {
  connectionDefinition.process = ' ';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"process" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `process` is not a string, it throws an error', () => {
  connectionDefinition.process = 1;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"process" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `machineName` is undefined, it throws an error', () => {
  connectionDefinition.process = 'process';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"machineName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
  expect(connectionDefinition.machineName).toEqual(undefined);
});

test('When `machineName` is an empty string, it throws an error', () => {
  connectionDefinition.machineName = ' ';

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"machineName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `machineName` is not a string, it throws an error', () => {
  connectionDefinition.machineName = 1;

  expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
    new LambdaError({
      message: `"machineName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

test('When `protocol` is missing, it does not throw an error', () => {
  connectionDefinition.machineName = 'machine';

  expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow(
    new LambdaError({
      message: `"machineName" is missing or invalid from the connection definition. It should contain only alphanumeric characters, hyphens, and underscores. The maximum length is ${ValidationsLimit.MAX_CHARACTERS} characters.`,
      name: 'ValidationError',
      statusCode: 400
    })
  );
});

describe('Test OPC DA', () => {
  test('When `opcDa` is missing for OPC DA, it throws an error', () => {
    connectionDefinition.protocol = 'opcda';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcDa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `opcDa` is an array, it throws an error', () => {
    connectionDefinition.opcDa = [];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcDa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `opcDa` is an empty object, it throws an error', () => {
    connectionDefinition.opcDa = {};

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcDa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `machineIp` is missing, it throws an error', () => {
    connectionDefinition.opcDa = { a: 'test' };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `machineIp` is not a string, it throws an error', () => {
    connectionDefinition.opcDa = { machineIp: 1234 };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `machineIp` is not a valid IP, it throws an error', () => {
    connectionDefinition.opcDa.machineIp = '0.0.0.0';
    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );

    connectionDefinition.opcDa.machineIp = '256.256.256.256';
    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );

    connectionDefinition.opcDa.machineIp = '01.1.0.1';
    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );

    connectionDefinition.opcDa.machineIp = '10.011.0.1';
    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `serverName` is not a string, it throws an error', () => {
    connectionDefinition.opcDa.machineIp = '10.10.10.10';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `serverName` is an empty string, it throws an error', () => {
    connectionDefinition.opcDa.serverName = ' ';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `iterations` is missing, it throws an error', () => {
    connectionDefinition.opcDa.serverName = 'OPC.DA.Server';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"iterations" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_ITERATION} and ${ValidationsLimit.MAX_ITERATION}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `iterations` is less than the minimum value, it throws an error', () => {
    connectionDefinition.opcDa.iterations = ValidationsLimit.MIN_ITERATION - 1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"iterations" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_ITERATION} and ${ValidationsLimit.MAX_ITERATION}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `iterations` is greater than the maximum value, it throws an error', () => {
    connectionDefinition.opcDa.iterations = ValidationsLimit.MAX_ITERATION + 1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"iterations" is missing or invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_ITERATION} and ${ValidationsLimit.MAX_ITERATION}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `interval` is missing, it throws an error', () => {
    connectionDefinition.opcDa.iterations = ValidationsLimit.MAX_ITERATION;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"interval" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_INTERVAL} and ${ValidationsLimit.MAX_INTERVAL}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `interval` is less than the minimum value, it throws an error', () => {
    connectionDefinition.opcDa.interval = ValidationsLimit.MIN_INTERVAL - 0.1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"interval" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_INTERVAL} and ${ValidationsLimit.MAX_INTERVAL}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `interval` is greater than the maximum value, it throws an error', () => {
    connectionDefinition.opcDa.interval = ValidationsLimit.MAX_INTERVAL + 0.1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"interval" is missing or invalid from the connection definition. It should be a float number between ${ValidationsLimit.MIN_INTERVAL} and ${ValidationsLimit.MAX_INTERVAL}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When both of `listTags` and `tags` are missing, it throws an error', () => {
    connectionDefinition.opcDa.interval = ValidationsLimit.MAX_INTERVAL;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: 'Tags are missing. At least one of these should have at least one tag: listTags, tags.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `listTags` is not array and `tags` is array, it throws an error', () => {
    connectionDefinition.opcDa.listTags = {};
    connectionDefinition.opcDa.tags = [];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"listTags" is invalid from the connection definition. It should be a string array.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `tags` is not array and `listTags` is array, it throws an error', () => {
    connectionDefinition.opcDa.listTags = [];
    connectionDefinition.opcDa.tags = {};

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"tags" is invalid from the connection definition. It should be a string array.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When both of `listTags` and `tags` are empty arrays, it throws an error', () => {
    connectionDefinition.opcDa.listTags = [];
    connectionDefinition.opcDa.tags = [];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `Both "listTags" and "tags" are empty. At least one of them should have at least one tag.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `listTags` items are not valid, it throws an error', () => {
    connectionDefinition.opcDa.listTags = [' '];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"Tag in listTags" is missing or invalid from the connection definition. It should be a non-empty string.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `tags` items are not valid, it throws an error', () => {
    connectionDefinition.opcDa.listTags = ['*Tag*'];
    connectionDefinition.opcDa.tags = [1];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"Tag in tags" is missing or invalid from the connection definition. It should be a non-empty string.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When only valid tags are provided, it does not throw an error', () => {
    delete connectionDefinition.opcDa.listTags;
    connectionDefinition.opcDa.tags = ['tag'];

    expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
    expect(connectionDefinition).toEqual({
      connectionName: 'test-connection',
      control: 'deploy',
      area: 'area',
      greengrassCoreDeviceName: 'mock-greengrass-core',
      machineName: 'machine',
      logLevel: undefined,
      opcDa: {
        machineIp: '10.10.10.10',
        serverName: 'OPC.DA.Server',
        iterations: ValidationsLimit.MAX_ITERATION,
        interval: ValidationsLimit.MAX_INTERVAL,
        tags: ['tag']
      },
      process: 'process',
      protocol: 'opcda',
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      sendDataToHistorian: false,
      siteName: 'site'
    });
  });

  test('When only valid listTags are provided, it does not throw an error', () => {
    connectionDefinition.opcDa.listTags = ['*Tag*'];
    delete connectionDefinition.opcDa.tags;

    expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
    expect(connectionDefinition).toEqual({
      connectionName: 'test-connection',
      control: 'deploy',
      area: 'area',
      greengrassCoreDeviceName: 'mock-greengrass-core',
      machineName: 'machine',
      logLevel: undefined,
      opcDa: {
        machineIp: '10.10.10.10',
        serverName: 'OPC.DA.Server',
        iterations: ValidationsLimit.MAX_ITERATION,
        interval: ValidationsLimit.MAX_INTERVAL,
        listTags: ['*Tag*']
      },
      process: 'process',
      protocol: 'opcda',
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      sendDataToHistorian: false,
      siteName: 'site'
    });
  });

  test('When every value is valid, it does not throw an error', () => {
    connectionDefinition.opcDa.tags = ['tag'];

    expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
    expect(connectionDefinition).toEqual({
      connectionName: 'test-connection',
      control: 'deploy',
      area: 'area',
      greengrassCoreDeviceName: 'mock-greengrass-core',
      machineName: 'machine',
      logLevel: undefined,
      opcDa: {
        machineIp: '10.10.10.10',
        serverName: 'OPC.DA.Server',
        iterations: ValidationsLimit.MAX_ITERATION,
        interval: ValidationsLimit.MAX_INTERVAL,
        listTags: ['*Tag*'],
        tags: ['tag']
      },
      process: 'process',
      protocol: 'opcda',
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      sendDataToHistorian: false,
      siteName: 'site'
    });
  });
});

describe('Test OPC UA', () => {
  test('When `opcUa` is missing for OPC DA, it throws an error', () => {
    connectionDefinition.control = 'update';
    connectionDefinition.protocol = 'opcua';
    delete connectionDefinition.opcDa;
    delete connectionDefinition.greengrassCoreDeviceName;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcUa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `opcUa` is an array, it throws an error', () => {
    connectionDefinition.opcUa = [];

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcUa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `opcUa` is an empty object, it throws an error', () => {
    connectionDefinition.opcUa = {};

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"opcUa" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `machineIp` is missing, it throws an error', () => {
    connectionDefinition.opcUa = { a: 'test' };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"machineIp" is missing or invalid from the connection definition. It should be a valid IP.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `serverName` is not a string, it throws an error', () => {
    connectionDefinition.opcUa = { machineIp: '10.10.10.10' };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string up to ${ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS} characters.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `serverName` is empty, it throws an error', () => {
    connectionDefinition.opcUa.serverName = ' ';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string up to ${ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS} characters.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `serverName` is longer than the maximum allowed characters, it throws an error', () => {
    connectionDefinition.opcUa.serverName = Array(ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS + 2).join('a');

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"serverName" is missing or invalid from the connection definition. It should be a non-empty string up to ${ValidationsLimit.MAX_OPCUA_SERVER_NAME_CHARACTERS} characters.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `port` is missing, it does not throw an error', () => {
    connectionDefinition.opcUa.serverName = 'OPC.UA.Server';

    expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
    expect(connectionDefinition).toEqual({
      connectionName: 'test-connection',
      control: 'update',
      area: 'area',
      machineName: 'machine',
      logLevel: undefined,
      opcUa: {
        machineIp: '10.10.10.10',
        serverName: 'OPC.UA.Server'
      },
      process: 'process',
      protocol: 'opcua',
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      sendDataToHistorian: false,
      siteName: 'site'
    });
  });

  test('When `port` is not an integer number, it throws an error', () => {
    connectionDefinition.opcUa.port = 'NaN';

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"port" is invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_PORT} and ${ValidationsLimit.MAX_PORT}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `port` is less than the minimum value, it throws an error', () => {
    connectionDefinition.opcUa.port = ValidationsLimit.MIN_PORT - 1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"port" is invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_PORT} and ${ValidationsLimit.MAX_PORT}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `port` is greater than the maximum value, it throws an error', () => {
    connectionDefinition.opcUa.port = ValidationsLimit.MAX_PORT + 1;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: `"port" is invalid from the connection definition. It should be an integer number between ${ValidationsLimit.MIN_PORT} and ${ValidationsLimit.MAX_PORT}.`,
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When every value is valid, it does not throw an error', () => {
    connectionDefinition.opcUa.port = ValidationsLimit.MAX_PORT;

    expect(() => validateConnectionDefinition(connectionDefinition)).not.toThrow();
    expect(connectionDefinition).toEqual({
      connectionName: 'test-connection',
      control: 'update',
      area: 'area',
      machineName: 'machine',
      logLevel: undefined,
      opcUa: {
        machineIp: '10.10.10.10',
        serverName: 'OPC.UA.Server',
        port: ValidationsLimit.MAX_PORT
      },
      process: 'process',
      protocol: 'opcua',
      sendDataToIoTSiteWise: false,
      sendDataToIoTTopic: false,
      sendDataToKinesisDataStreams: true,
      sendDataToTimestream: false,
      sendDataToHistorian: false,
      siteName: 'site'
    });
  });
});

describe('Test Modbus TCP', () => {
  test('When `modbusTcp` is missing for Modbus TCP, it throws an error', () => {
    connectionDefinition.control = 'update';
    connectionDefinition.protocol = 'modbustcp';
    delete connectionDefinition.opcUa;
    delete connectionDefinition.greengrassCoreDeviceName;

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" is missing or invalid from the connection definition. See the implementation guide.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` host is not a string, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 1
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"host" is missing or invalid from the connection definition. It should be a non-empty string.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` host port is out of range, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 70000
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message:
          '"port" is invalid from the connection definition. It should be an integer number between 1 and 65535.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` host tag is not a string, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 1
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"hostTag" is missing or invalid from the connection definition. It should be a non-empty string.',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config is empty, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: []
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary config cannot be empty',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config secondary address is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 'NaN',
          frequencyInSeconds: 1,
          commandConfig: {
            readCoils: {
              address: 1,
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Secondary address must be number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config frequency in seconds is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 'NaN',
          commandConfig: {
            readCoils: {
              address: 1,
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Frequency in seconds must be number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read coils address is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readCoils: {
              address: 'NaN',
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read coils address must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read coils count is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readCoils: {
              address: 1,
              count: 'NaN'
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read coils count must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read discrete inputs address is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readDiscreteInputs: {
              address: 'NaN',
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read discrete inputs address must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read discrete inputs count is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readDiscreteInputs: {
              address: 1,
              count: 'NaN'
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read discrete inputs count must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read holding registers address is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readHoldingRegisters: {
              address: 'NaN',
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read holding registers address must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read holding registers count is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readHoldingRegisters: {
              address: 1,
              count: 'NaN'
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read holding registers count must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read input registers address is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readInputRegisters: {
              address: 'NaN',
              count: 1
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read input registers address must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });

  test('When `modbusTcp` modbus secondaries config read input registers count is not a number, it throws an error', () => {
    connectionDefinition.modbusTcp = {
      host: 'mock-host',
      hostPort: 5020,
      hostTag: 'mock-tag',
      modbusSecondariesConfig: [
        {
          secondaryAddress: 1,
          frequencyInSeconds: 1,
          commandConfig: {
            readInputRegisters: {
              address: 1,
              count: 'NaN'
            }
          }
        }
      ]
    };

    expect(() => validateConnectionDefinition(connectionDefinition)).toThrow(
      new LambdaError({
        message: '"modbusTcp" secondary definition failed validation: Read input registers count must be a number',
        name: 'ValidationError',
        statusCode: 400
      })
    );
  });
});
