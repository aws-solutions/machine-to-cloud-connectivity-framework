// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import Form from 'react-bootstrap/Form';
import { FormProps } from '../../util/types';

/**
 * Renders the Modbus TCP form.
 * @param props The properties for the Modbus TCP form
 * @returns The Modbus TCP form
 */
export default function ModbusTcpForm(props: FormProps): React.JSX.Element {
  const { connection, onChange, errors } = props;

  return (
    <>
      <Form.Group>
        <Form.Label>
          {I18n.get('host')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.modbus.tcp.host')}</Form.Text>
        <Form.Control
          id="modbusTcp_host"
          required
          type="text"
          placeholder={I18n.get('placeholder.modbus.tcp.host')}
          defaultValue={connection.modbusTcp?.host}
          onChange={onChange}
          isInvalid={errors.modbusTcp_host != undefined}
        />
        <Form.Control.Feedback type="invalid">{errors.modbusTcp_host}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('port')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.modbus.tcp.hostPort')}</Form.Text>
        <Form.Control
          id="modbusTcp_hostPort"
          required
          type="text"
          placeholder={I18n.get('placeholder.modbus.tcp.hostPort')}
          defaultValue={connection.modbusTcp?.hostPort}
          onChange={onChange}
          isInvalid={!!errors.modbusTcp_hostPort}
        />
        <Form.Control.Feedback type="invalid">{errors.modbusTcp_hostPort}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('host.tag')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.modbus.tcp.hostTag')}</Form.Text>
        <Form.Control
          id="modbusTcp_hostTag"
          required
          type="text"
          placeholder={I18n.get('placeholder.modbus.tcp.hostTag')}
          defaultValue={connection.modbusTcp?.hostTag}
          onChange={onChange}
          isInvalid={!!errors.modbusTcp_hostTag}
        />
        <Form.Control.Feedback type="invalid">{errors.modbusTcp_hostTag}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('modbus.secondary.config')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.modbus.secondary.config')}</Form.Text>
        <Form.Control
          id="modbusTcp_modbusSecondariesConfigSerialized"
          required
          type="text"
          placeholder={I18n.get('placeholder.modbus.secondary.config')}
          defaultValue={connection.modbusTcp?.modbusSecondariesConfigSerialized}
          onChange={onChange}
          isInvalid={!!errors.modbusTcp_modbusSecondariesConfigSerialized}
          as="textarea"
          rows={15}
        />
        <Form.Control.Feedback type="invalid">
          {errors.modbusTcp_modbusSecondariesConfigSerialized}
        </Form.Control.Feedback>
      </Form.Group>
    </>
  );
}
