// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { FormProps } from '../../util/types';

/**
 * Renders the OPC DA form.
 * @param props The properties for the OPC DA form
 * @returns The OPC DA form
 */
export default function OpcDaForm(props: FormProps): JSX.Element {
  const { connection, onChange, errors } = props;

  return (
    <>
      <Form.Group>
        <Form.Label>
          {I18n.get('iterations')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.iterations')}</Form.Text>
        <Form.Control
          id="iterations"
          required
          type="text"
          placeholder={I18n.get('placeholder.iterations')}
          defaultValue={connection.opcDa?.iterations}
          onChange={onChange}
          isInvalid={!!errors.iterations}
        />
        <Form.Control.Feedback type="invalid">{errors.iterations}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('time.interval')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.interval')}</Form.Text>
        <Form.Control
          id="interval"
          required
          type="text"
          placeholder={I18n.get('placeholder.time.interval')}
          defaultValue={connection.opcDa?.interval}
          onChange={onChange}
          isInvalid={!!errors.interval}
        />
        <Form.Control.Feedback type="invalid">{errors.interval}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('server.name')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.server.name')}</Form.Text>
        <Form.Control
          id="serverName"
          required
          type="text"
          placeholder={I18n.get('placeholder.opcda.server.name')}
          defaultValue={connection.opcDa?.serverName}
          onChange={onChange}
          isInvalid={!!errors.opcDa_serverName}
        />
        <Form.Control.Feedback type="invalid">{errors.opcDa_serverName}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('machine.ip')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.machine.ip')}</Form.Text>
        <Form.Control
          id="machineIp"
          required
          type="text"
          placeholder={I18n.get('placeholder.machine.ip')}
          defaultValue={connection.opcDa?.machineIp}
          onChange={onChange}
          isInvalid={!!errors.opcDa_machineIp}
        />
        <Form.Control.Feedback type="invalid">{errors.opcDa_machineIp}</Form.Control.Feedback>
      </Form.Group>
      <Card>
        <Card.Body>
          <Card.Subtitle>
            {I18n.get('tags')} {I18n.get('tags.explanation')}
          </Card.Subtitle>
          <Form.Group>
            <Form.Label>{I18n.get('read.list.tags')}</Form.Label>
            <Form.Control
              id="opcDaListTags"
              as="textarea"
              placeholder={I18n.get('placeholder.list.tags')}
              onChange={onChange}
              defaultValue={connection.opcDaListTags}
              isInvalid={!!errors.tags}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>{I18n.get('read.tags')}</Form.Label>
            <Form.Control
              id="opcDaTags"
              as="textarea"
              placeholder={I18n.get('placeholder.tags')}
              onChange={onChange}
              defaultValue={connection.opcDaTags}
              isInvalid={!!errors.tags}
            />
            <Form.Control.Feedback type="invalid">{errors.tags}</Form.Control.Feedback>
          </Form.Group>
        </Card.Body>
      </Card>
    </>
  );
}
