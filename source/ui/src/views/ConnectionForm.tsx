// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n, Logger } from '@aws-amplify/core';
import React, { useCallback, useEffect, useState } from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { useHistory, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import MessageModal from './MessageModal';
import OpcDaForm from './OpcDaForm';
import OpcUaForm from './OpcUaForm';
import {
  CreateUpdateConnectionResponse, FormControlElement, GetConnectionResponse,
  ConnectionControl, ConnectionDefinition, KeyStringValue, MachineProtocol, MessageModalType
} from '../util/Types';
import { API_NAME, INIT_CONNECTION, buildConnectionDefinition, copyObject, getErrorMessage, validateConnectionDefinition } from '../util/Utils';
import EmptyRow from '../components/EmptyRow';
import EmptyCol from '../components/EmptyCol';

const logger = new Logger('ConnectionForm');

/**
 * Renders the connection form.
 * @returns The connection form
 */
export default function ConnectionForm(): JSX.Element { // NOSONAR: typescript:S3776
  const { connectionName } = useParams<{ connectionName: string }>();
  const history = useHistory();
  const [loading, setLoading] = useState<boolean>(false);
  const [connection, setConnection] = useState<GetConnectionResponse>(INIT_CONNECTION);
  const [params, setParams] = useState<ConnectionDefinition>();
  const [errors, setErrors] = useState<KeyStringValue>({});
  const [showConfirmMessageModal, setShowConfirmMessageModal] = useState<boolean>(false);
  const [showMessagemMessageModal, setShowMessageMessageModal] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<string | React.ReactNode>('');

  /**
   * Closes the connection form, and it goes to the main page.
   */
  const close = useCallback(() => {
    history.push('/');
  }, [history]);

  /**
   * Get a connection. This is for updating connection.
   * If there's no key value for optional values, it sets the default value.
   */
  const getConnection = useCallback(async () => {
    try {
      const encodedconnectionName = encodeURIComponent(connectionName);
      const response: GetConnectionResponse = await API.get(API_NAME, `/connections/${encodedconnectionName}`, {});

      if (response.protocol === MachineProtocol.OPCDA) {
        let listTags: string[] = [];
        let tags: string[] = [];

        if (response.opcDa!.listTags) {
          for (let tag of response.opcDa!.listTags) {
            listTags = listTags.concat(tag);
          }
        }

        if (response.opcDa!.tags) {
          for (let tag of response.opcDa!.tags) {
            tags = tags.concat(tag);
          }
        }

        response.listTags = listTags.join('\n');
        response.tags = tags.join('\n');
      } else if (response.protocol === MachineProtocol.OPCUA) {
        if (response.opcUa!.port === undefined) {
          response.opcUa!.port = '';
        }
      }

      setConnection(response);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.connection')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
    }
  }, [connectionName]);

  /**
   * React useEffect hook.
   * For the updating connection, get the connection first.
   */
  useEffect(() => {
    let isMounted = true;

    if (isMounted && connectionName) {
      getConnection();
    }

    return () => { isMounted = false; };
  }, [connectionName, getConnection]);

  /**
   * Handles the value change.
   * @param event The React change event
   */
  function handleValueChange(event: React.ChangeEvent<FormControlElement>): void {
    const { id } = event.target;
    let value: any = event.target.value;
    const copiedConnection = copyObject(connection);

    if (id.startsWith('sendDataTo')) {
      const { checked } = event.target as HTMLInputElement;
      value = checked;
    }

    // To prevent same ID from different protocols, OPC UA has prefix.
    let opcUaId: string | undefined;
    if (id.startsWith('opcUa')) {
      opcUaId = id.split('-').pop() as string;
    }

    if (opcUaId ? setValue(copiedConnection.opcUa, opcUaId, value) : setValue(copiedConnection, id, value)) {
      setConnection(copiedConnection);

      // Since `listTags` and `tags` need to be built to the array, it does not check the validation in real time.
      if (!['listTags', 'tags'].includes(id)) {
        const newErrors = validateConnectionDefinition(copiedConnection);

        if (id.toLowerCase().endsWith('machineip') || id.toLowerCase().endsWith('servername')) {
          const newId = opcUaId ? `opcUa_${opcUaId}` : `opcDa_${id}`;
          setErrors({
            ...errors,
            [newId]: newErrors[newId]
          });
        } else {
          setErrors({
            ...errors,
            [id]: newErrors[id]
          });
        }
      }
    }
  }

  /**
   * Sets the value of the object key.
   * @param obj The object to set the value
   * @param key The object key
   * @param value The new object value
   * @returns If the key exists, return `true`. Otherwise, return `false`.
   */
  function setValue(obj: any, key: string, value: any): boolean {
    if (typeof obj !== 'object') return false;
    if (Object.keys(obj).includes(key)) {
      obj[key] = value;
      return true;
    }

    for (let childKey of Object.keys(obj)) {
      if (setValue(obj[childKey], key, value)) return true;
    }

    return false;
  }

  /**
   * Handles the connection deployment and update.
   */
  async function handleConnection(event: any): Promise<void> {
    event.preventDefault();

    try {
      const buildParams: ConnectionDefinition = {
        control: connectionName ? ConnectionControl.UPDATE : ConnectionControl.DEPLOY,
        connectionName: connection.connectionName,
        area: connection.area,
        machineName: connection.machineName,
        process: connection.process,
        protocol: connection.protocol,
        sendDataToIoTSitewise: connection.sendDataToIoTSitewise,
        sendDataToIoTTopic: connection.sendDataToIoTTopic,
        sendDataToKinesisDataStreams: connection.sendDataToKinesisDataStreams,
        siteName: connection.siteName
      };

      if (buildParams.protocol === MachineProtocol.OPCDA) {
        buildParams.opcDa = connection.opcDa;
        buildParams.opcDa!.listTags = buildTags(connection.listTags);
        buildParams.opcDa!.tags = buildTags(connection.tags);
      } else if (buildParams.protocol === MachineProtocol.OPCUA) {
        buildParams.opcUa = connection.opcUa;
      }

      const newErrors = validateConnectionDefinition(buildParams);

      /**
       * For the OPC UA, the server name should be unique, so if the server name is valid,
       * it checks if the server name is unique.
       */
      if (buildParams.protocol === MachineProtocol.OPCUA && !newErrors.opcUaServerName) {
        const serverName = buildParams.opcUa!.serverName;
        const opcUaConnection: GetConnectionResponse = await API.get(API_NAME, `/sitewise/${encodeURIComponent(serverName)}`, {});

        if (Object.keys(opcUaConnection).length > 0) {
          if (buildParams.control === ConnectionControl.DEPLOY) {
            newErrors.opcUa_serverName = I18n.get('invalid.duplicated.server.name');
          } else {
            /**
             * If it's updating the connection, the server name can be updated as well,
             * so if the server name on the form is same to the connection's server name, it's not an error.
             */
            const existingConnection: GetConnectionResponse = await API.get(API_NAME, `/connections/${encodeURIComponent(buildParams.connectionName)}`, {});
            const existingOpcUa = existingConnection.opcUa;

            if (existingOpcUa!.serverName !== serverName) {
              newErrors.opcUa_serverName = I18n.get('invalid.duplicated.server.name');
            }
          }
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
      } else {
        setErrors({});
        setParams(buildParams);
        setShowConfirmMessageModal(true);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowConfirmMessageModal(false);
      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {connectionName ? I18n.get('error.message.update.connection') : I18n.get('error.message.create.connection')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          <br /><br />
          {I18n.get('error.message.implementation.guide')}
        </Alert>
      );
    }
  }

  /**
   * Calls an API.
   * @param buildParams The build connection definition request parameters
   */
  async function callApi(buildParams: ConnectionDefinition): Promise<void> {
    setLoading(true);

    try {
      const connectionDefinition = buildConnectionDefinition(buildParams);
      const response: CreateUpdateConnectionResponse = await API.post(API_NAME, '/connections', { body: connectionDefinition });
      const message = I18n.get(connectionName ? 'info.message.update.connection' : 'info.message.create.connection').replace('{}', response.connectionName);
      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <>
          <span>{message}</span>
          <br />
          <span>{I18n.get('info.message.background.running')}</span>
        </>
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowConfirmMessageModal(false);
      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {connectionName ? I18n.get('error.message.update.connection') : I18n.get('error.message.create.connection')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          <br /><br />
          {I18n.get('error.message.implementation.guide')}
        </Alert>
      );
    }

    setLoading(false);
  }

  /**
   * Builds the OPC DA tags.
   * @param value The value from the textarea
   */
  function buildTags(value: string | undefined): string[] {
    const arr: string[] = [];

    if (value && value.trim() !== '') {
      const splitTags = value.split('\n');

      for (let tag of splitTags) {
        const trimTag = tag.trim();
        if (trimTag !== '') arr.push(trimTag);
      }
    }

    return arr;
  }

  return (
    <Container>
      <Breadcrumb>
        <LinkContainer to="/" exact>
          <Breadcrumb.Item>{I18n.get('manage.connections')}</Breadcrumb.Item>
        </LinkContainer>
        <Breadcrumb.Item active>{connectionName ? `${I18n.get('update.connection')}: ${connectionName}` : I18n.get('create.connection')}</Breadcrumb.Item>
      </Breadcrumb>
      <Form onSubmit={handleConnection}>
        <Form.Group>
          <Form.Label>{I18n.get('connection.name')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.connection.name')}</Form.Text>
          <Form.Control id="connectionName" type="text" required disabled={connectionName !== undefined}
            defaultValue={connection.connectionName} placeholder={I18n.get('placeholder.connection.name')}
            onChange={handleValueChange} isInvalid={!!errors.connectionName} />
          <Form.Control.Feedback type="invalid">{errors.connectionName}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('site.name')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.site.name')}</Form.Text>
          <Form.Control id="siteName" type="text" required
            defaultValue={connection.siteName} placeholder={I18n.get('placeholder.site.name')}
            onChange={handleValueChange} isInvalid={!!errors.siteName} />
          <Form.Control.Feedback type="invalid">{errors.siteName}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('area')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.area')}</Form.Text>
          <Form.Control id="area" type="text" required
            defaultValue={connection.area} placeholder={I18n.get('placeholder.area')}
            onChange={handleValueChange} isInvalid={!!errors.area} />
          <Form.Control.Feedback type="invalid">{errors.area}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('process')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.process')}</Form.Text>
          <Form.Control id="process" type="text" required
            defaultValue={connection.process} placeholder={I18n.get('placeholder.process')}
            onChange={handleValueChange} isInvalid={!!errors.process} />
          <Form.Control.Feedback type="invalid">{errors.process}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('machine.name')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.machine.name')}</Form.Text>
          <Form.Control id="machineName" type="text" required
            defaultValue={connection.machineName} placeholder={I18n.get('placeholder.machine.name')}
            onChange={handleValueChange} isInvalid={!!errors.machineName} />
          <Form.Control.Feedback type="invalid">{errors.machineName}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('send.data.to')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.send.data.to')}</Form.Text>
          <Form.Group>
            <Form.Check inline type="checkbox" id="sendDataToIoTSitewise"
              label={I18n.get('iot.sitewise')} checked={connection.sendDataToIoTSitewise}
              onChange={handleValueChange} isInvalid={!!errors.sendDataTo} />
            <EmptyCol />
            <Form.Check inline type="checkbox" id="sendDataToIoTTopic"
              label={I18n.get('iot.topic')} checked={connection.sendDataToIoTTopic}
              onChange={handleValueChange} isInvalid={!!errors.sendDataTo} />
            <EmptyCol />
            <Form.Check inline type="checkbox" id="sendDataToKinesisDataStreams"
              label={I18n.get('kinesis.data.streams')} checked={connection.sendDataToKinesisDataStreams}
              onChange={handleValueChange} isInvalid={!!errors.sendDataTo} />
            <Form.Control.Feedback type="invalid">{errors.connectionName}</Form.Control.Feedback>
          </Form.Group>
        </Form.Group>
        <Form.Group>
          <Form.Label>{I18n.get('protocol')} <span className="red-text">*</span></Form.Label>
          <Form.Text muted>{I18n.get('description.protocol')}</Form.Text>
          <Form.Control id="protocol" as="select" onChange={handleValueChange} value={connection.protocol} disabled={connectionName !== undefined}>
            <option value={MachineProtocol.OPCDA}>OPC DA</option>
            <option value={MachineProtocol.OPCUA}>OPC UA</option>
          </Form.Control>
        </Form.Group>
        {
          connection.protocol === MachineProtocol.OPCDA &&
          <OpcDaForm connection={{ ...connection }} onChange={handleValueChange} errors={errors} />
        }
        {
          connection.protocol === MachineProtocol.OPCUA &&
          <OpcUaForm connection={{ ...connection }} onChange={handleValueChange} errors={errors} />
        }
        <EmptyRow />
        <Row>
          <Col className="justify-content-center grid">
            <ButtonGroup>
              <Button id="connection-form-submit-button" size="sm" className="uppercase-text" type="submit" disabled={loading}>
                {loading ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /><EmptyCol /></> : <></>}
                {connectionName ? I18n.get('update') : I18n.get('create')}
              </Button>
              <EmptyCol />
              <Button id="connection-form-cancel-button" size="sm" className="uppercase-text" onClick={() => close()} disabled={loading} variant="secondary">{I18n.get('cancel')}</Button>
            </ButtonGroup>
          </Col>
        </Row>
      </Form>
      <EmptyRow />
      <MessageModal show={showConfirmMessageModal}
        hide={() => setShowConfirmMessageModal(false)}
        message={connectionName ? I18n.get('warning.message.update.connection') : I18n.get('warning.message.create.connection')}
        modalType={MessageModalType.CONFIRM}
        confirmAction={() => callApi(params as ConnectionDefinition)}
      />
      <MessageModal show={showMessagemMessageModal}
        hide={() => setShowMessageMessageModal(false)}
        message={messageModalMessage}
        modalType={MessageModalType.MESSAGE}
        confirmAction={() => close()}
      />
    </Container>
  );
}