// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import { Storage } from '@aws-amplify/storage';
import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { useNavigate } from 'react-router-dom';
import MessageModal from '../../components/MessageModal';
import EmptyCol from '../../components/EmptyCol';
import EmptyRow from '../../components/EmptyRow';
import { LoadingProgressBar } from '../../components/Loading';
import { requestApi } from '../../util/apis';
import {
  CreatedBy,
  GreengrassCoreDeviceControl,
  GreengrassCoreDevicePostResponse,
  ListGreengrassCoreDevicesItem,
  MessageModalType,
  PaginationType
} from '../../util/types';
import { getErrorMessage } from '../../util/utils';
import { GreengrassCoreDevicesHook } from '../../hooks/GreengrassCoreDeviceHook';

const logger = new Logger('GreengrassCoreDevicesDashboard');

/**
 * Renders the Greengrass core devices dashboard.
 * @returns The Greengrass core devices dashboard
 */
export default function GreengrassCoreDevicesDashboard(): JSX.Element {
  const navigate = useNavigate();
  const [greengrassCoreDeviceCreatedBy, setGreengrassCoreDeviceCreatedBy] = useState<CreatedBy>();
  const [greengrassCoreDeviceName, setGreengrassCoreDeviceName] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | React.ReactNode>('');
  const [showDeregisterConfirmMessageModal, setShowDeregisterConfirmMessageModal] = useState<boolean>(false);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const { getGreengrassCoreDevices, greengrassCoreDevices, pageIndex, pageToken } = GreengrassCoreDevicesHook({
    setLoading,
    setMessage,
    setShowMessageModal
  });

  /**
   * Renders the empty Greengrass core device message.
   * @returns Empty Greengrass core device component
   */
  function EmptyGreengrassCoreDevice(): JSX.Element {
    return (
      <Jumbotron className="text-align-center" id="empty-connection-jumbotron">
        <p className="empty-p">{I18n.get('info.message.no.greengrass.core.device')}</p>
      </Jumbotron>
    );
  }

  /**
   * Renders Greengrass core device table row.
   * @param greengrassCoreDevice Greengrass core device
   * @returns Greengrass core device row
   */
  function GreengrassCoreDevice(greengrassCoreDevice: ListGreengrassCoreDevicesItem): JSX.Element {
    const { name, createdBy, numberOfConnections } = greengrassCoreDevice;

    return (
      <tr>
        <td>{name}</td>
        <td>{createdBy}</td>
        <td>{numberOfConnections}</td>
        <td>
          {createdBy === CreatedBy.SYSTEM && (
            <>
              <Button
                id={`download-script-${name}`}
                variant="primary"
                size="sm"
                onClick={() => downloadInstallScript(name)}>
                {I18n.get('download.install.script')}
              </Button>
              <EmptyCol />
            </>
          )}
          <Button
            id={`deregister-greengrass-core-device-${name}`}
            variant="danger"
            size="sm"
            onClick={() => handleDeleteGreengrassCoreDevice({ name, createdBy })}>
            {I18n.get('deregister')}
          </Button>
        </td>
      </tr>
    );
  }

  /**
   * Handles to delete a Greengrass core device.
   * @param params The Greengrass core device name and created by
   */
  function handleDeleteGreengrassCoreDevice(params: Omit<ListGreengrassCoreDevicesItem, 'numberOfConnections'>): void {
    setGreengrassCoreDeviceCreatedBy(params.createdBy);
    setGreengrassCoreDeviceName(params.name);
    setShowDeregisterConfirmMessageModal(true);
  }

  /**
   * Downloads a Greengrass install script.
   * @param name The Greengrass core device name
   */
  async function downloadInstallScript(name: string): Promise<void> {
    try {
      const url = await Storage.get(`${name}.sh`, { expires: 10 });
      window.open(url, '_blank');
      setMessage(<span>{I18n.get('info.message.download.greengrass.core.device.install.script')}</span>);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setMessage(
        <Alert variant="danger">
          {I18n.get('error.message.download.greengrass.core.device.install.script')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          <br />
        </Alert>
      );
    }

    setShowMessageModal(true);
  }

  /**
   * Deletes a Greengrass core device.
   */
  async function deleteGreengrassCoreDevice(): Promise<void> {
    setLoading(true);

    try {
      const response = (await requestApi({
        method: 'post',
        path: '/greengrass',
        options: {
          body: {
            name: greengrassCoreDeviceName,
            control: GreengrassCoreDeviceControl.DELETE,
            createdBy: greengrassCoreDeviceCreatedBy
          }
        }
      })) as GreengrassCoreDevicePostResponse;

      setMessage(<span>{response.message}</span>);
      getGreengrassCoreDevices();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setMessage(
        <Alert variant="danger">
          {I18n.get('error.message.deregister.greengrass.core.device')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          <br />
        </Alert>
      );
      setLoading(false);
    }

    setGreengrassCoreDeviceCreatedBy(undefined);
    setGreengrassCoreDeviceName(undefined);
    setShowMessageModal(true);
  }

  return (
    <Container>
      <Breadcrumb>
        <Breadcrumb.Item active>{I18n.get('manage.greengrass.core.devices')}</Breadcrumb.Item>
      </Breadcrumb>
      <Card>
        <Card.Body>
          <Card.Title>
            <Row>
              <Col>{I18n.get('manage.greengrass.core.devices')}</Col>
              <Col className="justify-content-end grid">
                <Button size="sm" onClick={() => navigate('/greengrass/register')}>
                  {I18n.get('register.greengrass.core.device')}
                </Button>
              </Col>
            </Row>
          </Card.Title>
          <EmptyRow />
          <LoadingProgressBar loading={loading} />
          {!loading && greengrassCoreDevices.length === 0 && <EmptyGreengrassCoreDevice />}
          {!loading && greengrassCoreDevices.length > 0 && (
            <>
              <Table size="md" id="greengrass-core-devices-table">
                <thead>
                  <tr>
                    <th>{I18n.get('name')}</th>
                    <th>{I18n.get('created.by')}</th>
                    <th>{I18n.get('number.of.connections')}</th>
                    <th>{I18n.get('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {greengrassCoreDevices.map((greengrassCoreDevice: ListGreengrassCoreDevicesItem) => (
                    <GreengrassCoreDevice
                      key={`greengrass-core-devices-${greengrassCoreDevice.name}`}
                      name={greengrassCoreDevice.name}
                      createdBy={greengrassCoreDevice.createdBy}
                      numberOfConnections={greengrassCoreDevice.numberOfConnections}
                    />
                  ))}
                </tbody>
              </Table>
              <Row>
                <Col>
                  <Button
                    id="prev-greengrass-core-device-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageIndex === 0}
                    onClick={() => getGreengrassCoreDevices(PaginationType.PREV)}>
                    <i className="bi bi-chevron-double-left" /> {I18n.get('prev.page')}
                  </Button>
                </Col>
                <Col className="justify-content-end grid">
                  <Button
                    id="next-greengrass-core-device-page-button"
                    size="sm"
                    className="uppercase-text"
                    disabled={pageToken.length === pageIndex + 1}
                    onClick={() => getGreengrassCoreDevices(PaginationType.NEXT)}>
                    {I18n.get('next.page')} <i className="bi bi-chevron-double-right" />
                  </Button>
                </Col>
              </Row>
            </>
          )}
        </Card.Body>
      </Card>
      <MessageModal
        show={showDeregisterConfirmMessageModal}
        hide={() => setShowDeregisterConfirmMessageModal(false)}
        message={I18n.get('warning.message.deregister.greengrass.core.device').replace('{}', greengrassCoreDeviceName)}
        modalType={MessageModalType.CONFIRM}
        confirmAction={() => deleteGreengrassCoreDevice()}
      />
      <MessageModal
        show={showMessageModal}
        hide={() => setShowMessageModal(false)}
        message={message}
        modalType={MessageModalType.MESSAGE}
      />
    </Container>
  );
}
