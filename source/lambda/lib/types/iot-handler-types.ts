// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Below ones are the supported IoT endpoint types as of February 2022.
 * {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Iot.html#describeEndpoint-property}
 */
export type IoTEndpointType = 'iot:Data' | 'iot:Data-ATS' | 'iot:CredentialProvider' | 'iot:Jobs';

export enum IoTMessageTypes {
  JOB = 'job',
  INFO = 'info',
  ERROR = 'error'
}

export interface PublishIoTTopicMessageRequest {
  connectionName: string;
  type: IoTMessageTypes;
  data: unknown;
}
