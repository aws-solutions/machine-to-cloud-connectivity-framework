// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Iot from 'aws-sdk/clients/iot';
import IotData from 'aws-sdk/clients/iotdata';
import Logger, { LoggingLevel } from '../logger';
import { IoTEndpointType, PublishIoTTopicMessageRequest } from '../types/iot-handler-types';
import { getAwsSdkOptions } from '../utils';

const { LOGGING_LEVEL } = process.env;
const iot = new Iot(getAwsSdkOptions());
const logger = new Logger('IoTHandler', LOGGING_LEVEL);

export default class IoTHandler {
  private iotDataAtsEndpoint: string;
  private iotData: IotData;

  constructor() {
    if (process.env.IOT_ENDPOINT) {
      this.iotDataAtsEndpoint = process.env.IOT_ENDPOINT;
      this.iotData = new IotData(getAwsSdkOptions({ endpoint: this.iotDataAtsEndpoint }));
    }
  }

  /**
   * Initializes the handler by setting the IoT data ATS endpoint address and IoT data object.
   * If the IoT data ATS endpoint address already exists, it does not call `describeIoTEndpoint()`.
   */
  async init(): Promise<void> {
    this.iotDataAtsEndpoint = await this.describeIoTEndpoint('iot:Data-ATS');
    this.iotData = new IotData(getAwsSdkOptions({ endpoint: this.iotDataAtsEndpoint }));
  }

  /**
   * Describes the IoT endpoint.
   * If the IoT endpoint address exists, it does not call the AWS SDK API.
   * @param endpointType The IoT endpoint type
   * @returns The IoT endpoint address
   */
  async describeIoTEndpoint(endpointType: IoTEndpointType): Promise<string> {
    logger.log(LoggingLevel.DEBUG, 'Describing IoT endpoint: ', endpointType);

    if (endpointType === 'iot:Data-ATS' && !this.isDataAtsEndpointEmpty()) {
      return this.iotDataAtsEndpoint;
    }

    const params: Iot.DescribeEndpointRequest = { endpointType };
    const response = await iot.describeEndpoint(params).promise();
    return response.endpointAddress;
  }

  /**
   * Publishes a message to the IoT topic.
   * The Greengrass v2 subscribes the `job` messages to control connection components.
   * The `info` and `error` messages will be sent to the IoT rule engine.
   * @param params The connection name, the message type, and the data
   */
  async publishIoTTopicMessage(params: PublishIoTTopicMessageRequest): Promise<void> {
    /**
     * To prevent the possibility that the IoT endpoint address doesn't exist,
     * it checks and call `init()` to set the IoT endpoint address.
     * Since `IotData` requires the IoT endpoint address, this step is necessary.
     */
    if (this.isDataAtsEndpointEmpty()) {
      await this.init();
    }

    const { connectionName, type, data } = params;

    logger.log(
      LoggingLevel.DEBUG,
      `Publishing an IoT topic message to ${this.iotDataAtsEndpoint}`,
      `connectionName: ${connectionName}`,
      `type: ${type}`,
      `data: ${JSON.stringify(data, null, 2)}`
    );

    const publishParams: IotData.PublishRequest = {
      topic: `m2c2/${type}/${connectionName}`,
      qos: 1,
      payload: JSON.stringify(data)
    };
    await this.iotData.publish(publishParams).promise();
  }

  /**
   * Creates the IoT keys and certificate.
   * @returns The IoT keys and certificate
   */
  async createKeysAndCertificate() {
    logger.log(LoggingLevel.DEBUG, 'Creating keys and certificate');

    return iot.createKeysAndCertificate({ setAsActive: true }).promise();
  }

  /**
   * Gets the list of all things of the principal.
   * @param principal The principal
   * @returns The list of things
   */
  public async getPrincipalThings(principal: string): Promise<string[]> {
    logger.log(LoggingLevel.DEBUG, `Getting principal things: principal: ${principal}`);

    const things: string[] = [];
    let nextToken: string;

    do {
      const principalThings = await iot.listPrincipalThings({ principal, nextToken }).promise();
      things.push(...principalThings.things);
      nextToken = principalThings.nextToken;
    } while (typeof nextToken !== 'undefined' && nextToken);

    return things;
  }

  /**
   * Updates the IoT certificate.
   * @param params The certificate ID and the certificate new status
   */
  async updateCertificate(params: Iot.UpdateCertificateRequest): Promise<void> {
    logger.log(
      LoggingLevel.DEBUG,
      `Updating certificate, certificateId: ${params.certificateId}, newStatus: ${params.newStatus}`
    );

    await iot.updateCertificate(params).promise();
  }

  /**
   * Deletes the IoT certificate.
   * @param certificateId The certificate ID
   */
  async deleteCertificate(certificateId: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting certificate, certificateId: ${certificateId}`);

    await iot.deleteCertificate({ certificateId, forceDelete: true }).promise();
  }

  /**
   * Creates an IoT role alias.
   * @param params The role alias and ARN
   */
  async createRoleAlias(params: Iot.CreateRoleAliasRequest): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Creating role alias, role alias: ${params.roleAlias}, role ARN: ${params.roleArn}`);

    await iot.createRoleAlias(params).promise();
  }

  /**
   * Deletes an IoT role alias.
   * @param roleAlias The role alias
   */
  async deleteRoleAlias(roleAlias: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting role alias, role alias: ${roleAlias}`);

    await iot.deleteRoleAlias({ roleAlias }).promise();
  }

  /**
   * Checks if the IoT data ATS endpoint is empty or not.
   * @returns When the IoT data ATS endpoint is empty, return true.
   */
  private isDataAtsEndpointEmpty(): boolean {
    return typeof this.iotDataAtsEndpoint === 'undefined' || this.iotDataAtsEndpoint.trim() === '';
  }

  /**
   * Creates an IoT thing.
   * @param thingName The thing name
   * @returns The IoT thing ARN
   */
  public async createThing(thingName: string): Promise<string> {
    logger.log(LoggingLevel.DEBUG, `Creating thing, thingName: ${thingName}`);

    const thing = await iot.createThing({ thingName }).promise();
    return thing.thingArn;
  }

  /**
   * Deletes an IoT thing.
   * @param thingName The thing name
   */
  public async deleteThing(thingName: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting thing, thingName: ${thingName}`);

    await iot.deleteThing({ thingName }).promise();
  }

  /**
   * Gets an IoT thing.
   * @param thingName The thing name
   * @returns The IoT thing detailed information
   */
  public async getThing(thingName: string): Promise<Iot.DescribeThingResponse> {
    logger.log(LoggingLevel.DEBUG, `Getting thing, thingName: ${thingName}`);

    return iot.describeThing({ thingName }).promise();
  }

  /**
   * Attaches a thing principal.
   * @param params The thing name and principal
   */
  public async attachThingPrincipal(params: Iot.AttachThingPrincipalRequest): Promise<void> {
    logger.log(
      LoggingLevel.DEBUG,
      `Attaching thing principal, thing: ${params.thingName}, principal: ${params.principal}`
    );

    await iot.attachThingPrincipal(params).promise();
  }

  /**
   * Detaches a thing principal.
   * @param params The thing name and principal
   */
  public async detachThingPrincipal(params: Iot.DetachThingPrincipalRequest) {
    logger.log(
      LoggingLevel.DEBUG,
      `Detaching thing principal, thing: ${params.thingName}, principal: ${params.principal}`
    );

    await iot.detachThingPrincipal(params).promise();
  }
}
