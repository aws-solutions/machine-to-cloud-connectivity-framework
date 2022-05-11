// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * The below types restricts the values only for the solution only.
 * This can be expended to support other values in the future.
 */
type CertificateTrustType = 'TrustAny';
type DefinitionRootPathType = '/';
type DefinitionType = 'OpcUaRootPath';
type DestinationType = 'StreamManager';
type IdentityProviderType = 'Anonymous';
type MeasurementDataStringPrefixType = '';
type MessageSecurityMode = 'NONE';
type NodeFilterRulesActionType = 'INCLUDE';
type SecurityPolicyType = 'NONE';

export type AddGatewayCapacityConfigurationRequest = Omit<IoTSiteWiseRequestParameters, 'source' | 'configuration'>;
export type GatewayIdAndConfiguration = Pick<IoTSiteWiseRequestParameters, 'gatewayId' | 'configuration'>;
export type GatewayIdAndServerName = Pick<IoTSiteWiseRequestParameters, 'gatewayId' | 'serverName'>;
export type GatewayIdAndSource = Pick<IoTSiteWiseRequestParameters, 'gatewayId' | 'source'>;

interface IoTSiteWiseRequestParameters {
  configuration: string;
  connectionName: string;
  gatewayId: string;
  serverName: string;
  source: CapabilityConfigurationSource;
  machineIp: string;
  port?: number;
}

export interface GetDefaultSourceRequest {
  connectionName: string;
  endpointUri: string;
  name: string;
}

export interface CapabilityConfigurationSource {
  destination: Destination;
  name: string;
  endpoint: Endpoint;
  measurementDataStreamPrefix: MeasurementDataStringPrefixType;
}

interface CertificateTrust {
  type: CertificateTrustType;
}

interface IdentityProvider {
  type: IdentityProviderType;
}

interface NodeFilterRulesDefinition {
  type: DefinitionType;
  rootPath: DefinitionRootPathType;
}

interface NodeFilterRule {
  action: NodeFilterRulesActionType;
  definition: NodeFilterRulesDefinition;
}

interface Endpoint {
  certificateTrust: CertificateTrust;
  endpointUri: string;
  identityProvider: IdentityProvider;
  messageSecurityMode: MessageSecurityMode;
  nodeFilterRules: NodeFilterRule[];
  securityPolicy: SecurityPolicyType;
}

interface Destination {
  streamBufferSize: number;
  streamName: string;
  type: DestinationType;
}

export interface ListGateway {
  gatewayId: string;
  coreDeviceThingName: string;
}

export interface ListGatewayResponse {
  gateways: ListGateway[];
}
