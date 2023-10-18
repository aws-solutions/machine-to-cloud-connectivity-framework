// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import React, { FormEvent, useState } from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import OpcDaForm from './OpcDaForm';
import OpcUaForm from './OpcUaForm';
import { checkErrors, handleValueChange } from './connection-form-utils';
import EmptyRow from '../../components/EmptyRow';
import EmptyCol from '../../components/EmptyCol';
import { LoadingSpinner } from '../../components/Loading';
import MessageModal from '../../components/MessageModal';
import { requestApi } from '../../util/apis';
import {
  ConnectionControl,
  ConnectionDefinition,
  CreateUpdateConnectionResponse,
  FormControlElement,
  GetConnectionResponse,
  KeyStringValue,
  MachineProtocol,
  MessageModalType
} from '../../util/types';
import { INIT_CONNECTION, buildConnectionDefinition, getConditionalValue, getErrorMessage } from '../../util/utils';
import { ConnectionHook } from '../../hooks/ConnectionHook';
import OsiPiForm from './OsiPiForm';

const logger = new Logger('ConnectionForm');

/**
 * Renders the connection form.
 * @returns The connection form
 */
export default function ConnectionForm(): React.JSX.Element {
  const { connectionName } = useParams<{ connectionName: string }>();
  const [loading, setLoading] = useState<boolean>(false);
  const [connection, setConnection] = useState<GetConnectionResponse>(INIT_CONNECTION);
  const [params, setParams] = useState<ConnectionDefinition>();
  const [errors, setErrors] = useState<KeyStringValue>({});
  const [showConfirmMessageModal, setShowConfirmMessageModal] = useState<boolean>(false);
  const [showMessageMessageModal, setShowMessageMessageModal] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<string | React.ReactNode>('');
  const { close, greengrassCoreDevices } = ConnectionHook({
    setConnection,
    setMessageModalMessage,
    setShowMessageMessageModal,
    connectionName
  });
  const change = (event: React.ChangeEvent<FormControlElement>) => {
    handleValueChange({ connection, errors, event, setConnection, setErrors });
  };

  /**
   * Handles an error to create or update a connection.
   * @param error The error
   */
  function handleError(error: unknown): void {
    const errorMessage = getErrorMessage(error);
    logger.error(errorMessage);

    setShowConfirmMessageModal(false);
    setShowMessageMessageModal(true);
    setMessageModalMessage(
      <Alert variant="danger">
        {getConditionalValue<string>(
          connectionName,
          I18n.get('error.message.update.connection'),
          I18n.get('error.message.create.connection')
        )}
        <br />
        {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        <br />
        <br />
        {I18n.get('error.message.implementation.guide')}
      </Alert>
    );
  }

  /**
   * Handles the connection deployment and update.
   * @param event The connection handle form event
   */
  async function handleConnection(event: FormEvent): Promise<void> {
    event.preventDefault();

    try {
      const connectionDefinition: ConnectionDefinition = {
        control: getConditionalValue<ConnectionControl>(
          connectionName,
          ConnectionControl.UPDATE,
          ConnectionControl.DEPLOY
        ),
        connectionName: connection.connectionName,
        area: connection.area,
        greengrassCoreDeviceName: connection.greengrassCoreDeviceName,
        machineName: connection.machineName,
        process: connection.process,
        protocol: connection.protocol,
        sendDataToIoTSiteWise: connection.sendDataToIoTSiteWise,
        sendDataToIoTTopic: connection.sendDataToIoTTopic,
        sendDataToKinesisDataStreams: connection.sendDataToKinesisDataStreams,
        sendDataToTimestream: connection.sendDataToTimestream,
        siteName: connection.siteName,
        logLevel: connection.logLevel
      };
      const newErrors = await checkErrors({ connection, connectionDefinition });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
      } else {
        setErrors({});
        setParams(connectionDefinition);
        setShowConfirmMessageModal(true);
      }
    } catch (error) {
      handleError(error);
    }
  }

  /**
   * Manages to create or update a connection.
   * @param buildParams The build connection definition request parameters
   */
  async function manageConnection(buildParams: ConnectionDefinition): Promise<void> {
    setLoading(true);

    try {
      const connectionDefinition = buildConnectionDefinition(buildParams);
      const response = (await requestApi({
        method: 'post',
        path: '/connections',
        options: {
          body: connectionDefinition
        }
      })) as CreateUpdateConnectionResponse;
      const message = I18n.get(
        getConditionalValue<string>(connectionName, 'info.message.update.connection', 'info.message.create.connection')
      ).replace('{}', response.connectionName);

      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <>
          <span>{message}</span>
          <br />
          <span>{I18n.get('info.message.background.running')}</span>
        </>
      );
    } catch (error) {
      handleError(error);
    }

    setLoading(false);
  }

  return (
    <Container>
      <Breadcrumb>
        <LinkContainer to="/">
          <Breadcrumb.Item>{I18n.get('manage.connections')}</Breadcrumb.Item>
        </LinkContainer>
        <Breadcrumb.Item active>
          {getConditionalValue(
            connectionName,
            `${I18n.get('update.connection')}: ${connectionName}`,
            I18n.get('create.connection')
          )}
        </Breadcrumb.Item>
      </Breadcrumb>
      <Card>
        <Card.Body>
          <Form onSubmit={handleConnection}>
            <Form.Group>
              <Form.Label>
                {I18n.get('greengrass.core.device.name')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.existing.greengrass.core.device.name')}</Form.Text>
              <Form.Control
                id="greengrassCoreDeviceName"
                as="select"
                onChange={change}
                isInvalid={!!errors.greengrassCoreDeviceName}
                value={connection.greengrassCoreDeviceName}
                disabled={connectionName !== undefined}>
                <option value="">{I18n.get('select')}</option>
                {greengrassCoreDevices.map(greengrassCoreDevice => (
                  <option key={`greengrass-core-device-${greengrassCoreDevice}`} value={greengrassCoreDevice}>
                    {greengrassCoreDevice}
                  </option>
                ))}
              </Form.Control>
              <Form.Control.Feedback type="invalid">{errors.greengrassCoreDeviceName}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('connection.name')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.connection.name')}</Form.Text>
              <Form.Control
                id="connectionName"
                type="text"
                required
                disabled={connectionName !== undefined}
                defaultValue={connection.connectionName}
                placeholder={I18n.get('placeholder.connection.name')}
                onChange={change}
                isInvalid={!!errors.connectionName}
              />
              <Form.Control.Feedback type="invalid">{errors.connectionName}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('site.name')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.site.name')}</Form.Text>
              <Form.Control
                id="siteName"
                type="text"
                required
                defaultValue={connection.siteName}
                placeholder={I18n.get('placeholder.site.name')}
                onChange={change}
                isInvalid={!!errors.siteName}
              />
              <Form.Control.Feedback type="invalid">{errors.siteName}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('area')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.area')}</Form.Text>
              <Form.Control
                id="area"
                type="text"
                required
                defaultValue={connection.area}
                placeholder={I18n.get('placeholder.area')}
                onChange={change}
                isInvalid={!!errors.area}
              />
              <Form.Control.Feedback type="invalid">{errors.area}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('process')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.process')}</Form.Text>
              <Form.Control
                id="process"
                type="text"
                required
                defaultValue={connection.process}
                placeholder={I18n.get('placeholder.process')}
                onChange={change}
                isInvalid={!!errors.process}
              />
              <Form.Control.Feedback type="invalid">{errors.process}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('machine.name')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.machine.name')}</Form.Text>
              <Form.Control
                id="machineName"
                type="text"
                required
                defaultValue={connection.machineName}
                placeholder={I18n.get('placeholder.machine.name')}
                onChange={change}
                isInvalid={!!errors.machineName}
              />
              <Form.Control.Feedback type="invalid">{errors.machineName}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('connector.log.level')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.logLevel')}</Form.Text>
              <Form.Control id="logLevel" as="select" onChange={change} value={connection.logLevel}>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Error</option>
                <option value="CRITICAL">Critical</option>
                <option value="DEBUG">Debug</option>
              </Form.Control>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('send.data.to')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.send.data.to')}</Form.Text>
              <Form.Group>
                <Form.Check
                  inline
                  type="checkbox"
                  id="sendDataToIoTSiteWise"
                  label={I18n.get('iot.sitewise')}
                  checked={connection.sendDataToIoTSiteWise}
                  onChange={change}
                  isInvalid={!!errors.sendDataTo}
                />
                <EmptyCol />
                <Form.Check
                  inline
                  type="checkbox"
                  id="sendDataToIoTTopic"
                  label={I18n.get('iot.topic')}
                  checked={connection.sendDataToIoTTopic}
                  onChange={change}
                  isInvalid={!!errors.sendDataTo}
                />
                <EmptyCol />
                <Form.Check
                  inline
                  type="checkbox"
                  id="sendDataToKinesisDataStreams"
                  label={I18n.get('kinesis.data.streams')}
                  checked={connection.sendDataToKinesisDataStreams}
                  onChange={change}
                  isInvalid={!!errors.sendDataTo}
                />
                <EmptyCol />
                <Form.Check
                  inline
                  type="checkbox"
                  id="sendDataToTimestream"
                  label={I18n.get('timestream')}
                  checked={connection.sendDataToTimestream}
                  onChange={change}
                  isInvalid={!!errors.sendDataTo}
                />
                <Form.Control.Feedback type="invalid">{errors.sendDataTo}</Form.Control.Feedback>
              </Form.Group>
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {I18n.get('protocol')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.protocol')}</Form.Text>
              <Form.Control
                id="protocol"
                as="select"
                onChange={change}
                value={connection.protocol}
                disabled={connectionName !== undefined}>
                <option value={MachineProtocol.OPCDA}>OPC DA</option>
                <option value={MachineProtocol.OPCUA}>OPC UA</option>
                <option value={MachineProtocol.OSIPI}>OSI PI</option>
              </Form.Control>
            </Form.Group>
            {connection.protocol === MachineProtocol.OPCDA && (
              <OpcDaForm connection={{ ...connection }} onChange={change} errors={errors} />
            )}
            {connection.protocol === MachineProtocol.OPCUA && (
              <OpcUaForm connection={{ ...connection }} onChange={change} errors={errors} />
            )}
            {connection.protocol === MachineProtocol.OSIPI && (
              <OsiPiForm connection={{ ...connection }} onChange={change} errors={errors} />
            )}
            <EmptyRow />
            <Row>
              <Col className="justify-content-center grid">
                <ButtonGroup>
                  <Button
                    id="connection-form-submit-button"
                    size="sm"
                    className="uppercase-text"
                    type="submit"
                    disabled={loading}>
                    <LoadingSpinner loading={loading} />
                    {getConditionalValue(connectionName, I18n.get('update'), I18n.get('create'))}
                  </Button>
                  <EmptyCol />
                  <Button
                    id="connection-form-cancel-button"
                    size="sm"
                    className="uppercase-text"
                    onClick={() => close()}
                    disabled={loading}
                    variant="secondary">
                    {I18n.get('cancel')}
                  </Button>
                </ButtonGroup>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      <EmptyRow />
      <MessageModal
        show={showConfirmMessageModal}
        hide={() => setShowConfirmMessageModal(false)}
        message={getConditionalValue<string>(
          connectionName,
          I18n.get('info.message.update.connection.confirm'),
          I18n.get('info.message.create.connection.confirm')
        )}
        modalType={MessageModalType.CONFIRM}
        confirmAction={() => manageConnection(params as ConnectionDefinition)}
      />
      <MessageModal
        show={showMessageMessageModal}
        hide={() => setShowMessageMessageModal(false)}
        message={messageModalMessage}
        modalType={MessageModalType.MESSAGE}
        confirmAction={() => close()}
      />
    </Container>
  );
}
