// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

type ResourcePropertyTypes =
  | CopyUiAssetsProperties
  | CreateUiConfigProperties
  | CreateGreengrassInstallationScriptsProperties
  | DeleteIoTCertificateProperties
  | ResourceProperty
  | SendAnonymousMetricProperties;
type CustomResourceResponseData =
  | Partial<CustomResourceErrorData>
  | Partial<GreengrassCertificateResponse>
  | Partial<GreengrassInstallationScriptsResponse>
  | Partial<IoTEndpointResponse>
  | Partial<IoTGatewayResponse>
  | Partial<UuidResponse>;

export enum RequestTypes {
  CREATE = 'Create',
  DELETE = 'Delete',
  UPDATE = 'Update'
}

export enum ResourceTypes {
  COPY_GREENGRASS_COMPONENTS_ARTIFACT = 'CopyGreengrassComponentsArtifact',
  COPY_UI_ASSETS = 'CopyUIAssets',
  CREATE_GREENGRASS_INSTALLATION_SCRIPTS = 'CreateGreengrassInstallationScripts',
  CREATE_IOT_SITEWISE_GATEWAY = 'CreateIoTSiteWiseGateway',
  DELETE_IOT_SITEWISE_GATEWAY = 'DeleteIoTSiteWiseGateway',
  CREATE_UI_CONFIG = 'CreateUIConfig',
  CREATE_UUID = 'CreateUUID',
  DELETE_IOT_CERTIFICATE = 'DeleteIoTCertificate',
  DESCRIBE_IOT_ENDPOINT = 'DescribeIoTEndpoint',
  MANAGE_IOT_ROLE_ALIAS = 'ManageIoTRoleAlias',
  SEND_ANONYMOUS_METRICS = 'SendAnonymousMetrics'
}

export enum StatusTypes {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export enum StackEventTypes {
  DEPLOY = 'DeployStack',
  UPDATE = 'UpdateStack',
  DELETE = 'DeleteStack'
}

export interface LambdaContext {
  getRemainingTimeInMillis: () => number;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: number;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity: object;
  clientContext: object;
  callbackWaitsForEmptyEventLoop: boolean;
}

export interface EventRequest {
  RequestType: RequestTypes;
  PhysicalResourceId: string;
  StackId: string;
  ServiceToken: string;
  RequestId: string;
  LogicalResourceId: string;
  ResponseURL: string;
  ResourceType: string;
  ResourceProperties: ResourcePropertyTypes;
}

interface ResourceProperty {
  Resource: ResourceTypes;
}

export interface SendAnonymousMetricProperties extends ResourceProperty {
  ExistingKinesisStream: string;
  ExistingTimestreamDatabase: string;
  SolutionUUID: string;
}

export interface CopyProperties extends ResourceProperty {
  DestinationBucket: string;
  SourceBucket: string;
  SourcePrefix: string;
}
export interface CopyUiAssetsProperties extends CopyProperties {
  ManifestFile: string;
}

export interface CreateUiConfigProperties extends ResourceProperty {
  ApiEndpoint: string;
  DestinationBucket: string;
  ConfigFileName: string;
  IdentityPoolId: string;
  LoggingLevel: string;
  S3Bucket: string;
  UserPoolId: string;
  WebClientId: string;
}

export interface ManageIoTRoleAliasProperties extends ResourceProperty {
  RoleAliasName: string;
  RoleArn: string;
}

export interface CopyGreengrassComponentArtifactProperties extends CopyProperties {
  Artifacts: {
    OpcDaConnectorArtifact: string;
    OsiPiConnectorArtifact: string;
    PublisherArtifact: string;
  };
}

export interface CreateGreengrassInstallationScriptsProperties extends ResourceProperty {
  CredentialProviderEndpoint: string;
  DataAtsEndpoint: string;
  DestinationBucket: string;
  IoTRoleAlias: string;
}

export interface DeleteIoTCertificateProperties extends ResourceProperty {
  CertificateArn: string;
  CertificateId: string;
}

export interface CustomResourceResponse {
  Status: StatusTypes;
  Data: CustomResourceResponseData;
}

export interface UuidResponse {
  UUID?: string;
}

export interface IoTEndpointResponse {
  CredentialProviderEndpoint: string;
  DataAtsEndpoint: string;
}

interface CustomResourceErrorData {
  Error: string;
}

export interface GreengrassCertificateResponse {
  certificateId: string;
  certificateArn: string;
  generatedS3URL: string;
}

export interface SendAnonymousMetricsRequest {
  requestType: RequestTypes;
  resourceProperties: SendAnonymousMetricProperties;
}

export interface CopyUiAssetsRequest {
  requestType: RequestTypes;
  resourceProperties: CopyUiAssetsProperties;
}

export interface CreateUiConfigRequest {
  requestType: RequestTypes;
  resourceProperties: CreateUiConfigProperties;
}

export interface IoTGatewayResponse {
  IoTSiteWiseGatewayArn: string;
  IoTSiteWiseGatewayId: string;
}

export interface ManageIoTRoleAliasRequest {
  requestType: RequestTypes;
  resourceProperties: ManageIoTRoleAliasProperties;
}

export interface CopyGreengrassComponentsArtifactRequest {
  requestType: RequestTypes;
  resourceProperties: CopyGreengrassComponentArtifactProperties;
}

export interface CreateGreengrassInstallationScriptsRequest {
  requestType: RequestTypes;
  resourceProperties: CreateGreengrassInstallationScriptsProperties;
}

export interface GreengrassInstallationScriptsResponse {
  CertificateArn: string;
  CertificateId: string;
}

export interface DeleteIoTCertificateRequest {
  requestType: RequestTypes;
  resourceProperties: DeleteIoTCertificateProperties;
}
