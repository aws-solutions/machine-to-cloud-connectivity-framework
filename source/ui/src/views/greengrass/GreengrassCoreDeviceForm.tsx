// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import React, { FormEvent, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { LinkContainer } from 'react-router-bootstrap';
import GreengrassCoreDeviceInputForm from './GreengrassCoreDeviceInputForm';
import { handleValueChange } from './greengrass-core-device-form-utils';
import MessageModal from '../../components/MessageModal';
import EmptyCol from '../../components/EmptyCol';
import EmptyRow from '../../components/EmptyRow';
import { LoadingSpinner } from '../../components/Loading';
import { UserGreengrassCoreDevicesHook } from '../../hooks/GreengrassCoreDeviceHook';
import { requestApi } from '../../util/apis';
import {
  CreatedBy,
  FormControlElement,
  GreengrassCoreDeviceControl,
  GreengrassCoreDeviceDomIds,
  GreengrassCoreDevicePostResponse,
  MessageModalType
} from '../../util/types';
import { getErrorMessage } from '../../util/utils';

const logger = new Logger('GreengrassCoreDeviceForm');
const domIds: GreengrassCoreDeviceDomIds = {
  category: 'category',
  greengrassCoreDeviceName: 'greengrassCoreDeviceName'
};

/**
 * Renders the Greengrass core device registration form.
 * @returns The Greengrass core device modal
 */
export default function GreengrassCoreDeviceForm(): React.JSX.Element {
  const [confirmMessage, setConfirmMessage] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<CreatedBy>(CreatedBy.SYSTEM);
  const [greengrassCoreDeviceName, setGreengrassCoreDeviceName] = useState<string>('');
  const [greengrassCoreDeviceStatus, setGreengrassCoreDeviceStatus] = useState<string>('');
  const [hasConfirmActionError, setHasConfirmActionError] = useState<boolean>(false);
  const [isGreengrassCoreDeviceNameValid, setIsGreengrassCoreDeviceNameValid] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | React.ReactNode>('');
  const [showConfirmMessageModal, setShowConfirmMessageModal] = useState<boolean>(false);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const { close, greengrassCoreDevices, statusMap } = UserGreengrassCoreDevicesHook({
    setHasConfirmActionError,
    setMessage,
    setShowMessageModal
  });
  const change = (event: React.ChangeEvent<FormControlElement>) => {
    handleValueChange({
      domIds,
      event,
      greengrassCoreDevices,
      setCreatedBy,
      setGreengrassCoreDeviceName,
      setGreengrassCoreDeviceStatus,
      setIsGreengrassCoreDeviceNameValid,
      statusMap
    });
  };

  /**
   * Handles the Greengrass core device registration. It shows the confirmation modal.
   * @param event The Greengrass core device handle form event
   */
  function handleGreengrassCoreDevice(event: FormEvent): void {
    event.preventDefault();
    setConfirmMessage(I18n.get('info.message.register.greengrass.core.device').replace('{}', greengrassCoreDeviceName));

    if (createdBy === CreatedBy.USER && greengrassCoreDeviceStatus !== 'HEALTHY') {
      setConfirmMessage(
        I18n.get('warning.message.unhealthy.greengrass.core.device').replace('{}', greengrassCoreDeviceName)
      );
    }

    setShowConfirmMessageModal(true);
  }

  /**
   * Registers a Greengrass core device.
   */
  async function registerGreengrassCoreDevice(): Promise<void> {
    setLoading(true);

    try {
      const response = (await requestApi({
        method: 'post',
        path: '/greengrass',
        options: {
          body: {
            name: greengrassCoreDeviceName,
            control: GreengrassCoreDeviceControl.CREATE,
            createdBy
          }
        }
      })) as GreengrassCoreDevicePostResponse;

      setMessage(<span>{response.message}</span>);
      setHasConfirmActionError(false);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowConfirmMessageModal(false);
      setHasConfirmActionError(true);
      setMessage(
        <Alert variant="danger">
          {I18n.get('error.message.register.greengrass.core.device')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          <br />
        </Alert>
      );
    }

    setLoading(false);
    setShowMessageModal(true);
  }

  return (
    <Container>
      <Breadcrumb>
        <LinkContainer to="/greengrass">
          <Breadcrumb.Item>{I18n.get('manage.greengrass.core.devices')}</Breadcrumb.Item>
        </LinkContainer>
        <Breadcrumb.Item active>{I18n.get('register.greengrass.core.device')}</Breadcrumb.Item>
      </Breadcrumb>
      <Card>
        <Card.Body>
          <Form onSubmit={handleGreengrassCoreDevice}>
            <Form.Group>
              <Form.Label>
                {I18n.get('category')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.category')}</Form.Text>
              <Form.Control
                data-testid="category-select"
                id={domIds.category}
                as="select"
                onChange={change}
                value={createdBy}>
                <option value={CreatedBy.SYSTEM}>{I18n.get('category.create.new.greengrass.core.device')}</option>
                <option value={CreatedBy.USER}>{I18n.get('category.bring.existing.greengrass.core.device')}</option>
              </Form.Control>
            </Form.Group>
            <GreengrassCoreDeviceInputForm
              createdBy={createdBy}
              domIds={domIds}
              greengrassCoreDeviceName={greengrassCoreDeviceName}
              greengrassCoreDevices={greengrassCoreDevices}
              handleValueChange={change}
              isGreengrassCoreDeviceNameValid={isGreengrassCoreDeviceNameValid}
            />
            <EmptyRow />
            <Row>
              <Col className="justify-content-center grid">
                <ButtonGroup>
                  <Button
                    id="register-greengrass-core-device"
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={
                      loading ||
                      (createdBy === CreatedBy.SYSTEM && !isGreengrassCoreDeviceNameValid) ||
                      (createdBy === CreatedBy.USER && greengrassCoreDevices.length === 0)
                    }>
                    <LoadingSpinner loading={loading} />
                    {I18n.get('register')}
                  </Button>
                  <EmptyCol />
                  <Button
                    id="register-greengrass-core-device"
                    variant="secondary"
                    size="sm"
                    onClick={() => close()}
                    disabled={loading}>
                    {I18n.get('cancel')}
                  </Button>
                </ButtonGroup>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      <MessageModal
        show={showConfirmMessageModal}
        hide={() => setShowConfirmMessageModal(false)}
        message={confirmMessage}
        modalType={MessageModalType.CONFIRM}
        confirmAction={() => registerGreengrassCoreDevice()}
      />
      <MessageModal
        show={showMessageModal}
        hide={() => setShowMessageModal(false)}
        message={message}
        modalType={MessageModalType.MESSAGE}
        confirmAction={hasConfirmActionError ? () => undefined : () => close()}
      />
    </Container>
  );
}
