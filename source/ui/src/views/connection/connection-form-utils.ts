// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { requestApi } from '../../util/apis';
import {
  ConnectionControl,
  ConnectionDefinition,
  FormControlElement,
  GetConnectionResponse,
  KeyStringValue,
  MachineProtocol,
  OpcDaDefinition,
  OpcUaDefinition
} from '../../util/types';
import { buildOpcDaTags, copyObject, getConditionalValue, setValue } from '../../util/utils';
import { validateConnectionDefinition } from '../../util/validations';

type CheckErrorsRequest = {
  connection: GetConnectionResponse;
  connectionDefinition: ConnectionDefinition;
};

/**
 * Checks if the connection definition has any errors.
 * @param props The current connection and the new connection definition
 * @returns The errors
 */
export async function checkErrors(props: CheckErrorsRequest): Promise<KeyStringValue> {
  const { connection, connectionDefinition } = props;

  if (connectionDefinition.protocol === MachineProtocol.OPCDA) {
    connectionDefinition.opcDa = connection.opcDa as OpcDaDefinition;
    connectionDefinition.opcDa.listTags = buildOpcDaTags(connection.listTags);
    connectionDefinition.opcDa.tags = buildOpcDaTags(connection.tags);
  } else if (connectionDefinition.protocol === MachineProtocol.OPCUA) {
    connectionDefinition.opcUa = connection.opcUa;
  }

  const newErrors = validateConnectionDefinition(connectionDefinition);

  /**
   * For the OPC UA, the server name should be unique, so if the server name is valid,
   * it checks if the server name is unique.
   */
  if (connectionDefinition.protocol === MachineProtocol.OPCUA && !newErrors.opcUa_serverName) {
    const serverName = (connectionDefinition.opcUa as OpcUaDefinition).serverName;
    const opcUaConnection = (await requestApi({
      method: 'get',
      path: `/sitewise/${encodeURIComponent(serverName)}`
    })) as GetConnectionResponse;

    if (Object.keys(opcUaConnection).length > 0) {
      if (connectionDefinition.control === ConnectionControl.DEPLOY) {
        newErrors.opcUa_serverName = I18n.get('invalid.duplicated.server.name');
      } else {
        /**
         * If it's updating the connection, the server name can be updated as well,
         * so if the server name on the form is same to the connection's server name, it's not an error.
         */
        const existingConnection = (await requestApi({
          method: 'get',
          path: `/connections/${encodeURIComponent(connectionDefinition.connectionName)}`
        })) as GetConnectionResponse;
        const existingOpcUa = existingConnection.opcUa;

        if (existingOpcUa?.serverName !== serverName) {
          newErrors.opcUa_serverName = I18n.get('invalid.duplicated.server.name');
        }
      }
    }
  }

  return newErrors;
}

type HandleValueChangeRequest = {
  connection: GetConnectionResponse;
  errors: KeyStringValue;
  event: React.ChangeEvent<FormControlElement>;
  setConnection: React.Dispatch<GetConnectionResponse>;
  setErrors: React.Dispatch<KeyStringValue>;
};

/**
 * Handles the value change.
 * @param props The handle value change function properties
 * @param props.connection The connection
 * @param props.errors The input errors
 * @param props.event The React change event
 * @param props.setConnection Setting connection function
 * @param props.setErrors Setting errors function
 */
export function handleValueChange(props: HandleValueChangeRequest): void {
  const { connection, errors, event, setConnection, setErrors } = props;
  let { id } = event.target;
  let value: string | boolean = event.target.value;
  const copiedConnection = copyObject(connection as unknown as Record<string, unknown>);

  if (id.startsWith('sendDataTo')) {
    const { checked } = event.target as HTMLInputElement;
    value = checked;
  }

  // To prevent same ID from different protocols, OPC UA has prefix.
  let opcUaId: string | undefined;
  if (id.startsWith('opcUa')) {
    opcUaId = id.split('-').pop() as string;
  }

  let valueChangeCondition: boolean;
  if (typeof opcUaId !== 'undefined') {
    valueChangeCondition = setValue(copiedConnection.opcUa as Record<string, unknown>, opcUaId, value);
  } else {
    valueChangeCondition = setValue(copiedConnection, id, value);
  }

  if (valueChangeCondition) {
    setConnection(copiedConnection as unknown as GetConnectionResponse);

    // Since `listTags` and `tags` need to be built to the array, it does not check the validation in real time.
    if (!['listTags', 'tags'].includes(id)) {
      const newErrors = validateConnectionDefinition(copiedConnection as unknown as ConnectionDefinition);

      if (id.toLowerCase().endsWith('machineip') || id.toLowerCase().endsWith('servername')) {
        id = getConditionalValue<string>(opcUaId, `opcUa_${opcUaId}`, `opcDa_${id}`);
      }

      setErrors({
        ...errors,
        [id]: newErrors[id]
      });
    }
  }
}
