// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n, Logger } from '@aws-amplify/core';
import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { useNavigate } from 'react-router-dom';
import { requestApi } from '../util/apis';
import {
  GetConnectionResponse,
  ListConnectionsItem,
  ListConnectionsResponse,
  ListGreengrassCoreDevicesResponse,
  ListLogsItem,
  ListLogsResponse,
  MachineProtocol,
  OpcUaDefinition,
  PaginationType
} from '../util/types';
import { getErrorMessage, getPaginationNextToken, handlePagination, INIT_CONNECTION } from '../util/utils';

type ConnectionHookRequest = {
  setConnection: React.Dispatch<GetConnectionResponse>;
  setMessageModalMessage: React.Dispatch<string | React.ReactNode>;
  setShowMessageMessageModal: React.Dispatch<boolean>;
  connectionName?: string;
};

type ConnectionHookResponse = {
  close: () => void;
  greengrassCoreDevices: string[];
};

/**
 * Connection hook.
 * It calls APIs to get and set a connection and get Greengrass core devices and returns Greengrass core devices.
 * @param props Connection hook request properties
 * @returns Greengrass core devices
 */
export function ConnectionHook(props: ConnectionHookRequest): ConnectionHookResponse {
  const { setConnection, setShowMessageMessageModal, setMessageModalMessage, connectionName } = props;
  const navigate = useNavigate();
  const [greengrassCoreDevices, setGreengrassCoreDevices] = useState<string[]>([]);
  const logger = new Logger('ConnectionHook');

  /**
   * Get a connection. This is for updating connection.
   * If there's no key value for optional values, it sets the default value.
   */
  const getConnection = useCallback(async () => {
    try {
      const encodedConnectionName = encodeURIComponent(`${connectionName}`);
      const response = (await requestApi({
        method: 'get',
        path: `/connections/${encodedConnectionName}`
      })) as GetConnectionResponse;

      if (response.protocol === MachineProtocol.OPCDA) {
<<<<<<< HEAD
        const opcDaListTags: string[] = [];
        const tags: string[] = [];

        if (response.opcDa?.listTags) {
          for (const tag of response.opcDa.listTags) {
            opcDaListTags.push(tag);
          }
        }

        if (response.opcDa?.tags) {
          for (const tag of response.opcDa.tags) {
            tags.push(tag);
          }
        }

        response.opcDaListTags = opcDaListTags.join('\n');
        response.opcDaTags = tags.join('\n');
=======
        handleOpcDaMachineProtocol(response);
>>>>>>> main
      } else if (response.protocol === MachineProtocol.OPCUA) {
        if (response.opcUa?.port === undefined) {
          (response.opcUa as OpcUaDefinition).port = '';
        }
      } else if (response.protocol === MachineProtocol.OSIPI) {
<<<<<<< HEAD
        if (response.osiPi != undefined) {
          if (response.osiPi.username == undefined) {
            response.osiPi.username = INIT_CONNECTION.osiPi?.username;
          }
          if (response.osiPi.password == undefined) {
            response.osiPi.password = INIT_CONNECTION.osiPi?.password;
          }
        }

        const tags: string[] = [];

        if (response.osiPi?.tags) {
          for (const tag of response.osiPi.tags) {
            tags.push(tag);
          }
        }

        response.osiPiTags = tags.join('\n');
=======
        handleOsiPiMachineProtocol(response);
>>>>>>> main
      }

      setConnection(response);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.connection')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
    }
  }, [connectionName]);

  /**
   * Gets Greengrass core devices.
   * It only happens when creating a connection.
   */
  const getGreengrassCoreDevices = useCallback(async () => {
    try {
      const devices: string[] = [];
      let nextToken: string | undefined;

      do {
        const response = (await requestApi({
          method: 'get',
          path: '/greengrass',
          options: {
            queryStringParameters: { nextToken }
          }
        })) as ListGreengrassCoreDevicesResponse;
        devices.push(...response.greengrassCoreDevices.map(greengrassCoreDevice => greengrassCoreDevice.name));
        nextToken = response.nextToken;
      } while (typeof nextToken !== 'undefined');

      setGreengrassCoreDevices(devices);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);

      setShowMessageMessageModal(true);
      setMessageModalMessage(
        <Alert variant="danger">
          {I18n.get('error.message.get.greengrass.core.devices')}
          <br />
          {I18n.get('error')}: <code>{JSON.stringify(errorMessage)}</code>
        </Alert>
      );
    }
  }, []);

  /**
   * Closes the connection form, and it goes to the main page.
   */
  const close = useCallback(() => {
    navigate('/');
  }, [navigate]);

  /**
   * React useEffect hook.
   * For the new connection, it gets Greengrass core devices.
   * For the updating connection, it gets the connection.
   */
  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      if (connectionName) getConnection();
      else getGreengrassCoreDevices();
    }

    return () => {
      isMounted = false;
    };
  }, [connectionName, getConnection, getGreengrassCoreDevices]);

  return {
    close,
    greengrassCoreDevices
  };
}

type ConnectionsHookRequest = {
  setDeleteConnectionProtocol: React.Dispatch<MachineProtocol | undefined>;
  setMessageModalMessage: React.Dispatch<string | React.ReactNode>;
  setShowMessageModal: React.Dispatch<boolean>;
};

type ConnectionsHookResponse = {
  connections: ListConnectionsItem[];
  getConnections: (paginationType?: PaginationType) => Promise<void>;
  loading: boolean;
  pageIndex: number;
  pageToken: string[];
};

/**
 *
 * @param response
 */
function handleOsiPiMachineProtocol(response: GetConnectionResponse) {
  if (response.osiPi != undefined) {
    if (response.osiPi.username == undefined) {
      response.osiPi.username = INIT_CONNECTION.osiPi?.username;
    }
    if (response.osiPi.password == undefined) {
      response.osiPi.password = INIT_CONNECTION.osiPi?.password;
    }
  }

  const tags: string[] = [];

  if (response.osiPi?.tags) {
    for (const tag of response.osiPi.tags) {
      tags.push(tag);
    }
  }

  response.osiPiTags = tags.join('\n');
}

/**
 *
 * @param response
 */
function handleOpcDaMachineProtocol(response: GetConnectionResponse) {
  const opcDaListTags: string[] = [];
  const tags: string[] = [];

  if (response.opcDa?.listTags) {
    for (const tag of response.opcDa.listTags) {
      opcDaListTags.push(tag);
    }
  }

  if (response.opcDa?.tags) {
    for (const tag of response.opcDa.tags) {
      tags.push(tag);
    }
  }

  response.opcDaListTags = opcDaListTags.join('\n');
  response.opcDaTags = tags.join('\n');
}

/**
 * Connections hook.
 * It calls an API to get connections and returns related resources.
 * @param props Connections hook request properties
 * @returns Connections, pagination variables, loading, and getting connections function
 */
export function ConnectionsHook(props: ConnectionsHookRequest): ConnectionsHookResponse {
  const { setDeleteConnectionProtocol, setMessageModalMessage, setShowMessageModal } = props;
  const [loading, setLoading] = useState<boolean>(false);
  const [connections, setConnections] = useState<ListConnectionsItem[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageToken, setPageToken] = useState<string[]>(['']);
  const logger = new Logger('ConnectionsHook');

  /**
   * Gets the connections.
   * @param paginationType The pagination type to get the connections
   */
  const getConnections = useCallback(
    async (paginationType?: PaginationType) => {
      setDeleteConnectionProtocol(undefined);
      setLoading(true);

      const nextToken = getPaginationNextToken({ pageIndex, pageToken, paginationType });

      try {
        const response = (await requestApi({
          method: 'get',
          path: '/connections',
          options: {
            queryStringParameters: { nextToken: nextToken || undefined }
          }
        })) as ListConnectionsResponse;
        handlePagination({ pageToken, paginationType, response, setPageIndex, setPageToken });
        setConnections(response.connections);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        logger.error(errorMessage);

        setMessageModalMessage(
          <Alert variant="danger">
            {I18n.get('error.message.get.connections')}
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
    getConnections();
  }, []);

  return {
    connections,
    getConnections,
    loading,
    pageIndex,
    pageToken
  };
}

type ConnectionLogsHookRequest = {
  connectionName: string;
  setShowMessageMessageModal: React.Dispatch<boolean>;
};

type ConnectionLogsHookResponse = {
  getLogs: (paginationType?: PaginationType) => Promise<void>;
  messageModalMessage: React.ReactNode;
  loading: boolean;
  logs: ListLogsItem[];
  pageIndex: number;
  pageToken: string[];
};

/**
 * Connection logs hook.
 * It calls an API to get connection logs and returns the related resources.
 * @param props Connection logs hook request properties
 * @returns Connection logs, pagination variables, loading, and message modal message
 */
export function ConnectionLogsHook(props: ConnectionLogsHookRequest): ConnectionLogsHookResponse {
  const { connectionName, setShowMessageMessageModal } = props;
  const [logs, setLogs] = useState<ListLogsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [messageModalMessage, setMessageModalMessage] = useState<React.ReactNode>('');
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageToken, setPageToken] = useState<string[]>(['']);
  const logger = new Logger('ConnectionLogsHook');

  /**
   * Gets the connection logs.
   * @param paginationType The pagination type to get the connection logs
   */
  const getLogs = useCallback(
    async (paginationType?: PaginationType) => {
      setLoading(true);

      const nextToken = getPaginationNextToken({ pageIndex, pageToken, paginationType });

      try {
        const encodedConnectionName = encodeURIComponent(connectionName);
        const response = (await requestApi({
          method: 'get',
          path: `/logs/${encodedConnectionName}`,
          options: {
            queryStringParameters: { nextToken: nextToken || undefined }
          }
        })) as ListLogsResponse;
        handlePagination({ pageToken, paginationType, response, setPageIndex, setPageToken });
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
        );
      }

      setLoading(false);
    },
    [connectionName, pageToken, pageIndex]
  );

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    if (connectionName) getLogs();
  }, [connectionName]);

  return {
    getLogs,
    messageModalMessage,
    loading,
    logs,
    pageIndex,
    pageToken
  };
}
