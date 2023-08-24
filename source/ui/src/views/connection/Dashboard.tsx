// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import { useState } from 'react';
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
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { useNavigate } from 'react-router-dom';
import ConnectionLogsModal from './ConnectionLogsModal';
import MessageModal from '../../components/MessageModal';
import EmptyRow from '../../components/EmptyRow';
import EmptyCol from '../../components/EmptyCol';
import { LoadingProgressBar } from '../../components/Loading';
import { ConnectionsHook } from '../../hooks/ConnectionHook';
import { requestApi } from '../../util/apis';
import {
  ControlConnectionResponse,
  ConnectionControl,
  ListConnectionsItem,
  MachineProtocol,
  MessageModalType,
  PaginationType
} from '../../util/types';
import { buildConnectionDefinition, getErrorMessage } from '../../util/utils';

type ConnectionRowRequest = {
  connectionName: string;
  machineName: string;
  protocol: MachineProtocol;
  status: ConnectionControl;
};

const logger = new Logger('Dashboard');

/**
 * Renders the dashboard.
 * @param props The properties for the dashboard
 * @param props.region The AWS region
 * @returns The dashboard
 */
export default function Dashboard(props: { region: string }): React.JSX.Element {
  const navigate = useNavigate();
  const [showDeleteConfirmMessageModal, setShowDeleteConfirmMessageModal] = useState<boolean>(false);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<string | React.ReactNode>('');
  const [connectionName, setConnectionName] = useState<string>();
  const [showConnectionLogsModal, setShowConnectionLogsModal] = useState<boolean>(false);
  const [deleteConnectionProtocol, setDeleteConnectionProtocol] = useState<MachineProtocol>();
  const { connections, getConnections, loading, pageIndex, pageToken } = ConnectionsHook({
    setDeleteConnectionProtocol,
    setMessageModalMessage,
    setShowMessageModal
  });

  /**
   * Renders the empty connection message.
   * @returns Empty connection component
   */
  function EmptyConnection(): React.JSX.Element {
    return (
      <Jumbotron className="text-align-center" id="empty-connection-jumbotron">
        <p className="empty-p">{I18n.get('info.message.no.connection')}</p>
      </Jumbotron>
    );
  }

  /**
   * Renders a connection table row.
   * @param connection Connection
   * @returns Connection row
   */
  function Connection(connection: ConnectionRowRequest): React.JSX.Element {
    return (
      <tr>
        <td>{connection.connectionName}</td>
        <td>{connection.machineName}</td>
        <td>
          {connection.protocol === MachineProtocol.OPCDA && 'OPC DA'}
          {connection.protocol === MachineProtocol.OPCUA && 'OPC UA'}
          {connection.protocol === MachineProtocol.OSIPI && 'OSI PI'}
          {connection.protocol === MachineProtocol.MODBUSTCP && 'Modbus TCP'}
        </td>
        <td>{I18n.get(`status.${connection.status}`)}</td>
        <td>
          <Button
            id={`start-connection-${connection.connectionName}`}
            variant="outline-success"
            size="sm"
            className="uppercase-text"
            onClick={() => controlConnection(connection.connectionName, ConnectionControl.START, connection.protocol)}
            disabled={connection.status !== ConnectionControl.STOP}>
            {I18n.get('start')}
          </Button>
          <EmptyCol />
          <Button
            id={`stop-connection-${connection.connectionName}`}
            variant="outline-danger"
            size="sm"
            className="uppercase-text"
            onClick={() => controlConnection(connection.connectionName, ConnectionControl.STOP, connection.protocol)}
            disabled={connection.status !== ConnectionControl.START}>
            {I18n.get('stop')}
          </Button>
        </td>
        <td>
          <DropdownButton
            as={ButtonGroup}
            id={`manage-connection-${connection.connectionName}`}
            variant="link"
            drop="right"
            className="dropdown-button"
            title={<i className="bi-tools btn-manage-connection-icon" />}>
            <Dropdown.Item
              eventKey="1"
              disabled={![ConnectionControl.START, ConnectionControl.STOP].includes(connection.status)}
              onSelect={() => navigate(`/connection/${connection.connectionName}`)}>
              {I18n.get('update.connection')}
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              eventKey="2"
              onSelect={() =>
                controlConnection(connection.connectionName, ConnectionControl.PUSH, connection.protocol)
              }>
              {I18n.get('check.connectivity')}
            </Dropdown.Item>
            <Dropdown.Item
              eventKey="3"
              onSelect={() =>
                controlConnection(connection.connectionName, ConnectionControl.PULL, connection.protocol)
              }>
              {I18n.get('get.connection.configuration')}
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item eventKey="4" onSelect={() => handleConnectionLogs(connection.connectionName)}>
              {I18n.get('view.connection.logs')}
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              eventKey="5"
              onSelect={() => handleDeleteConnection(connection.connectionName, connection.protocol)}
              className="red-text">
              {I18n.get('delete.connection')}
            </Dropdown.Item>
          </DropdownButton>
        </td>
      </tr>
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
      const connectionDefinition = buildConnectionDefinition({
        connectionName: paramConnectionName,
        control,
        protocol
      });
      const response = (await requestApi({
        method: 'post',
        path: '/connections',
        options: {
          body: connectionDefinition
        }
      })) as ControlConnectionResponse;

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
          setMessageModalMessage(
            I18n.get('info.message.get.connection.configuration').replace('{}', response.connectionName)
          );
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
   * @param protocol The machine protocol
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
                  <Button size="sm" className="uppercase-text" onClick={() => getConnections()}>
                    {I18n.get('refresh')}
                  </Button>
                  <EmptyCol />
                  <Button size="sm" className="uppercase-text" onClick={() => navigate('/connection')}>
                    {I18n.get('create.connection')}
                  </Button>
                </ButtonGroup>
              </Col>
            </Row>
          </Card.Title>
          <EmptyRow />
          <LoadingProgressBar loading={loading} />
          {!loading && connections.length === 0 && <EmptyConnection />}
          {!loading && connections.length > 0 && (
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
                  {connections.map((connection: ListConnectionsItem) => (
                    <Connection
                      key={`dashboard-${connection.connectionName}`}
                      connectionName={connection.connectionName}
                      machineName={connection.machineName}
                      protocol={connection.protocol}
                      status={connection.status}
                    />
                  ))}
                </tbody>
              </Table>
              <Row>
                <Col>
                  <Button
                    id="prev-connection-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageIndex === 0}
                    onClick={() => getConnections(PaginationType.PREV)}>
                    <i className="bi bi-chevron-double-left" /> {I18n.get('prev.page')}
                  </Button>
                </Col>
                <Col className="justify-content-end grid">
                  <Button
                    id="next-connection-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageToken.length === pageIndex + 1}
                    onClick={() => getConnections(PaginationType.NEXT)}>
                    {I18n.get('next.page')} <i className="bi bi-chevron-double-right" />
                  </Button>
                </Col>
              </Row>
              <EmptyRow />
              <Alert variant="warning">
                {I18n.get('info.message.create.opc.ua')}:{' '}
                <a
                  href={`https://console.aws.amazon.com/iotsitewise/home?region=${props.region}#/gateway`}
                  rel="noreferrer"
                  target="_blank">
                  {I18n.get('iot.sitewise.console.link')}
                </a>
              </Alert>
            </>
          )}
        </Card.Body>
      </Card>
      <MessageModal
        show={showMessageModal}
        hide={() => setShowMessageModal(false)}
        message={messageModalMessage}
        modalType={MessageModalType.MESSAGE}
      />
      <MessageModal
        show={showDeleteConfirmMessageModal}
        hide={() => setShowDeleteConfirmMessageModal(false)}
        message={I18n.get('warning.message.delete.connection')}
        modalType={MessageModalType.CONFIRM}
        confirmAction={() =>
          controlConnection(
            connectionName as string,
            ConnectionControl.DELETE,
            deleteConnectionProtocol as MachineProtocol
          )
        }
      />
      <ConnectionLogsModal
        show={showConnectionLogsModal}
        hide={() => setShowConnectionLogsModal(false)}
        connectionName={connectionName as string}
      />
    </Container>
  );
}
