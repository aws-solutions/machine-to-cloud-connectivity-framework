// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Iot from 'aws-sdk/clients/iot';
import IotData from 'aws-sdk/clients/iotdata';
import Logger, { LoggingLevel } from './logger';
import { IoTHandlerTypes } from './types';
import { getAwsSdkOptions } from './utils';

const { IOT_ENDPOINT, LOGGING_LEVEL } = process.env;
const iot = new Iot(getAwsSdkOptions());
const logger = new Logger('IoTHandler', LOGGING_LEVEL);

/**
 * @class The IoT handler for the IoT actions
 */
export default class IoTHandler {
  private iotEndpointAddress: string;

  constructor() {
    if (IOT_ENDPOINT) {
      this.iotEndpointAddress = IOT_ENDPOINT;
    }
  }

  /**
   * Initializes the handler by setting the IoT endpoint address.
   * If the IoT endpoint address already exists, it does not call `describeIoTEndpoint()`.
   */
  async init(): Promise<void> {
    if (!this.iotEndpointAddress || this.iotEndpointAddress.trim() === '') {
      this.iotEndpointAddress = await this.describeIoTEndpoint();
    }
  }

  /**
   * Describes the IoT endpoint.
   * If the IoT endpoint address exists, it does not call the AWS SDK API.
   * @returns The IoT endpoint address
   */
  async describeIoTEndpoint(): Promise<string> {
    logger.log(LoggingLevel.DEBUG, 'Describing IoT endpoint');

    if (this.iotEndpointAddress && this.iotEndpointAddress.trim() !== '') {
      return this.iotEndpointAddress;
    }

    const params: Iot.DescribeEndpointRequest = { endpointType: 'iot:Data-ATS' };
    const response = await iot.describeEndpoint(params).promise();
    return response.endpointAddress;
  }

  /**
   * Publishes a message to the IoT topic.
   * The Greengrass subscription will send the `job` messages to control machines.
   * The `error` messages will be sent to the IoT rule engine.
   * @param connectionName The connection name of the machine
   * @param type The IoT topic message type (submit, error)
   * @param data The data to send to the IoT topic
   */
  async publishIoTTopicMessage(connectionName: string, type: IoTHandlerTypes.IotMessageTypes, data: object): Promise<void> {
    /**
     * To prevent the possibility that the IoT endpoint address doesn't exist,
     * it checks and call `init()` to set the IoT endpoint address.
     * Since `IotData` requires the IoT endpoint address, this step is necessary.
     */
    if (!this.iotEndpointAddress || this.iotEndpointAddress.trim() === '') {
      await this.init();
    }

    logger.log(LoggingLevel.DEBUG, `Publishing an IoT topic message to ${this.iotEndpointAddress}`, `connectionName: ${connectionName}`, `type: ${type}`, `data: ${JSON.stringify(data, null, 2)}`);

    const iotData = new IotData(getAwsSdkOptions({ endpoint: this.iotEndpointAddress }));
    const params: IotData.PublishRequest = {
      topic: `m2c2/${type}/${connectionName}`,
      qos: 1,
      payload: JSON.stringify(data)
    };
    await iotData.publish(params).promise();
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
   * Gets the list of thing principals.
   * @param thingName The thing name for principals
   * @returns The list of thing principals
   */
  async getThingPrincipals(thingName: string): Promise<string[] | undefined> {
    logger.log(LoggingLevel.DEBUG, `Getting thing principals, thingName: ${thingName}`);

    const thingPrincipals = await iot.listThingPrincipals({ thingName }).promise();
    return thingPrincipals.principals;
  }


  /**
   * Updates the IoT certificate.
   * @param certificateId The certificate ID
   * @param newStatus The certificate new status
   */
  async updateCertificate(certificateId: string, newStatus: IoTHandlerTypes.UpdateCertificateStatus): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Updating certificate, certificateId: ${certificateId}, newStatus: ${newStatus}`);

    await iot.updateCertificate({ certificateId, newStatus }).promise();
  }

  /**
   * Deletes the IoT certificate.
   * @param certificateId The certificate ID
   */
  async deleteCertificate(certificateId: string): Promise<void> {
    logger.log(LoggingLevel.DEBUG, `Deleting certificate, certificateId: ${certificateId}`);

    await iot.deleteCertificate({ certificateId, forceDelete: true }).promise();
  }
}