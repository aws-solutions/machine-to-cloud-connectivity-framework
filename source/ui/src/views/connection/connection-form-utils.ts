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
  ModbusTcpDefinition,
  OpcDaDefinition,
  OpcUaDefinition,
  OsiPiDefinition
} from '../../util/types';
import { buildPerLineTags, copyObject, getConditionalValue, setValue } from '../../util/utils';
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
    connectionDefinition.opcDa.listTags = buildPerLineTags(connection.opcDaListTags);
    connectionDefinition.opcDa.tags = buildPerLineTags(connection.opcDaTags);
  } else if (connectionDefinition.protocol === MachineProtocol.OPCUA) {
    connectionDefinition.opcUa = connection.opcUa;
  } else if (connectionDefinition.protocol === MachineProtocol.OSIPI) {
    connectionDefinition.osiPi = connection.osiPi as OsiPiDefinition;
    connectionDefinition.osiPi.tags = buildPerLineTags(connection.osiPiTags);
<<<<<<< HEAD
=======
  } else if (connectionDefinition.protocol === MachineProtocol.MODBUSTCP) {
    connectionDefinition.modbusTcp = connection.modbusTcp as ModbusTcpDefinition;
>>>>>>> main
  }

  const newErrors = validateConnectionDefinition(connectionDefinition);

  /**
   * For the OPC UA, the server name should be unique, so if the server name is valid,
   * it checks if the server name is unique.
   */
  await checkForUniqueOpcUaServerName(connectionDefinition, newErrors);

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
 *
 * @param connectionDefinition
 * @param newErrors
 */
async function checkForUniqueOpcUaServerName(connectionDefinition: ConnectionDefinition, newErrors: KeyStringValue) {
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
}

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

  if (event.target.type == 'checkbox') {
    const { checked } = event.target as HTMLInputElement;
    value = checked;
  }

  // To prevent same ID from different protocols, OPC UA has prefix.
  let opcUaId: string | undefined;
  if (id.startsWith('opcUa-')) {
    opcUaId = id.split('-').pop() as string;
  }

  // To prevent same ID from different protocols, OSI PI has prefix.
  let osiPiId: string | undefined;
  if (id.startsWith('osiPi_')) {
    osiPiId = id.split('_').pop() as string;
  }

<<<<<<< HEAD
=======
  let modbusTcpId: string | undefined;
  if (id.startsWith('modbusTcp_')) {
    modbusTcpId = id.split('_').pop() as string;
  }

>>>>>>> main
  let valueChangeCondition: boolean;
  if (typeof opcUaId !== 'undefined') {
    valueChangeCondition = setValue(copiedConnection.opcUa as Record<string, unknown>, opcUaId, value);
  } else if (typeof osiPiId !== 'undefined') {
    valueChangeCondition = setValue(copiedConnection.osiPi as Record<string, unknown>, osiPiId, value);
<<<<<<< HEAD
=======
  } else if (typeof modbusTcpId !== 'undefined') {
    valueChangeCondition = setValue(copiedConnection.modbusTcp as Record<string, unknown>, modbusTcpId, value);
>>>>>>> main
  } else {
    valueChangeCondition = setValue(copiedConnection, id, value);
  }

  if (valueChangeCondition) {
<<<<<<< HEAD
    setConnection(copiedConnection as unknown as GetConnectionResponse);

    // Since `listTags` and `tags` need to be built to the array, it does not check the validation in real time.
    if (!['opcDaListTags', 'opcDaTags'].includes(id)) {
      const newErrors = validateConnectionDefinition(copiedConnection as unknown as ConnectionDefinition);

      if (
        osiPiId === undefined &&
        (id.toLowerCase().endsWith('machineip') || id.toLowerCase().endsWith('servername'))
      ) {
        id = getConditionalValue<string>(opcUaId, `opcUa_${opcUaId}`, `opcDa_${id}`);
      }

      const errorsObj = {
        ...errors,
        [id]: newErrors[id]
      };

      if (id === 'osiPi_requestFrequency' || newErrors.osiPi_catchupFrequency == undefined) {
        errorsObj['osiPi_catchupFrequency'] = newErrors['osiPi_catchupFrequency'];
      }

      if (id === 'osiPi_requestFrequency' || newErrors.osiPi_maxRequestDuration == undefined) {
        errorsObj['osiPi_maxRequestDuration'] = newErrors['osiPi_maxRequestDuration'];
      }

      setErrors(errorsObj);
    }
=======
    id = handleValueChangeCondition(setConnection, copiedConnection, id, osiPiId, opcUaId, errors, setErrors); //NOSONAR
>>>>>>> main
  }
}
/**
 *
 * @param setConnection
 * @param copiedConnection
 * @param id
 * @param osiPiId
 * @param opcUaId
 * @param errors
 * @param setErrors
 */
function handleValueChangeCondition(
  setConnection: React.Dispatch<GetConnectionResponse>,
  copiedConnection: Record<string, unknown>,
  id: string,
  osiPiId: string | undefined,
  opcUaId: string | undefined,
  errors: KeyStringValue,
  setErrors: React.Dispatch<KeyStringValue>
) {
  setConnection(copiedConnection as unknown as GetConnectionResponse);

  // Since `listTags` and `tags` need to be built to the array, it does not check the validation in real time.
  if (!['opcDaListTags', 'opcDaTags'].includes(id)) {
    const newErrors = validateConnectionDefinition(copiedConnection as unknown as ConnectionDefinition);

    if (osiPiId === undefined && (id.toLowerCase().endsWith('machineip') || id.toLowerCase().endsWith('servername'))) {
      id = getConditionalValue<string>(opcUaId, `opcUa_${opcUaId}`, `opcDa_${id}`);
    }

    const errorsObj = {
      ...errors,
      [id]: newErrors[id]
    };

    if (id === 'osiPi_requestFrequency' || newErrors.osiPi_catchupFrequency == undefined) {
      errorsObj['osiPi_catchupFrequency'] = newErrors['osiPi_catchupFrequency'];
    }

    if (id === 'osiPi_requestFrequency' || newErrors.osiPi_maxRequestDuration == undefined) {
      errorsObj['osiPi_maxRequestDuration'] = newErrors['osiPi_maxRequestDuration'];
    }

    setErrors(errorsObj);
  }
  return id;
}
