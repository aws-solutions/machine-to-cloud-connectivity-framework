// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GreengrassCoreDeviceEventTypes } from './connection-builder-types';
import { StackEventTypes } from './custom-resource-types';
import { CreatedBy } from './dynamodb-handler-types';
import { ConnectionControl, MachineProtocol } from './solution-common-types';

export type AnonymousMetricData = DefaultMetricData | ApiEventMetricData | StackEventMetricData;
export type AwsSdkOptions = Record<string, string>;

interface DefaultMetricData {
  EventType: ConnectionControl | GreengrassCoreDeviceEventTypes | StackEventTypes;
}

export interface ApiEventMetricData extends DefaultMetricData {
  createdBy?: CreatedBy;
  interval?: number;
  iterations?: number;
  numberOfLists?: number;
  numberOfTags?: number;
  protocol?: MachineProtocol;
}

export interface StackEventMetricData extends DefaultMetricData {
  ExistingKinesisStream: boolean;
  ExistingTimestreamDatabase: boolean;
  Region: string;
}
