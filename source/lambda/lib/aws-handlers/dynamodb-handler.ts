// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { LambdaError } from '../errors';
import Logger, { LoggingLevel } from '../logger';
import {
  BuildUpdateExpressionRequest,
  GetConnectionResponse,
  GetConnectionsItem,
  GetConnectionsResponse,
  GetGreengrassCoreDevicesResponse,
  GetLogsResponse,
  GreengrassCoreDeviceItem,
  LogItem,
  PageItems,
  PaginationResponse,
  UpdateConnectionsRequest,
  UpdateGreengrassCoreDeviceRequest
} from '../types/dynamodb-handler-types';
import { ConnectionDefinition, MachineProtocol } from '../types/solution-common-types';
import { getAwsSdkOptions } from '../utils';

const { LOGGING_LEVEL } = process.env;
const dynamoDb = new DocumentClient(getAwsSdkOptions());
const logger = new Logger('DynamoDBHandler', LOGGING_LEVEL);

export default class DynamoDBHandler {
  private readonly connectionTable: string;
  private readonly greengrassCoreDevicesTable: string;
  private readonly logsTable: string;
  private readonly pageSize: number;

  constructor() {
    const { CONNECTION_DYNAMODB_TABLE, GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE, LOGS_DYNAMODB_TABLE } = process.env;
    const { PAGE_SIZE } = process.env;

    this.connectionTable = CONNECTION_DYNAMODB_TABLE;
    this.greengrassCoreDevicesTable = GREENGRASS_CORE_DEVICES_DYNAMODB_TABLE;
    this.logsTable = LOGS_DYNAMODB_TABLE;
    this.pageSize = isNaN(parseInt(PAGE_SIZE)) ? 50 : parseInt(PAGE_SIZE);
  }

  /**
   * Gets connections from the connection DynamoDB table.
   * @param nextToken The next token to scan the result
   * @returns The connections from the connection DynamoDB table
   */
  public async getConnections(nextToken?: string): Promise<GetConnectionsResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting connections, nextToken: ${nextToken}`);

    const response = await this.scanTable(this.connectionTable, nextToken);
    const items: GetConnectionResponse[] = <GetConnectionResponse[]>response.items;
    const connections: GetConnectionsItem[] = [];

    for (const item of items) {
      connections.push({
        connectionName: item.connectionName,
        machineName: item.machineName,
        logLevel: item.logLevel,
        protocol: item.protocol,
        status: item.control,
        sendDataToIoTSiteWise: item.sendDataToIoTSiteWise,
        sendDataToIoTTopic: item.sendDataToIoTTopic,
        sendDataToKinesisDataStreams: item.sendDataToKinesisDataStreams,
        sendDataToTimestream: item.sendDataToTimestream,
        sendDataToHistorian: item.sendDataToHistorian,
        historianKinesisDatastreamName: item.historianKinesisDatastreamName
      });
    }

    return {
      connections: connections,
      nextToken: response.nextToken
    };
  }

  /**
   * Gets a connection detail.
   * @param connectionName The connection name to get a connection detail
   * @returns A connection detail
   * @throws `DynamoDBHandlerError` when the connection does not exist.
   */
  public async getConnection(connectionName: string): Promise<GetConnectionResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting a connection, connectionName: ${connectionName}`);

    const params: DocumentClient.GetItemInput = {
      TableName: this.connectionTable,
      Key: { connectionName }
    };

    const result = await dynamoDb.get(params).promise();
    if (!result.Item) {
      throw new LambdaError({
        message: `\`${connectionName}\` does not exist.`,
        name: 'DynamoDBHandlerError',
        statusCode: 404
      });
    }

    return <GetConnectionResponse>result.Item;
  }

  /**
   * Gets the OPC UA connection by the server name. Since the server name for OPC UA is unique,
   * it returns the connection with the server name or an empty object.
   * @param serverName The OPC UA server name
   * @returns The OPC UA connection with the server name
   */
  public async getOpcUaConnectionByServerName(
    serverName: string
  ): Promise<GetConnectionResponse | Record<string, never>> {
    logger.log(LoggingLevel.DEBUG, `Getting OPC UA connection by server name, serverName: ${serverName}`);

    let nextToken: string | undefined;

    do {
      const response = await this.scanTable(this.connectionTable, nextToken);
      const opcUaConnection = (<GetConnectionResponse[]>response.items).find(
        (connection: GetConnectionResponse) =>
          connection.protocol === MachineProtocol.OPCUA && connection.opcUa.serverName === serverName
      );

      if (opcUaConnection) {
        return opcUaConnection;
      }

      nextToken = response.nextToken;
    } while (nextToken);

    return {};
  }

  /**
   * Updates the connection control.
   * @param input The input values to update the connection information
   * @returns The result of the DynamoDB update
   */
  public async updateConnection(input: UpdateConnectionsRequest): Promise<DocumentClient.UpdateItemOutput> {
    logger.log(LoggingLevel.DEBUG, `Updating a connection: ${JSON.stringify(input, null, 2)}`);

    const timestamp = new Date().toISOString();
    const params: DocumentClient.UpdateItemInput = {
      TableName: this.connectionTable,
      Key: { connectionName: input.connectionName },
      UpdateExpression: 'set #timestamp = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': timestamp
      },
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      }
    };
    const updateInput = { ...input };
    delete updateInput.connectionName;

    this.buildUpdateParameters({
      apiParams: params,
      updateInput
    });

    return dynamoDb.update(params).promise();
  }

  /**
   * Adds a connection into the connection DynamoDB table.
   * This one does not validate the connection definition since the connection definition should be validated before.
   * @param connectionDefinition The connection definition
   * @returns The new connection item
   */
  public async addConnection(connectionDefinition: ConnectionDefinition): Promise<GetConnectionsItem> {
    logger.log(LoggingLevel.DEBUG, `Adding a connection: ${JSON.stringify(connectionDefinition, null, 2)}`);

    const timestamp = new Date().toISOString();
    const params: DocumentClient.PutItemInput = {
      TableName: this.connectionTable,
      Item: {
        connectionName: connectionDefinition.connectionName,
        greengrassCoreDeviceName: connectionDefinition.greengrassCoreDeviceName,
        control: connectionDefinition.control,
        protocol: connectionDefinition.protocol,
        area: connectionDefinition.area,
        machineName: connectionDefinition.machineName,
        process: connectionDefinition.process,
        logLevel: connectionDefinition.logLevel,
        sendDataToIoTSiteWise: !!connectionDefinition.sendDataToIoTSiteWise,
        sendDataToIoTTopic: !!connectionDefinition.sendDataToIoTTopic,
        sendDataToKinesisDataStreams:
          connectionDefinition.sendDataToKinesisDataStreams !== undefined
            ? connectionDefinition.sendDataToKinesisDataStreams
            : true,
        sendDataToTimestream: !!connectionDefinition.sendDataToTimestream,
        sendDataToHistorian: !!connectionDefinition.sendDataToHistorian,
        historianKinesisDatastreamName: connectionDefinition.historianKinesisDatastreamName,
        siteName: connectionDefinition.siteName,
        timestamp: timestamp
      }
    };

    switch (connectionDefinition.protocol) {
      case MachineProtocol.OPCDA:
        params.Item.opcDa = connectionDefinition.opcDa;
        break;
      case MachineProtocol.OPCUA:
        params.Item.opcUa = connectionDefinition.opcUa;
        break;
      case MachineProtocol.OSIPI:
        params.Item.osiPi = connectionDefinition.osiPi;
        break;
<<<<<<< HEAD
=======
      case MachineProtocol.MODBUSTCP:
        params.Item.modbusTcp = connectionDefinition.modbusTcp;
        break;
>>>>>>> main
      default:
        throw new LambdaError({
          message: `Unsupported protocol: ${connectionDefinition.protocol}`,
          name: 'DynamoDBHandlerError',
          statusCode: 400
        });
    }

    await dynamoDb.put(params).promise();
    return {
      connectionName: params.Item.connectionName,
      protocol: params.Item.protocol,
      status: params.Item.control,
      sendDataToIoTSiteWise: params.Item.sendDataToIoTSiteWise,
      sendDataToIoTTopic: params.Item.sendDataToIoTTopic,
      sendDataToKinesisDataStreams: params.Item.sendDataToKinesisDataStreams,
      sendDataToTimestream: params.Item.sendDataToTimestream,
<<<<<<< HEAD
=======
      sendDataToHistorian: params.Item.sendDataToHistorian,
      historianKinesisDatastreamName: params.Item.historianKinesisDatastreamName,
>>>>>>> main
      machineName: params.Item.machineName,
      logLevel: params.Item.logLevel
    };
  }

  /**
   * Deletes the connection DynamoDB table item.
   * @param connectionName The connection name to delete
   */
  public async deleteConnection(connectionName: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting a connection, connectionName: ${connectionName}`);

    const params: DocumentClient.DeleteItemInput = {
      TableName: this.connectionTable,
      Key: { connectionName }
    };

    await dynamoDb.delete(params).promise();
  }

  /**
   * Gets logs from the logs DynamoDB table.
   * @param nextToken The next token to scan the result
   * @returns The logs from the logs DynamoDB table
   */
  public async getLogs(nextToken?: string): Promise<GetLogsResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting logs, nextToken: ${nextToken}`);

    const response = await this.scanTable(this.logsTable, nextToken);

    return {
      logs: <LogItem[]>response.items,
      nextToken: response.nextToken
    };
  }

  /**
   * Gets logs of the connection name from the logs DynamoDB table.
   * @param connectionName The connection name to query the logs
   * @param nextToken The next token to query the result
   * @returns The logs of the connection name from the logs DynamoDB table
   */
  public async getLogsByConnection(connectionName: string, nextToken?: string): Promise<GetLogsResponse> {
    logger.log(
      LoggingLevel.DEBUG,
      `Getting logs by connection, connectionName: ${connectionName}, nextToken: ${nextToken}`
    );

    const params: DocumentClient.QueryInput = {
      TableName: this.logsTable,
      KeyConditionExpression: 'connectionName = :connectionName',
      ExpressionAttributeValues: {
        ':connectionName': connectionName
      },
      ScanIndexForward: false,
      Limit: this.pageSize + 1 // intentional plus due to DynamoDB response
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(decodeURI(nextToken));
    }

    const result = await dynamoDb.query(params).promise();
    const response = this.correctDynamoDBPageItems(result);

    return {
      logs: <LogItem[]>response.items,
      nextToken: response.nextToken
    };
  }

  /**
   * Adds a Greengrass core device into the Greengrass core device DynamoDB table.
   * @param input The Greengrass core device input including name, created by, and IoT SiteWise gateway ID (optional)
   */
  public async addGreengrassCoreDevice(input: Omit<GreengrassCoreDeviceItem, 'numberOfConnections'>): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Adding a Greengrass core device: ${JSON.stringify(input, null, 2)}`);

    const params: DocumentClient.PutItemInput = {
      TableName: this.greengrassCoreDevicesTable,
      Item: {
        ...input,
        numberOfConnections: 0
      }
    };

    await dynamoDb.put(params).promise();
  }

  /**
   * Deletes a Greengrass core device DynamoDB table item.
   * @param name The Greengrass core device name
   */
  public async deleteGreengrassCoreDevice(name: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting a Greengrass core device: ${name}`);

    const params: DocumentClient.DeleteItemInput = {
      TableName: this.greengrassCoreDevicesTable,
      Key: { name }
    };

    await dynamoDb.delete(params).promise();
  }

  /**
   * Gets Greengrass core devices from the Greengrass core devices DynamoDB table.
   * @param nextToken The next token to scan the result
   * @returns The Greengrass core devices from the Greengrass core devices DynamoDB table
   */
  public async getGreengrassCoreDevices(nextToken?: string): Promise<GetGreengrassCoreDevicesResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting Greengrass core devices, nextToken: ${nextToken}`);

    const response = await this.scanTable(this.greengrassCoreDevicesTable, nextToken);

    return {
      greengrassCoreDevices: <GreengrassCoreDeviceItem[]>response.items,
      nextToken: response.nextToken
    };
  }

  /**
   * Gets the Greengrass core device information including name, created by, and number of connections.
   * When there is no data in the DynamoDB table, it returns `undefined`.
   * @param name The Greengrass core device name
   * @returns The Greengrass core device information
   */
  public async getGreengrassCoreDevice(name: string): Promise<GreengrassCoreDeviceItem> {
    logger.log(LoggingLevel.DEBUG, `Getting a Greengrass core device, name: ${name}`);

    const params: DocumentClient.GetItemInput = {
      TableName: this.greengrassCoreDevicesTable,
      Key: { name }
    };
    const result = await dynamoDb.get(params).promise();

    return <GreengrassCoreDeviceItem>result.Item;
  }

  /**
   * Updates the Greengrass core device. Only updates the number of connections.
   * @param input The Greengrass core device name and whether to increase the number of connections or not
   */
  public async updateGreengrassCoreDevice(input: UpdateGreengrassCoreDeviceRequest): Promise<void> {
    logger.log(
      LoggingLevel.DEBUG,
      `Updating a Greengrass core device, name: ${input.name}, increment: ${input.increment}`
    );

    const params: DocumentClient.UpdateItemInput = {
      TableName: this.greengrassCoreDevicesTable,
      Key: { name: input.name },
      UpdateExpression: `set numberOfConnections = numberOfConnections ${input.increment ? '+' : '-'} :num`,
      ExpressionAttributeValues: { ':num': 1 }
    };

    await dynamoDb.update(params).promise();
  }

  /**
   * Scans the DynamoDB table.
   * @param tableName The DynamoDB table name to scan
   * @param nextToken The next token which is URI encoded JSON string
   * @returns DynamoDB items and the next token which is URI encoded JSON string
   */
  private async scanTable(tableName: string, nextToken?: string): Promise<PaginationResponse> {
    const params: DocumentClient.ScanInput = {
      TableName: tableName,
      Limit: this.pageSize + 1 // intentional plus due to DynamoDB response
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(decodeURI(nextToken));
    }

    const result = await dynamoDb.scan(params).promise();
    return this.correctDynamoDBPageItems(result);
  }

  /**
   * Corrects the DynamoDB page items as DynamoDB returns the last evaluated key when that's the end of item.
   * It only happens when the number of returned DynamoDB items equals to the limit parameter.
   * @param result The result of scan or query
   * @returns The corrected DynamoDB scan or query items and next token
   */
  private correctDynamoDBPageItems(result: DocumentClient.ScanOutput | DocumentClient.QueryOutput): PaginationResponse {
    const items = result.Items;
    const lastEvaluatedKey = result.LastEvaluatedKey;

    // Processes if DynamoDB returns page size + 1 items
    if (items.length === this.pageSize + 1) {
      const item = items[this.pageSize - 1];

      for (const key in lastEvaluatedKey) {
        lastEvaluatedKey[key] = item[key];
      }

      items.pop();
    }

    const response: PaginationResponse = { items: <PageItems>items };

    if (lastEvaluatedKey) {
      response.nextToken = encodeURI(JSON.stringify(lastEvaluatedKey));
    }

    return response;
  }

  /**
   * Builds the DynamoDB update parameters. It just changes the parameters in memory.
   * @param input The DynamoDB update build parameters
   */
  private buildUpdateParameters(input: BuildUpdateExpressionRequest): void {
    const { apiParams, updateInput } = input;

    for (const key in updateInput) {
      if (typeof updateInput[key] !== 'undefined') {
        apiParams.UpdateExpression = `${apiParams.UpdateExpression}, #${key} = :${key}`;
        apiParams.ExpressionAttributeValues[`:${key}`] = updateInput[key];
        apiParams.ExpressionAttributeNames[`#${key}`] = key;
      }
    }
  }
}
