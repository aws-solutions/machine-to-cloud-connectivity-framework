// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { LambdaError } from './errors';
import Logger, { LoggingLevel } from './logger';
import { DynamoDBHandlerTypes, ConnectionBuilderTypes } from './types';
import { getAwsSdkOptions } from './utils';

const { LOGGING_LEVEL } = process.env;
const dynamoDb = new DocumentClient(getAwsSdkOptions());
const logger = new Logger('DynamoDBHandler', LOGGING_LEVEL);

/**
 * @class DynamoDB handler for DynamoDB tables data
 */
export default class DynamoDBHandler {
  private readonly greengrassGroupId: string;
  private readonly connectionTable: string;
  private readonly logsTable: string;
  private readonly pageSize: number;

  constructor() {
    const { GREENGRASS_GROUP_ID, CONNECTION_DYNAMODB_TABLE, LOGS_DYNAMODB_TABLE, PAGE_SIZE } = process.env;
    this.greengrassGroupId = GREENGRASS_GROUP_ID;
    this.connectionTable = CONNECTION_DYNAMODB_TABLE;
    this.logsTable = LOGS_DYNAMODB_TABLE;
    this.pageSize = isNaN(parseInt(PAGE_SIZE)) ? 50 : parseInt(PAGE_SIZE);
  }

  /**
   * Gets connections from the connection DynamoDB table.
   * @param nextToken The next token to scan the result
   * @returns The connections from the connection DynamoDB table
   */
  public async getConnections(nextToken?: string): Promise<DynamoDBHandlerTypes.GetConnectionsResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting connections, nextToken: ${nextToken}`);

    const response = await this.scanTable(this.connectionTable, nextToken);
    const items: DynamoDBHandlerTypes.GetConnectionResponse[] = response.items;
    const connections: DynamoDBHandlerTypes.GetConnectionsItem[] = [];

    for (let item of items) {
      connections.push({
        connectionName: item.connectionName,
        machineName: item.machineName,
        protocol: item.protocol,
        status: item.control,
        sendDataToIoTSitewise: item.sendDataToIoTSitewise,
        sendDataToIoTTopic: item.sendDataToIoTTopic,
        sendDataToKinesisDataStreams: item.sendDataToKinesisDataStreams
      });
    }

    const connectionsResponse: DynamoDBHandlerTypes.GetConnectionsResponse = { connections: connections };

    if (response.nextToken) {
      connectionsResponse.nextToken = response.nextToken;
    }

    return connectionsResponse;
  }

  /**
   * Gets a connection detail.
   * @param connectionName The connection name to get a connection detail
   * @returns A connection detail
   * @throws `DynamoDBHandlerError` when the connection does not exist.
   */
  public async getConnection(connectionName: string): Promise<DynamoDBHandlerTypes.GetConnectionResponse> {
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

    return result.Item as DynamoDBHandlerTypes.GetConnectionResponse;
  }

  /**
   * Gets the OPC UA connection by the server name. Since the server name for OPC UA is unique,
   * it returns the connection with the server name or an empty object.
   * @param serverName The OPC UA server name
   * @returns The OPC UA connection with the server name
   */
  public async getOpcUaConnectionByServerName(serverName: string): Promise<DynamoDBHandlerTypes.GetConnectionResponse | {}> {
    logger.log(LoggingLevel.DEBUG, `Getting OPC UA connection by server name, serverName: ${serverName}`);

    let nextToken: string | undefined;

    do {
      const response = await this.scanTable(this.connectionTable, nextToken);
      const opcUaConnection = response.items.find(
        (connection: DynamoDBHandlerTypes.GetConnectionResponse) => connection.protocol === ConnectionBuilderTypes.MachineProtocol.OPCUA && connection.opcUa.serverName === serverName
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
   */
  public async updateConnection(input: DynamoDBHandlerTypes.UpdateConnectionsRequest): Promise<DocumentClient.UpdateItemOutput> {
    logger.log(LoggingLevel.DEBUG, `Updating a connection: ${JSON.stringify(input, null, 2)}`);

    const timestamp = new Date().toISOString();
    const params: DocumentClient.UpdateItemInput = {
      TableName: this.connectionTable,
      Key: { connectionName: input.connectionName },
      UpdateExpression: 'set #control = :control, #timestamp = :timestamp',
      ExpressionAttributeValues: {
        ':control': input.control,
        ':timestamp': timestamp
      },
      ExpressionAttributeNames: {
        '#control': 'control',
        '#timestamp': 'timestamp'
      }
    };

    // OPC UA needs to update the `opcUa` as well for `opcUa.source`.
    if (input.opcUa) {
      params.UpdateExpression = `${params.UpdateExpression}, #opcUa = :opcUa`;
      params.ExpressionAttributeValues[':opcUa'] = input.opcUa;
      params.ExpressionAttributeNames['#opcUa'] = 'opcUa';
    }

    return dynamoDb.update(params).promise();
  }

  /**
   * Adds a connection into the connection DynamoDB table.
   * This one does not validate the connection definition since the connection definition should be validated before.
   * @param connectionDefinition The connection definition
   * @returns The new connection item
   */
  public async addConnection(connectionDefinition: ConnectionBuilderTypes.ConnectionDefinition): Promise<DynamoDBHandlerTypes.GetConnectionsItem> {
    logger.log(LoggingLevel.DEBUG, `Adding a connection: ${JSON.stringify(connectionDefinition, null, 2)}`);

    const timestamp = new Date().toISOString();
    const params: DocumentClient.PutItemInput = {
      TableName: this.connectionTable,
      Item: {
        connectionName: connectionDefinition.connectionName,
        control: connectionDefinition.control,
        protocol: connectionDefinition.protocol,
        area: connectionDefinition.area,
        machineName: connectionDefinition.machineName,
        process: connectionDefinition.process,
        sendDataToIoTSitewise: connectionDefinition.sendDataToIoTSitewise !== undefined ? connectionDefinition.sendDataToIoTSitewise : false,
        sendDataToIoTTopic: connectionDefinition.sendDataToIoTTopic !== undefined ? connectionDefinition.sendDataToIoTTopic : false,
        sendDataToKinesisDataStreams: connectionDefinition.sendDataToKinesisDataStreams !== undefined ? connectionDefinition.sendDataToKinesisDataStreams : true,
        siteName: connectionDefinition.siteName,
        timestamp: timestamp,
        greengrassGroupId: this.greengrassGroupId
      }
    };

    switch (connectionDefinition.protocol) {
      case ConnectionBuilderTypes.MachineProtocol.OPCDA:
        params.Item.opcDa = connectionDefinition.opcDa;
        break;
      case ConnectionBuilderTypes.MachineProtocol.OPCUA:
        params.Item.opcUa = connectionDefinition.opcUa;
        break;
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
      sendDataToIoTSitewise: params.Item.sendDataToIoTSitewise,
      sendDataToIoTTopic: params.Item.sendDataToIoTTopic,
      sendDataToKinesisDataStreams: params.Item.sendDataToKinesisDataStreams,
      machineName: params.Item.machineName
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
  public async getLogs(nextToken?: string): Promise<DynamoDBHandlerTypes.GetLogsResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting logs, nextToken: ${nextToken}`);

    const response = await this.scanTable(this.logsTable, nextToken);
    const logsResponse: DynamoDBHandlerTypes.GetLogsResponse = { logs: response.items };

    if (response.nextToken) {
      logsResponse.nextToken = response.nextToken;
    }

    return logsResponse;
  }

  /**
   * Gets logs of the connection name from the logs DynamoDB table.
   * @param connectionName The connection name to query the logs
   * @param nextToken The next token to query the result
   * @returns The logs of the connection name from the logs DynamoDB table
   */
  public async getLogsByConnection(connectionName: string, nextToken?: string): Promise<DynamoDBHandlerTypes.GetLogsResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting logs by connection, connectionName: ${connectionName}, nextToken: ${nextToken}`);

    const params: DocumentClient.QueryInput = {
      TableName: this.logsTable,
      KeyConditionExpression: 'connectionName = :connectionName',
      ExpressionAttributeValues: {
        ':connectionName': connectionName
      },
      ScanIndexForward: false,
      Limit: this.pageSize + 1  // intentional plus due to DynamoDB response
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(decodeURI(nextToken));
    }

    const result = await dynamoDb.query(params).promise();
    const response = this.correctDynamoDBPageItems(result);
    const logsResponse: DynamoDBHandlerTypes.GetLogsResponse = { logs: response.items };

    if (response.nextToken) {
      logsResponse.nextToken = response.nextToken;
    }

    return logsResponse;
  }

  /**
   * Scans the DynamoDB table.
   * @param tableName The DynamoDB table name to scan
   * @param nextToken The next token which is URI encoded JSON string
   * @returns DynamoDB items and the next token which is URI encoded JSON string
   */
  private async scanTable(tableName: string, nextToken?: string): Promise<DynamoDBHandlerTypes.PaginationResponse> {
    const params: DocumentClient.ScanInput = {
      TableName: tableName,
      Limit: this.pageSize + 1  // intentional plus due to DynamoDB response
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
  private correctDynamoDBPageItems(result: DocumentClient.ScanOutput | DocumentClient.QueryOutput): DynamoDBHandlerTypes.PaginationResponse {
    const items = result.Items;
    let lastEvaluatedKey = result.LastEvaluatedKey;

    // Processes if DynamoDB returns page size + 1 items
    if (items.length === this.pageSize + 1) {
      const item = items[this.pageSize - 1];

      for (let key in lastEvaluatedKey) {
        lastEvaluatedKey[key] = item[key];
      }

      items.pop();
    }

    const response: DynamoDBHandlerTypes.PaginationResponse = { items };

    if (lastEvaluatedKey) {
      response.nextToken = encodeURI(JSON.stringify(lastEvaluatedKey));
    }

    return response;
  }
}