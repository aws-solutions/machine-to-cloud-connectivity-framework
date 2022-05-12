// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBHandlerTypes, SolutionCommonTypes } from '.';
import { ConnectionControl, MachineProtocol } from './solution-common-types';

export interface MetricData {
  EventType: ConnectionControl;
  protocol: MachineProtocol;
  interval?: number;
  iterations?: number;
  numberOfLists?: number;
  numberOfTags?: number;
}

export interface UpdateOpcUaConfigurationRequest {
  currentConfiguration: DynamoDBHandlerTypes.GetConnectionResponse;
  currentControl: SolutionCommonTypes.ConnectionControl;
  gatewayId: string;
  newConfiguration: SolutionCommonTypes.ConnectionDefinition;
}

export interface DeleteComponentRequest {
  connectionName: string;
  gatewayId: string;
  protocol: MachineProtocol;
}
