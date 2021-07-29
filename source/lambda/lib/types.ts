// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Greengrass from 'aws-sdk/clients/greengrass';

/**
 * The namespace for the message consumer types
 * @namespace MessageConsumerTypes
 */
export namespace MessageConsumerTypes {
  /**
   * The event message type
   * @interface EventMessage
   */
  export interface EventMessage {
    Records: SqsRecord[];
  }

  /**
   * The SQS record type
   * @interface SqsRecord
   */
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
    messageAttributes: {};
    md5OfBody: string;
    eventSource: string;
    eventSourceARN: string;
    awsRegion: string;
  }

  /**
   * The SQS record body type
   * @interface RecordBody
   */
  export interface RecordBody {
    connectionName: string;
    timestamp: number;
    logType: LogType;
    message: string;
    ttl?: number;
  }

  /**
   * DynamoDB batch put request type
   * @interface BatchPutRequest
   */
  export interface BatchPutRequest {
    PutRequest: {
      Item: RecordBody;
    };
  }

  /**
   * @enum The log types
   */
  export enum LogType {
    INFO = 'info',
    ERROR = 'error'
  }
}

/**
 * The namespace for the connection builder types
 * @namespace ConnectionBuilderTypes
 */
export namespace ConnectionBuilderTypes {
  /**
  * The API Gateway request type
  * @interface APIGatewayRequest
  */
  export interface APIGatewayRequest {
    resource: string;
    path: string;
    httpMethod: string;
    headers: { [key: string]: string };
    multiValueHeaders: { [key: string]: string[] };
    queryStringParameters: { [key: string]: string };
    multiValueQueryStringParameters: { [key: string]: string };
    pathParameters: { [key: string]: string };
    stageVariables: { [key: string]: string };
    requestContext: { [key: string]: any };
    body: string;
    isBase64Encoded: string;
  }

  /**
   * The API Gateway response type
   * @interface APIGatewayRequest
   */
  export interface APIGatewayResponse {
    statusCode: number;
    body: string;
    headers?: { [key: string]: string };
    multiValueHeaders?: { [key: string]: string[] };
    isBase64Encoded?: boolean;
  }

  /**
   * The connection definition to control a connection. This will be sent through the API Gateway body.
   * Refer to https://docs.aws.amazon.com/solutions/latest/machine-to-cloud-connectivity-framework/api-specification.html
   * @interface ConnectionDefinition
   */
  export interface ConnectionDefinition {
    connectionName: string;
    control: ConnectionControl;
    protocol: MachineProtocol;
    area?: string;
    machineName?: string;
    opcDa?: OpcDaDefinition;
    opcUa?: OpcUaDefinition;
    process?: string;
    sendDataToIoTSitewise?: boolean;
    sendDataToIoTTopic?: boolean;
    sendDataToKinesisDataStreams?: boolean;
    siteName?: string;
  }

  /**
   * Common connection definition
   * @interface CommonDefinition
   */
  export interface CommonDefinition {
    machineIp: string;
    serverName: string;
  }

  /**
   * OPC DA connection definition
   * @interface OpcDaDefinition
   * @extends CommonDefinition
   */
  export interface OpcDaDefinition extends CommonDefinition {
    interval: number;
    iterations: number;
    listTags?: string[];
    tags?: string[];
  }

  /**
   * OPC UA connection definition
   * @interface OpcUaDefinition
   * @extends CommonDefinition
   */
  export interface OpcUaDefinition extends CommonDefinition {
    port?: number;
    source?: any;
  }

  /**
   * @enum Connection control type
   */
  export enum ConnectionControl {
    DEPLOY = 'deploy',
    START = 'start',
    STOP = 'stop',
    UPDATE = 'update',
    DELETE = 'delete',
    PUSH = 'push',
    PULL = 'pull'
  }

  /**
   * @enum Machine protocol
   */
  export enum MachineProtocol {
    OPCDA = 'opcda',
    OPCUA = 'opcua'
  }

  /**
   * The processConnection function response type
   * @interface ProcessConnectionResponse
   */
  export interface ProcessConnectionResponse {
    connectionName: string;
    control: ConnectionControl;
    result: string;
  }
}

/**
 * The namespace for DynamoDB handler types
 * @namespace DynamoDBHandlerTypes
 */
export namespace DynamoDBHandlerTypes {
  /**
   * The getConnections function connections item
   * @interface GetConnectionsItem
   */
  export interface GetConnectionsItem {
    connectionName: string;
    protocol: ConnectionBuilderTypes.MachineProtocol;
    status: ConnectionBuilderTypes.ConnectionControl;
    sendDataToIoTSitewise: boolean;
    sendDataToIoTTopic: boolean;
    sendDataToKinesisDataStreams: boolean;
    machineName?: string;
  }

  /**
   * The getConnections function response type
   * @interface GetConnectionsResponse
   */
  export interface GetConnectionsResponse {
    connections: GetConnectionsItem[];
    nextToken?: string;
  }

  /**
   * The DynamoDB pagination response type
   * @interface PaginationResponse
   */
  export interface PaginationResponse {
    items: any[];
    nextToken?: string;
  }

  /**
   * The getConnection function response type
   * @interface GetConnectionResponse
   */
  export interface GetConnectionResponse {
    control: ConnectionBuilderTypes.ConnectionControl;
    connectionName: string;
    protocol: ConnectionBuilderTypes.MachineProtocol;
    timestamp: string;
    sendDataToIoTSitewise: boolean;
    sendDataToIoTTopic: boolean;
    sendDataToKinesisDataStreams: boolean;
    area?: string;
    machineName?: string;
    opcDa?: ConnectionBuilderTypes.OpcDaDefinition;
    opcUa?: ConnectionBuilderTypes.OpcUaDefinition;
    process?: string;
    siteName?: string;
  }

  /**
   * The updating a connection request type
   * @interface UpdateConnectionsRequest
   */
  export interface UpdateConnectionsRequest {
    control: ConnectionBuilderTypes.ConnectionControl;
    connectionName: string;
    opcUa?: ConnectionBuilderTypes.OpcUaDefinition;
  }

  /**
   * The getLogs function response type
   * @interface GetLogsResponse
   */
  export interface GetLogsResponse {
    logs: {
      connectionName: string;
      timestamp: number;
      logType: LogType;
      message: string;
      ttl?: number;
    }[];
    nextToken?: string;
  }

  /**
   * @enum Message type
   */
  enum LogType {
    INFO = 'info',
    ERROR = 'error'
  }
}

/**
 * The namespace for the errors types
 * @namespace ErrorsType
 */
export namespace ErrorsType {
  /**
   * The error input type
   * @interface ErrorInput
   */
  export interface ErrorInput {
    message: string;
    name?: string;
    statusCode?: number;
  }
}

/**
 * The namespace for the utils types
 * @namespace UtilsTypes
 */
export namespace UtilsTypes {
  /**
   * The AWS SDK options type
   * @interface AwsSdkOptions
   */
  export interface AwsSdkOptions {
    [key: string]: string;
  }
}

/**
 * The namespace for the validations types
 * @namespace ValidationsTypes
 */
export namespace ValidationsTypes {
  /**
   * Constant variables for validation checks
   */
  export const MAX_CHARACTERS = 30;
  export const MAX_INTERVAL = 30;
  export const MIN_INTERVAL = 0.5;
  export const MIN_ITERATION = 1;
  export const MAX_ITERATION = 30;
  export const MIN_PORT = 1;
  export const MAX_PORT = 65535;
  export const MAX_OPCUA_SERVER_NAME_CHARACTERS = 256;
}

/**
 * The namespace for the Greengrass deployer types
 * @namespace GreengrassDeployerTypes
 */
export namespace GreengrassDeployerTypes {
  /**
   * The Lambda function event type
   * @interface LambdaEvent
   */
  export interface LambdaEventRequest {
    control: ConnectionBuilderTypes.ConnectionControl;
    connectionName: string;
  }
}

/**
 * The namespace for the Lambda handler types
 * @namespace LambdaHandlerTypes
 */
export namespace LambdaHandlerTypes {
  /**
   * The Lambda creation request type
   * @interface CreateLambdaRequest
   */
  export interface CreateLambdaRequest {
    environmentVariables: { [key: string]: string };
    functionType: LambdaFunctionType;
    connectionName: string;
    protocol: ConnectionBuilderTypes.MachineProtocol;
  }

  export enum LambdaFunctionType {
    COLLECTOR = 'collector',
    PUBLISHER = 'publisher'
  }

  /**
   * The Lambda aliast creation request type
   * @interface CreateLambdaAliasRequest
   */
  export interface CreateLambdaAliasRequest {
    functionArn: string;
    functionName: string;
  }
}

/**
 * The namespace for the Greengrass handler types
 * @namespace GreengrassHandlerTypes
 */
export namespace GreengrassHandlerTypes {
  /**
   * The Greengrass handler constructor parameters type
   * @interface ConstructorParameters
   */
  export interface ConstructorParameters {
    area?: string;
    greengrassId?: string;
    connectionName?: string;
    machineName?: string;
    process?: string;
    protocol?: ConnectionBuilderTypes.MachineProtocol;
    sendDataToIoTSitewise?: boolean;
    sendDataToIoTTopic?: boolean;
    sendDataToKinesisDataStreams?: boolean;
    siteName?: string;
  }

  /**
   * The default Greengrass definitions request
   * @interface DefaultDefinitionRequest
   */
  export interface DefaultDefinitionsRequest {
    collectorLambdaFunctionAliasArn?: string;
    publisherLambdaFunctionAliasArn?: string;
  }

  /**
   * The default Greengrass definitions response
   * @interface DefaultDefinitionsResponse
   */
  export interface DefaultDefinitionResponse {
    Connector: any[];
    Core: any[];
    Device: any[];
    Function: any[];
    Logger: any[];
    Resource: any[];
    Subscription: any[];
  }

  /**
   * @enum The Greengrass definitions
   */
  export enum GreengrassDefinitions {
    CONNECTOR = 'Connector',
    CORE = 'Core',
    DEVICE = 'Device',
    FUNCTION = 'Function',
    LOGGER = 'Logger',
    RESOURCE = 'Resource',
    SUBSCRIPTION = 'Subscription'
  }

  /**
   * The update Greengrass definitions request
   * @interface UpdateGreengrassDefinitionsRequest
   */
  export interface UpdateGreengrassDefinitionsRequest {
    greengrassGroupVersion: Greengrass.GetGroupVersionResponse;
    publisherLambdaFunctionAliasArn: string;
    collectorLambdaFunctionAliasArn?: string;
  }

  /**
   * The delete connection from Greengrass definition response
   * @interface DeleteConnectionFromGreengrassDefinitionResponse
   */
  export interface DeleteConnectionFromGreengrassDefinitionResponse {
    newDefinitionVersionArns: { [key: string]: string | undefined };
    lambdaFunctionNames: string[];
  }

  /**
   * @num The Greengrass handler error types
   */
  export enum ErrorTypes {
    CREATE_GREENGRASS_DEFINITION_ERROR = 'CreateGreengrassDefinitionError',
    CREATE_GREENGRASS_DEFINITION_VERSION_ERROR = 'CreateGreengrassDefinitionVersionError',
    CREATE_GREENGRASS_DEPLOYMENT_ERROR = 'CreateGreengrassDeploymentError',
    CREATE_GREENGRASS_GROUP_VERSION_ERROR = 'CreateGreengrassGroupVersionError',
    DELETE_CONNECTION_FROM_GREENGRASS_DEFINITIONS_ERROR = 'DeleteConnectionFromGreengrassDefinitionsError',
    FIND_GREENGRASS_DEFINITION_ERROR = 'FindGreengrassDefinitionError',
    GET_GREENGRASS_DEFINITION_VERSION_ERROR = 'GetGreengrassDefinitionVersionError',
    GET_GREENGRASS_GROUP_LATEST_VERSION_ERROR = 'GetGreengrassGroupLatestVersionError',
    GREENGRASS_DEPLOYMENT_ERROR = 'GreengrassDeploymentError',
    GREENGRASS_GROUP_NOT_FOUND_ERROR = 'GreengrassGroupNotFoundError',
    RESET_GREENGRASS_DEPLOYMENT_ERROR = 'ResetGreengrassDeploymentError',
    UPDATE_GREENGRASS_GROUP_DEFINITION_ERROR = 'UpdateGreengrassGroupDefinitionError'
  }
}

/**
 * The namespace for the custom resource types
 * @namespace CustomResourceTypes
 */
export namespace CustomResourceTypes {
  /**
   * @enum The custom resource request types
   */
  export enum RequestTypes {
    CREATE = 'Create',
    DELETE = 'Delete',
    UPDATE = 'Update'
  }

  /**
   * @enum The custom resource resource properties resource types
   */
  export enum ResourceTypes {
    CREATE_UUID = 'CreateUUID',
    SEND_ANONYMOUS_METRICS = 'SendAnonymousMetrics',
    DESCRIBE_IOT_ENDPOINT = 'DescribeIoTEndpoint',
    COPY_UI_ASSETS = 'CopyUIAssets',
    CREATE_UI_CONFIG = 'CreateUIConfig',
    CREATE_GREENGRASS_CERT_AND_KEYS = 'CreateGGCertAndKeys',
    DELETE_GREENGRASS_RESOURCES = 'DeleteGreengrassResources'
  }

  /**
   * @enum The custom resource status types
   */
  export enum StatusTypes {
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
  }

  /**
   * The Lambda function context type
   * @interface LambdaConext
   */
  export interface LambdaConext {
    getRemainingTimeInMillis: Function;
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: number;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    identity: any;
    clientContext: any;
    callbackWaitsForEmptyEventLoop: boolean;
  }

  /**
   * The custom resource event request type
   * @interface EventRequest
   */
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

  /**
   * @type The resource property types
   */
  type ResourcePropertyTypes = ResourceProperty | SendAnonymousMetricProperties | CopyUiAssetsProperties |
    CreateUiConfigProperties | CreateGreengrassCertAndKeysProperties | DeleteGreengrassResourcesProperties;

  /**
   * The custom resource resource type
   * @interface ResourceProperty
   */
  interface ResourceProperty {
    Resource: ResourceTypes;
  }

  /**
   * Sending anonymous metric custom resource properties type
   * @interface SendAnonymousMetricProperties
   * @extends ResourceProperty
   */
  export interface SendAnonymousMetricProperties extends ResourceProperty {
    ExistingGreengrassGroup: string;
    ExistingKinesisStream: string;
    SolutionUUID: string;
  }

  /**
   * Copying UI assets custom resource properties type
   * @interface CopyUiAssetsProperties
   * @extends ResourceProperty
   */
  export interface CopyUiAssetsProperties extends ResourceProperty {
    DestinationBucket: string;
    ManifestFile: string;
    SourceBucket: string;
    SourcePrefix: string;
  }

  /**
   * Creating UI config custom resource properties type
   * @interface CreateUiConfigProperties
   * @extends ResourceProperty
   */
  export interface CreateUiConfigProperties extends ResourceProperty {
    ApiEndpoint: string;
    DestinationBucket: string;
    ConfigFileName: string;
    IdentityPoolId: string;
    LoggingLevel: string;
    UserPoolId: string;
    WebClientId: string;
  }

  /**
   * The custom resource response type
   * @interface CustomResourceResponse
   */
  export interface CustomResourceResponse {
    Status: StatusTypes;
    Data: any;
  }

  /**
   * Creating Greengrass certificate and keys properties type
   * @interface CreateGreengrassCertAndKeysProperties
   * @extends ResourceProperty
   */
  export interface CreateGreengrassCertAndKeysProperties extends ResourceProperty {
    DestinationBucket: string;
    ThingArn: string;
  }

  /**
   * The Greengreass certificate response type
   * @interface GreengrassCertificateResponse
   */
  export interface GreengrassCertificateResponse {
    certificateId: string;
    certificateArn: string;
    generatedS3URL: string;
  }

  /**
   * Deleting Greengrass resources properties type
   * @interface DeleteGreengrassResourcesProperties
   * @extends ResourceProperty
   */
  export interface DeleteGreengrassResourcesProperties extends ResourceProperty {
    CertificateId: string;
    GreengrassGroupId: string;
    ThingName: string;
  }
}

/**
 * The namespace for the IoT handler types
 * @namespace IoTHandlerTypes
 */
export namespace IoTHandlerTypes {
  /**
   * @enum The IoT topic message type
   */
  export enum IotMessageTypes {
    JOB = 'job',
    INFO = 'info',
    ERROR = 'error'
  }

  /**
   * @type The available updating IoT certificate status type
   */
  export type UpdateCertificateStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'PENDING_TRANSFER' | 'REGISTER_INACTIVE' | 'PENDING_ACTIVATION';
}

/**
 * The namespace for the IoT Sitewise handler types
 * @namespace IoTSitewiseHandlerTypes
 */
export namespace IoTSitewiseHandlerTypes {
  /**
   * Adding gateway capacity configuration request type
   * @interface AddGatewayCapacityConfigurationRequest
   */
  export interface AddGatewayCapacityConfigurationRequest {
    connectionName: string;
    serverName: string;
    machineIp: string;
    port?: number;
  }
}