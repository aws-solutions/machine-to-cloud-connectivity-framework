// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n, Logger } from '@aws-amplify/core';
import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Jumbotron from 'react-bootstrap/Jumbotron';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import ConnectionLogsModal from './ConnectionLogsModal';
import MessageModal from './MessageModal';
import EmptyRow from '../components/EmptyRow';
import EmptyCol from '../components/EmptyCol';
import { ControlConnectionResponse, ConnectionControl, ListConnectionsItem, ListConnectionsResponse, MachineProtocol, MessageModalType, PaginationType } from '../util/Types';
import { API_NAME, buildConnectionDefinition, getErrorMessage } from '../util/Utils';
import { useHistory } from 'react-router-dom';

const logger = new Logger('Dashboard');

/**
 * Renders the dashboard.
 * @param props The properties for the dashboard
 * @returns The dashboard
 */
export default function Dashboard(props: { region: string }): JSX.Element {
  const history = useHistory();
  const [loading, setLoading] = useState<boolean>(false);
  const [connections, setConnections] = useState<ListConnectionsItem[]>([]);
  const [showDeleteConfirmMessageModal, setShowDeleteConfirmMessageModal] = useState<boolean>(false);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<string | React.ReactNode>('');
  const [connectionName, setConnectionName] = useState<string>();
  const [showConnectionLogsModal, setShowConnectionLogsModal] = useState<boolean>(false);
  const [deleteConnectionProtocol, setDeleteConnectionProtocol] = useState<MachineProtocol>();
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageToken, setPageToken] = useState<string[]>(['']);

  /**
   * Gets the connections.
   * @param paginationType The pagination type to get the connections
   */
  const getConnections = useCallback(async (paginationType?: PaginationType) => {
    setDeleteConnectionProtocol(undefined);
    setLoading(true);

    let nextToken: string;

    switch (paginationType) {
      case PaginationType.PREV:
        nextToken = pageToken[pageIndex - 1];
        break;
      case PaginationType.NEXT:
        nextToken = pageToken[pageIndex + 1];
        break;
      default:
        nextToken = '';
        break;
    }

    try {
      const response: ListConnectionsResponse = await API.get(API_NAME, '/connections', {
        queryStringParameters: { nextToken: nextToken && nextToken !== '' ? nextToken : undefined }
      });

      switch (paginationType) {
        case PaginationType.PREV:
          setPageIndex(prevIndex => prevIndex - 1);
          break;
        case PaginationType.NEXT:
          /**
           * Due to inconsistency, it can't compare with the next index item.
           * Therefore, it checks if the page token array has the next token or not.
           */
          if (response.nextToken && !pageToken.includes(response.nextToken)) {
            setPageToken([
              ...pageToken,
              response.nextToken
            ]);
          }
          setPageIndex(prevIndex => prevIndex + 1);
          break;
        default:
          setPageIndex(0);
          setPageToken(response.nextToken ? ['', response.nextToken] : ['']);
          break;
      }

      setConnections(response.connections);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.connections')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
      setShowMessageModal(true);
    }

    setLoading(false);
  }, [pageToken, pageIndex]);

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    getConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Renders the empty connection message.
   * @returns Empty connection component
   */
  function EmptyConnection(): JSX.Element {
    return (
      <Jumbotron className="text-align-center" id="empty-connection-jumbotron">
        <p className="empty-p">{I18n.get('info.message.no.connection')}</p>
      </Jumbotron>
    );
  }

  /**
   * Controls a connection.
   * @param paramConnectionName The connection name
   * @param control The connection control
   * @param protocol The connection protocol
   */
  async function controlConnection(paramConnectionName: string, control: ConnectionControl, protocol: MachineProtocol) {
    try {
      const connectionDefinition = buildConnectionDefinition({ connectionName: paramConnectionName, control, protocol });
      const response: ControlConnectionResponse = await API.post(API_NAME, '/connections', { body: connectionDefinition });

      switch (control) {
        case ConnectionControl.START:
          setMessageModalMessage(I18n.get('info.message.start.connection').replace('{}', response.connectionName));
          break;
        case ConnectionControl.STOP:
          setMessageModalMessage(I18n.get('info.message.stop.connection').replace('{}', response.connectionName));
          break;
        case ConnectionControl.PUSH:
          setMessageModalMessage(I18n.get('info.message.check.connectivity').replace('{}', response.connectionName));
          break;
        case ConnectionControl.PULL:
          setMessageModalMessage(I18n.get('info.message.get.connection.configuration').replace('{}', response.connectionName));
          break;
        case ConnectionControl.DELETE:
          setMessageModalMessage(I18n.get('info.message.delete.connection').replace('{}', response.connectionName));
          break;
        default:
          break;
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.control.connection')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
    }

    setShowMessageModal(true);
    if ([ConnectionControl.START, ConnectionControl.STOP].includes(control)) getConnections();
  }

  /**
   * Shows the connection logs modal.
   * @param paramConnectionName The connection name
   */
  function handleConnectionLogs(paramConnectionName: string) {
    setConnectionName(paramConnectionName);
    setShowConnectionLogsModal(true);
  }

  /**
   * Shows the connection deletion confirm modal.
   * @param paramConnectionName The connection name
   */
  function handleDeleteConnection(paramConnectionName: string, protocol: MachineProtocol) {
    setConnectionName(paramConnectionName);
    setDeleteConnectionProtocol(protocol);
    setShowDeleteConfirmMessageModal(true);
  }

  return (
    <Container>
      <Breadcrumb>
        <Breadcrumb.Item active>{I18n.get('manage.connections')}</Breadcrumb.Item>
      </Breadcrumb>
      <Card>
        <Card.Body>
          <Card.Title>
            <Row>
              <Col>{I18n.get('manage.connections')}</Col>
              <Col className="justify-content-end grid">
                <ButtonGroup>
                  <Button size="sm" className="uppercase-text" onClick={() => getConnections()}>{I18n.get('refresh')}</Button>
                  <EmptyCol />
                  <Button size="sm" className="uppercase-text" onClick={() => history.push('/connection')}>{I18n.get('create.connection')}</Button>
                </ButtonGroup>
              </Col>
            </Row>
          </Card.Title>
          <EmptyRow />
          {loading && <ProgressBar animated now={100} />}
          {!loading && connections.length === 0 && <EmptyConnection />}
          {
            !loading && connections.length > 0 &&
            <>
              <Table size="md" id="connections-table">
                <thead>
                  <tr>
                    <th>{I18n.get('connection.name')}</th>
                    <th>{I18n.get('machine.name')}</th>
                    <th>{I18n.get('protocol')}</th>
                    <th>{I18n.get('status')}</th>
                    <th>{I18n.get('connection.actions')}</th>
                    <th>{I18n.get('manage.connection')}</th>
                  </tr>
                </thead>
                <tbody>
                  {
                    connections.map((connection: ListConnectionsItem) => {
                      return (
                        <tr key={`dashbaord-${connection.connectionName}`}>
                          <td>{connection.connectionName}</td>
                          <td>{connection.machineName ? connection.machineName : '-'}</td>
                          <td>
                            {connection.protocol === MachineProtocol.OPCDA && 'OPC DA'}
                            {connection.protocol === MachineProtocol.OPCUA && 'OPC UA'}
                          </td>
                          <td>{I18n.get(`status.${connection.status}`)}</td>
                          <td>
                            <Button id={`start-connection-${connection.connectionName}`} variant="outline-success"
                              size="sm" className="uppercase-text"
                              onClick={() => controlConnection(connection.connectionName, ConnectionControl.START, connection.protocol)}
                              disabled={[ConnectionControl.DEPLOY, ConnectionControl.START].includes(connection.status)}>{I18n.get('start')}</Button>
                            <EmptyCol />
                            <Button id={`stop-connection-${connection.connectionName}`} variant="outline-danger"
                              size="sm" className="uppercase-text"
                              onClick={() => controlConnection(connection.connectionName, ConnectionControl.STOP, connection.protocol)}
                              disabled={[ConnectionControl.DEPLOY, ConnectionControl.STOP].includes(connection.status)}>{I18n.get('stop')}</Button>
                          </td>
                          <td>
                            <DropdownButton as={ButtonGroup} id={`manage-connection-${connection.connectionName}`}
                              variant="link" drop="right" className="dropdown-button"
                              title={<i className="bi-tools btn-manage-connection-icon" />}>
                              <Dropdown.Item eventKey="1" onSelect={() => history.push(`/connection/${connection.connectionName}`)}>{I18n.get('update.connection')}</Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item eventKey="2" onSelect={() => controlConnection(connection.connectionName, ConnectionControl.PUSH, connection.protocol)}>{I18n.get('check.connectivity')}</Dropdown.Item>
                              <Dropdown.Item eventKey="3" onSelect={() => controlConnection(connection.connectionName, ConnectionControl.PULL, connection.protocol)}>{I18n.get('get.connection.configuration')}</Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item eventKey="4" onSelect={() => handleConnectionLogs(connection.connectionName)}>{I18n.get('view.connection.logs')}</Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item eventKey="5" onSelect={() => handleDeleteConnection(connection.connectionName, connection.protocol)} className="red-text">{I18n.get('delete.connection')}</Dropdown.Item>
                            </DropdownButton>
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </Table>
              <Row>
                <Col>
                  <Button id="prev-connection-page-button" size="sm" className="uppercase-text" disabled={pageIndex === 0}
                    onClick={() => getConnections(PaginationType.PREV)}><i className="bi bi-chevron-double-left" /> {I18n.get('prev.page')}</Button>
                </Col>
                <Col className="justify-content-end grid">
                  <Button id="next-connection-page-button" size="sm" className="uppercase-text" disabled={pageToken.length === pageIndex + 1}
                    onClick={() => getConnections(PaginationType.NEXT)}>{I18n.get('next.page')} <i className="bi bi-chevron-double-right" /></Button>
                </Col>
              </Row>
              <EmptyRow />
              <Alert variant="warning">
                {I18n.get('info.message.create.opc.ua')}: <a href={`https://console.aws.amazon.com/iotsitewise/home?region=${props.region}#/gateway`} rel="noreferrer" target="_blank">{I18n.get('iot.sitewise.console.link')}</a>
              </Alert>
            </>
          }
        </Card.Body>
      </Card>
      <MessageModal show={showMessageModal} hide={() => setShowMessageModal(false)} message={messageModalMessage} modalType={MessageModalType.MESSAGE} />
      <MessageModal show={showDeleteConfirmMessageModal} hide={() => setShowDeleteConfirmMessageModal(false)} message={I18n.get('warning.message.delete.connection')} modalType={MessageModalType.CONFIRM} confirmAction={() => controlConnection(connectionName as string, ConnectionControl.DELETE, deleteConnectionProtocol as MachineProtocol)} />
      <ConnectionLogsModal show={showConnectionLogsModal} hide={() => setShowConnectionLogsModal(false)} connectionName={connectionName as string} />
    </Container>
  );
}