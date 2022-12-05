// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { CreatedBy, FormControlElement, GreengrassCoreDeviceDomIds, UserGreengrassCoreDevice } from '../../util/types';
import { validateGreengrassCoreDeviceName } from '../../util/utils';

type HandleValueChangeRequest = {
  domIds: GreengrassCoreDeviceDomIds;
  event: React.ChangeEvent<FormControlElement>;
  greengrassCoreDevices: UserGreengrassCoreDevice[];
  setCreatedBy: React.Dispatch<CreatedBy>;
  setGreengrassCoreDeviceName: React.Dispatch<string>;
  setGreengrassCoreDeviceStatus: React.Dispatch<string>;
  setIsGreengrassCoreDeviceNameValid: React.Dispatch<boolean>;
  setGreengrassCoreDeviceOSPlatform: React.Dispatch<string>;
  statusMap: Map<string, string>;
};

/**
 * Handles the value change.
 * @param props The handle value change function properties
 * @param props.domIds The DOM IDs
 * @param props.event The React change event
 * @param props.greengrassCoreDevices The Greengrass core devices
 * @param props.setCreatedBy Setting created by function
 * @param props.setGreengrassCoreDeviceName Setting Greengrass core device name function
 * @param props.setGreengrassCoreDeviceStatus Setting Greengrass core device status function
 * @param props.setIsGreengrassCoreDeviceNameValid Setting Greengrass core device name valid check function
 * @param props.statusMap The Greengrass core device status map
 */
export function handleValueChange(props: HandleValueChangeRequest): void {
  const {
    domIds,
    event,
    greengrassCoreDevices,
    setCreatedBy,
    setGreengrassCoreDeviceName,
    setGreengrassCoreDeviceStatus,
    setIsGreengrassCoreDeviceNameValid,
    setGreengrassCoreDeviceOSPlatform,
    statusMap
  } = props;
  const { id, value } = event.target;

  switch (id) {
    case domIds.category:
      setCreatedBy(value as CreatedBy);
      setGreengrassCoreDeviceName('');
      setGreengrassCoreDeviceStatus('');
      setIsGreengrassCoreDeviceNameValid(false);

      if (value === CreatedBy.USER && greengrassCoreDevices.length > 0) {
        setGreengrassCoreDeviceName(greengrassCoreDevices[0].coreDeviceThingName);
        setGreengrassCoreDeviceStatus(greengrassCoreDevices[0].status);
      }

      break;
    case domIds.greengrassCoreDeviceName:
      setGreengrassCoreDeviceName(value);

      if (event.target instanceof HTMLSelectElement) {
        setGreengrassCoreDeviceStatus(statusMap.get(value) || 'UNKNOWN');
      } else {
        setIsGreengrassCoreDeviceNameValid(validateGreengrassCoreDeviceName(value));
      }

      break;
    case domIds.osPlatform:
      setGreengrassCoreDeviceOSPlatform(value);
      break;
    default:
      break;
  }
}
