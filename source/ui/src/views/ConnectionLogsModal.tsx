// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { API } from '@aws-amplify/api';
import { I18n, Logger } from '@aws-amplify/core';
import React, { useCallback, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Modal from 'react-bootstrap/Modal';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import MessageModal from './MessageModal';
import { ConnectionLogsModalProps, ListLogsItem, ListLogsResponse, MessageModalType, PaginationType } from '../util/Types';
import { API_NAME, getErrorMessage } from '../util/Utils';

const logger = new Logger('ConnectionLogModal');

/**
 * Renders the connection logs modal.
 * @param props The connection logs modal properties
 * @returns The connection logs modal
 */
export default function ConnectionLogsModal(props: ConnectionLogsModalProps) {
  const { show, hide, connectionName } = props;
  const [logs, setLogs] = useState<ListLogsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showMessagemMessageModal, setShowMessageMessageModal] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<React.ReactNode>('');
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageToken, setPageToken] = useState<string[]>(['']);

  /**
   * Gets the connection logs.
   * @param paginationType The pagination type to get the connection logs
   */
  const getLogs = useCallback(async (paginationType?: PaginationType) => {
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
      const encodedConnectionName = encodeURIComponent(connectionName);
      const response: ListLogsResponse = await API.get(API_NAME, `/logs/${encodedConnectionName}`, {
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

      setLogs(response.logs);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.logs')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      )
    }

    setLoading(false);
  }, [connectionName, pageToken, pageIndex]);

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    if (connectionName) getLogs();
  }, [connectionName]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {loading && <ProgressBar animated now={100} />}
          {!loading && logs.length === 0 && <EmptyLogs />}
          {!loading && logs.length > 0 &&
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
                  {
                    logs.map((log: ListLogsItem, index: number) => {
                      return (
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
                      );
                    })
                  }
                </tbody>
              </Table>
              <Row>
                <Col>
                  <Button id="prev-logs-page-button" size="sm" className="uppercase-text" disabled={pageIndex === 0}
                    onClick={() => getLogs(PaginationType.PREV)}><i className="bi bi-chevron-double-left" /> {I18n.get('prev.page')}</Button>
                </Col>
                <Col className="justify-content-end grid">
                  <Button id="next-logs-page-button" size="sm" className="uppercase-text" disabled={pageToken.length === pageIndex + 1}
                    onClick={() => getLogs(PaginationType.NEXT)}>{I18n.get('next.page')} <i className="bi bi-chevron-double-right" /></Button>
                </Col>
              </Row>
            </>
          }
        </Modal.Body>
        <Modal.Footer>
          <Button id="connection-logs-modal-close-button" onClick={() => hide()} className="uppercase-text" size="sm">{I18n.get('close')}</Button>
        </Modal.Footer>
      </Modal>
      <MessageModal show={showMessagemMessageModal}
        hide={() => setShowMessageMessageModal(false)}
        message={messageModalMessage}
        modalType={MessageModalType.MESSAGE}
      />
    </>
  );
}