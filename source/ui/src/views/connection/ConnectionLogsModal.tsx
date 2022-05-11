// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { LoadingProgressBar } from '../../components/Loading';
import MessageModal from '../../components/MessageModal';
import { ConnectionLogsHook } from '../../hooks/ConnectionHook';
import { ConnectionLogsModalProps, ListLogsItem, MessageModalType, PaginationType } from '../../util/types';

/**
 * Renders the connection logs modal.
 * @param props The connection logs modal properties
 * @returns The connection logs modal
 */
export default function ConnectionLogsModal(props: ConnectionLogsModalProps): JSX.Element {
  const { show, hide, connectionName } = props;
  const [showMessageMessageModal, setShowMessageMessageModal] = useState<boolean>(false);
  const { getLogs, messageModalMessage, loading, logs, pageIndex, pageToken } = ConnectionLogsHook({
    connectionName,
    setShowMessageMessageModal
  });

  /**
   * Renders the message of the empty logs.
   * @returns Empty logs component
   */
  function EmptyLogs(): JSX.Element {
    return (
      <Jumbotron className="text-align-center" id="empty-logs-jumbotron">
        <p className="empty-p">{I18n.get('info.message.no.logs')}</p>
      </Jumbotron>
    );
  }

  return (
    <>
      <Modal show={show} onHide={() => hide()} id="connection-log-modal" animation={false} size="xl">
        <Modal.Header closeButton>
          <strong>{I18n.get('connection.logs')}</strong>: {connectionName}
        </Modal.Header>
        <Modal.Body>
          <LoadingProgressBar loading={loading} />
          {!loading && logs.length === 0 && <EmptyLogs />}
          {!loading && logs.length > 0 && (
            <>
              <Table size="md" id="connection-logs-table">
                <thead>
                  <tr>
                    <th>{I18n.get('message')}</th>
                    <th>{I18n.get('log.type')}</th>
                    <th>{I18n.get('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: ListLogsItem, index: number) => (
                    <tr key={`logs-${log.connectionName}-${index}`}>
                      <td>
                        <Form>
                          <Form.Group>
                            <Form.Control as="textarea" rows={5} readOnly value={log.message} />
                          </Form.Group>
                        </Form>
                      </td>
                      <td className="uppercase-text">{log.logType}</td>
                      <td>{new Date(log.timestamp).toISOString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Row>
                <Col>
                  <Button
                    id="prev-logs-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageIndex === 0}
                    onClick={() => getLogs(PaginationType.PREV)}>
                    <i className="bi bi-chevron-double-left" /> {I18n.get('prev.page')}
                  </Button>
                </Col>
                <Col className="justify-content-end grid">
                  <Button
                    id="next-logs-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageToken.length === pageIndex + 1}
                    onClick={() => getLogs(PaginationType.NEXT)}>
                    {I18n.get('next.page')} <i className="bi bi-chevron-double-right" />
                  </Button>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button id="connection-logs-modal-close-button" onClick={() => hide()} className="uppercase-text" size="sm">
            {I18n.get('close')}
          </Button>
        </Modal.Footer>
      </Modal>
      <MessageModal
        show={showMessageMessageModal}
        hide={() => setShowMessageMessageModal(false)}
        message={messageModalMessage}
        modalType={MessageModalType.MESSAGE}
      />
    </>
  );
}
