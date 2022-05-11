// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  mockDynamoDbHandler,
  mockGreengrassV2Handler,
  mockIoTHandler,
  mockIoTSiteWiseHandler,
  mockValues,
  sendAnonymousMetricsSpy,
  sleepSpy
} from './mock';
import { handler } from '../index';
import { ConnectionControl, ConnectionDefinition, MachineProtocol } from '../../lib/types/solution-common-types';

const event: ConnectionDefinition = {
  connectionName: mockValues.connectionName,
  control: ConnectionControl.DELETE,
  protocol: MachineProtocol.OPCDA
};

beforeAll(() => {
  process.env.SEND_ANONYMOUS_METRIC = 'No';
  mockDynamoDbHandler.deleteConnection.mockReset();
  mockDynamoDbHandler.getGreengrassCoreDevice.mockReset();
  mockDynamoDbHandler.updateConnection.mockReset();
  mockGreengrassV2Handler.createDeployment.mockReset();
  mockGreengrassV2Handler.deleteComponent.mockReset();
  mockGreengrassV2Handler.getDeployment.mockReset();
  mockIoTHandler.publishIoTTopicMessage.mockReset();
  mockIoTSiteWiseHandler.deleteGatewayCapabilityConfigurationSource.mockReset();
  sendAnonymousMetricsSpy.mockReset();
  sleepSpy.mockReset();
});

test('Test not sending anonymous metrics', async () => {
  mockDynamoDbHandler.getGreengrassCoreDevice.mockResolvedValue({
    iotSiteWiseGatewayId: 'mock-gateway-id',
    iotThingArn: 'arn:of:thing'
  });

  mockDynamoDbHandler.deleteConnection.mockResolvedValueOnce(undefined);
  mockDynamoDbHandler.updateConnection.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.createDeployment.mockResolvedValueOnce({ deploymentId: mockValues.deploymentId });
  mockGreengrassV2Handler.deleteComponent.mockResolvedValueOnce(undefined);
  mockGreengrassV2Handler.getDeployment.mockResolvedValueOnce({ deploymentStatus: 'COMPLETED' });
  mockIoTHandler.publishIoTTopicMessage.mockResolvedValueOnce(undefined);
  sleepSpy.mockResolvedValueOnce(undefined);

  await handler(event);

  expect(sendAnonymousMetricsSpy).not.toHaveBeenCalled();
});
