// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import Form from 'react-bootstrap/Form';
import { FormProps } from '../../util/types';

/**
 * Renders the OPC UA form.
 * @param props The properties for the OPC UA form
 * @returns The OPC UA form
 */
export default function OpcUaForm(props: FormProps): React.JSX.Element {
  const { connection, onChange, errors } = props;

  return (
    <>
      <Form.Group>
        <Form.Label>
          {I18n.get('server.name')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.server.name')}</Form.Text>
        <Form.Control
          id="opcUa-serverName"
          required
          type="text"
          placeholder={I18n.get('placeholder.opcua.server.name')}
          defaultValue={connection.opcUa?.serverName}
          onChange={onChange}
          isInvalid={!!errors.opcUa_serverName}
        />
        <Form.Control.Feedback type="invalid">{errors.opcUa_serverName}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('machine.ip')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.machine.ip')}</Form.Text>
        <Form.Control
          id="opcUa-machineIp"
          required
          type="text"
          placeholder={I18n.get('placeholder.machine.ip')}
          defaultValue={connection.opcUa?.machineIp}
          onChange={onChange}
          isInvalid={!!errors.opcUa_machineIp}
        />
        <Form.Control.Feedback type="invalid">{errors.opcUa_machineIp}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>{I18n.get('port')}</Form.Label>
        <Form.Text muted>{I18n.get('description.port')}</Form.Text>
        <Form.Control
          id="port"
          type="text"
          placeholder={I18n.get('placeholder.port')}
          defaultValue={connection.opcUa?.port}
          onChange={onChange}
          isInvalid={!!errors.port}
        />
        <Form.Control.Feedback type="invalid">{errors.port}</Form.Control.Feedback>
      </Form.Group>
    </>
  );
}
