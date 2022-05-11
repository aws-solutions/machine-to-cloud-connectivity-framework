// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { mockDynamoDbHandler, mockValues } from './mock';
import { handler } from '../index';
import { LambdaError } from '../../lib/errors';
import { ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';

beforeEach(() => mockDynamoDbHandler.getGreengrassCoreDevice.mockReset());

test('Test invalid control', async () => {
  mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValue({
    iotSiteWiseGatewayId: 'mock-gateway-id',
    iotThingArn: 'arn:of:thing'
  });

  const invalidControl = 'invalid';
  const event: ConnectionDefinition = {
    connectionName: mockValues.connectionName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: <any>invalidControl,
    greengrassCoreDeviceName: 'mock-core-device',
    protocol: MachineProtocol.OPCDA
  };

  await expect(handler(event)).rejects.toEqual(
    new LambdaError({
      message: `Unsupported connection control ${invalidControl}.`,
      name: 'GreengrassDeployerError'
    })
  );
  expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(event.greengrassCoreDeviceName);
});

test('Test failure of getting Greengrass core device', async () => {
  mockDynamoDbHandler.getGreengrassCoreDevice.mockRejectedValue('Failure');

  const invalidControl = 'invalid';
  const event: ConnectionDefinition = {
    connectionName: mockValues.connectionName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: <any>invalidControl,
    greengrassCoreDeviceName: 'mock-core-device',
    protocol: MachineProtocol.OPCDA
  };

  await expect(handler(event)).rejects.toEqual('Failure');
  expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledTimes(1);
  expect(mockDynamoDbHandler.getGreengrassCoreDevice).toHaveBeenCalledWith(event.greengrassCoreDeviceName);
});
