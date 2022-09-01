// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import { FormProps, OsiPiAuthMode } from '../../util/types';
import EmptyRow from '../../components/EmptyRow';

/**
 * Renders the OSI PI form.
 * @param props The properties for the OSI PI form
 * @returns The OSI PI form
 */
export default function OsiPiForm(props: FormProps): JSX.Element {
  const { connection, onChange, errors } = props;

  return (
    <>
      <Form.Group>
        <Form.Label>
          {I18n.get('api.url')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.osiPi.apiUrl')}</Form.Text>
        <Form.Control
          id="osiPi_apiUrl"
          required
          type="text"
          placeholder={I18n.get('placeholder.osiPi.apiUrl')}
          defaultValue={connection.osiPi?.apiUrl}
          onChange={onChange}
          isInvalid={errors.osiPi_apiUrl != undefined}
        />
        <Form.Control.Feedback type="invalid">{errors.osiPi_apiUrl}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group>
        <Form.Check
          inline
          type="checkbox"
          id="osiPi_verifySSL"
          label={I18n.get('verify.ssl')}
          checked={connection.osiPi?.verifySSL}
          onChange={onChange}
        />
      </Form.Group>
      <Form.Group>
        <Form.Label>
          {I18n.get('server.name')} <span className="red-text">*</span>
        </Form.Label>
        <Form.Text muted>{I18n.get('description.osiPi.serverName')}</Form.Text>
        <Form.Control
          id="osiPi_serverName"
          required
          type="text"
          placeholder={I18n.get('placeholder.osiPi.serverName')}
          defaultValue={connection.osiPi?.serverName}
          onChange={onChange}
          isInvalid={!!errors.osiPi_serverName}
        />
        <Form.Control.Feedback type="invalid">{errors.osiPi_serverName}</Form.Control.Feedback>
      </Form.Group>
      <Card>
        <Card.Body>
          <Card.Subtitle>{I18n.get('authentication')}</Card.Subtitle>
          <EmptyRow />
          <Form.Group>
            <Form.Label>
              {I18n.get('auth.mode')} <span className="red-text">*</span>
            </Form.Label>
            <Form.Text muted>{I18n.get('description.osiPi.authMode')}</Form.Text>
            <Form.Control id="osiPi_authMode" as="select" onChange={onChange} value={connection.osiPi?.authMode}>
              <option value={OsiPiAuthMode.ANONYMOUS}>Anonymous</option>
              <option value={OsiPiAuthMode.BASIC}>Basic</option>
            </Form.Control>
          </Form.Group>

          {connection.osiPi?.authMode === OsiPiAuthMode.BASIC && (
            <Form.Group>
              <Form.Label>
                {I18n.get('username')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.osiPi.username')}</Form.Text>
              <Form.Control
                id="osiPi_username"
                required
                type="text"
                placeholder={I18n.get('placeholder.osiPi.username')}
                defaultValue={connection.osiPi?.username}
                onChange={onChange}
                isInvalid={!!errors.osiPi_username}
              />
              <Form.Control.Feedback type="invalid">{errors.osiPi_username}</Form.Control.Feedback>
            </Form.Group>
          )}

          {connection.osiPi?.authMode === OsiPiAuthMode.BASIC && (
            <Form.Group>
              <Form.Label>
                {I18n.get('password')} <span className="red-text">*</span>
              </Form.Label>
              <Form.Text muted>{I18n.get('description.osiPi.password')}</Form.Text>
              <Form.Control
                id="osiPi_password"
                required
                type="password"
                placeholder={I18n.get('placeholder.osiPi.password')}
                defaultValue={connection.osiPi?.password}
                onChange={onChange}
                isInvalid={!!errors.osiPi_password}
              />
              <Form.Control.Feedback type="invalid">{errors.osiPi_password}</Form.Control.Feedback>
            </Form.Group>
          )}
        </Card.Body>
      </Card>

      <EmptyRow />

      <Card>
        <Card.Body>
          <Card.Subtitle>{I18n.get('query.config')}</Card.Subtitle>
          <EmptyRow />
          <Form.Group>
            <Form.Label>
              {I18n.get('request.frequency')} <span className="red-text">*</span>
            </Form.Label>
            <Form.Text muted>{I18n.get('description.osiPi.requestFrequency')}</Form.Text>
            <Form.Control
              id="osiPi_requestFrequency"
              required
              type="text"
              placeholder={I18n.get('placeholder.osiPi.requestFrequency')}
              defaultValue={connection.osiPi?.requestFrequency}
              onChange={onChange}
              isInvalid={!!errors.osiPi_requestFrequency}
            />
            <Form.Control.Feedback type="invalid">{errors.osiPi_requestFrequency}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>
              {I18n.get('catchup.frequency')} <span className="red-text">*</span>
            </Form.Label>
            <Form.Text muted>{I18n.get('description.osiPi.catchupFrequency')}</Form.Text>
            <Form.Control
              id="osiPi_catchupFrequency"
              required
              type="text"
              placeholder={I18n.get('placeholder.osiPi.catchupFrequency')}
              defaultValue={connection.osiPi?.catchupFrequency}
              onChange={onChange}
              isInvalid={!!errors.osiPi_catchupFrequency}
            />
            <Form.Control.Feedback type="invalid">{errors.osiPi_catchupFrequency}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>
              {I18n.get('max.request.duration')} <span className="red-text">*</span>
            </Form.Label>
            <Form.Text muted>{I18n.get('description.osiPi.maxRequestDuration')}</Form.Text>
            <Form.Control
              id="osiPi_maxRequestDuration"
              required
              type="text"
              placeholder={I18n.get('placeholder.osiPi.maxRequestDuration')}
              defaultValue={connection.osiPi?.maxRequestDuration}
              onChange={onChange}
              isInvalid={!!errors.osiPi_maxRequestDuration}
            />
            <Form.Control.Feedback type="invalid">{errors.osiPi_maxRequestDuration}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>
              {I18n.get('query.offset')} <span className="red-text">*</span>
            </Form.Label>
            <Form.Text muted>{I18n.get('description.osiPi.queryOffset')}</Form.Text>
            <Form.Control
              id="osiPi_queryOffset"
              required
              type="text"
              placeholder={I18n.get('placeholder.osiPi.queryOffset')}
              defaultValue={connection.osiPi?.queryOffset}
              onChange={onChange}
              isInvalid={!!errors.osiPi_queryOffset}
            />
            <Form.Control.Feedback type="invalid">{errors.osiPi_queryOffset}</Form.Control.Feedback>
          </Form.Group>
        </Card.Body>
      </Card>

      <EmptyRow />

      <Card>
        <Card.Body>
          <Card.Subtitle>
            {I18n.get('tags')} {I18n.get('tags.explanation')}
          </Card.Subtitle>
          <EmptyRow />
          <Form.Group>
            <Form.Label>{I18n.get('read.tags')}</Form.Label>
            <Form.Control
              id="osiPiTags"
              as="textarea"
              placeholder={I18n.get('placeholder.osiPi.tags')}
              onChange={onChange}
              defaultValue={connection.osiPiTags}
              isInvalid={!!errors.osiPi_Tags}
            />
            <Form.Control.Feedback type="invalid">{errors.osiPi_Tags}</Form.Control.Feedback>
          </Form.Group>
        </Card.Body>
      </Card>
    </>
  );
}
