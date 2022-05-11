// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LogType } from './solution-common-types';

export interface EventMessage {
  Records: SqsRecord[];
}

export interface SqsRecord {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: {
    ApproximateReceiveCount: string;
    SentTimestamp: string;
    SenderId: string;
    ApproximateFirstReceiveTimestamp: string;
  };
  messageAttributes: Record<string, unknown>;
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface RecordDefaultBody {
  connectionName: string;
  logType: LogType;
  timestamp: number;
  message: string;
}

export interface RecordBody extends RecordDefaultBody {
  siteName: string;
  area: string;
  process: string;
  machineName: string;
}

export interface ItemBody extends RecordDefaultBody {
  ttl: number;
}

export interface BatchPutRequest {
  PutRequest: {
    Item: ItemBody;
  };
}
