// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import React from 'react';
import Form from 'react-bootstrap/Form';
import { CreatedBy, FormControlElement, GreengrassCoreDeviceDomIds, UserGreengrassCoreDevice } from '../../util/types';

type GreengrassCoreDeviceInputFormRequest = {
  createdBy: CreatedBy;
  domIds: GreengrassCoreDeviceDomIds;
  greengrassCoreDeviceName: string;
  greengrassCoreDevices: UserGreengrassCoreDevice[];
  handleValueChange: (event: React.ChangeEvent<FormControlElement>) => void;
  isGreengrassCoreDeviceNameValid: boolean;
};

/**
 * Renders the Greengrass core device input form.
 * @param props The Greengrass core device input properties
 * @returns The Greengrass core device input form
 */
export default function GreengrassCoreDeviceInputForm(props: GreengrassCoreDeviceInputFormRequest): JSX.Element {
  const {
    createdBy,
    domIds,
    greengrassCoreDeviceName,
    greengrassCoreDevices,
    handleValueChange,
    isGreengrassCoreDeviceNameValid
  } = props;

  return (
    <Form.Group>
      <Form.Label>
        {I18n.get('greengrass.core.device.name')} <span className="red-text">*</span>
      </Form.Label>
      {createdBy === CreatedBy.SYSTEM && (
        <>
          <Form.Text muted>{I18n.get('description.greengrass.core.device.name')}</Form.Text>
          <Form.Control
            id={domIds.greengrassCoreDeviceName}
            type="text"
            required
            defaultValue={greengrassCoreDeviceName}
            placeholder={I18n.get('placeholder.greengrass.core.device.name')}
            onChange={handleValueChange}
            isInvalid={!isGreengrassCoreDeviceNameValid}
          />
          <Form.Control.Feedback type="invalid">
            {I18n.get('invalid.greengrass.core.device.name')}
          </Form.Control.Feedback>
        </>
      )}
      {createdBy === CreatedBy.USER && (
        <>
          <Form.Text muted>{I18n.get('description.existing.greengrass.core.device.name')}</Form.Text>
          <Form.Control
            data-testid="user-greengrass-core-device-select"
            id={domIds.greengrassCoreDeviceName}
            as="select"
            onChange={handleValueChange}
            value={greengrassCoreDeviceName}>
            {greengrassCoreDevices.length === 0 && <option>{I18n.get('no.available.greengrass.core.devices')}</option>}
            {greengrassCoreDevices.length > 0 &&
              greengrassCoreDevices.map((greengrassCoreDevice: UserGreengrassCoreDevice) => (
                <option
                  key={`greengrass-core-device-${greengrassCoreDevice.coreDeviceThingName}`}
                  value={greengrassCoreDevice.coreDeviceThingName}>
                  {greengrassCoreDevice.coreDeviceThingName} ({greengrassCoreDevice.status})
                </option>
              ))}
          </Form.Control>
        </>
      )}
    </Form.Group>
  );
}
