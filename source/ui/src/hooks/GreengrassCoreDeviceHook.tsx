// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { useNavigate } from 'react-router-dom';
import { requestApi } from '../util/apis';
import {
  ListGreengrassCoreDevicesItem,
  ListGreengrassCoreDevicesResponse,
  PaginationType,
  UserGreengrassCoreDevice,
  UserGreengrassCoreDeviceResponse
} from '../util/types';
import { getErrorMessage, getPaginationNextToken, handlePagination } from '../util/utils';

type UserGreengrassCoreDevicesHookRequest = {
  setHasConfirmActionError: React.Dispatch<boolean>;
  setMessage: React.Dispatch<string | React.ReactNode>;
  setShowMessageModal: React.Dispatch<boolean>;
};

type UserGreengrassCoreDevicesHookResponse = {
  close: () => void;
  greengrassCoreDevices: UserGreengrassCoreDevice[];
  statusMap: Map<string, string>;
};

/**
 * User Greengrass core devices hook.
 * It calls an API to get user Greengrass core devices and returns the related resources.
 * @param props User Greengrass core devices hook request properties
 * @returns User Greengrass core devices and Greengrass core devices status
 */
export function UserGreengrassCoreDevicesHook(
  props: UserGreengrassCoreDevicesHookRequest
): UserGreengrassCoreDevicesHookResponse {
  const { setHasConfirmActionError, setMessage, setShowMessageModal } = props;
  const navigate = useNavigate();
  const [greengrassCoreDevices, setGreengrassCoreDevices] = useState<UserGreengrassCoreDevice[]>([]);
  const statusMap = useMemo(() => new Map<string, string>(), []);
  const logger = new Logger('UserGreengrassCoreDevicesHook');

  /**
   * Gets user Greengrass core devices.
   * This only shows the available Greengrass core devices to register.
   */
  const getUserGreengrassCoreDevices = useCallback(async () => {
    try {
      const response = (await requestApi({
        method: 'get',
        path: '/greengrass/user'
      })) as UserGreengrassCoreDeviceResponse;

      for (const device of response.greengrassCoreDevices) {
        statusMap.set(device.coreDeviceThingName, device.status);
      }

      setGreengrassCoreDevices(response.greengrassCoreDevices);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.greengrass.core.devices')}
          <br />
          {I18n.get('error.message.get.greengrass.core.devices.user')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
      setHasConfirmActionError(true);
      setShowMessageModal(true);
    }
  }, [statusMap]);

  /**
   * Closes the connection form, and it goes to the main page.
   */
  const close = useCallback(() => {
    navigate('/greengrass');
  }, [navigate]);

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    getUserGreengrassCoreDevices();
  }, []);

  return {
    close,
    greengrassCoreDevices,
    statusMap
  };
}

type GreengrassCoreDevicesHookRequest = {
  setLoading: React.Dispatch<boolean>;
  setMessage: React.Dispatch<string | React.ReactNode>;
  setShowMessageModal: React.Dispatch<boolean>;
};

type GreengrassCoreDevicesHookResponse = {
  getGreengrassCoreDevices: (paginationType?: PaginationType) => Promise<void>;
  greengrassCoreDevices: ListGreengrassCoreDevicesItem[];
  pageIndex: number;
  pageToken: string[];
};

/**
 * Greengrass core devices hook.
 * It calls an API to get Greengrass core devices and returns the related resources.
 * @param props Greengrass core devices hook request properties
 * @returns Greengrass core devices, pagination variables, and getting Greengrass core devices function
 */
export function GreengrassCoreDevicesHook(props: GreengrassCoreDevicesHookRequest): GreengrassCoreDevicesHookResponse {
  const { setLoading, setMessage, setShowMessageModal } = props;
  const [greengrassCoreDevices, setGreengrassCoreDevices] = useState<ListGreengrassCoreDevicesItem[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageToken, setPageToken] = useState<string[]>(['']);
  const logger = new Logger('GreengrassCoreDevicesHook');

  /**
   * Gets Greengrass core devices
   */
  const getGreengrassCoreDevices = useCallback(
    async (paginationType?: PaginationType) => {
      setLoading(true);

      const nextToken = getPaginationNextToken({ pageIndex, pageToken, paginationType });

      try {
        const response = (await requestApi({
          method: 'get',
          path: '/greengrass',
          options: {
            queryStringParameters: { nextToken: nextToken || undefined }
          }
        })) as ListGreengrassCoreDevicesResponse;
        handlePagination({ pageToken, paginationType, response, setPageIndex, setPageToken });
        setGreengrassCoreDevices(response.greengrassCoreDevices);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        logger.error(errorMessage);

        setMessage(
          <Alert variant="danger">
            {I18n.get('error.message.get.greengrass.core.devices')}
            <br />
            {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
          </Alert>
        );
        setShowMessageModal(true);
      }

      setLoading(false);
    },
    [pageToken, pageIndex]
  );

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    getGreengrassCoreDevices();
  }, []);

  return {
    getGreengrassCoreDevices,
    greengrassCoreDevices,
    pageIndex,
    pageToken
  };
}
