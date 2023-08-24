// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface ModbusTcpDefinition {
  host: string;
  hostPort: number;
  hostTag: string;
  modbusSecondariesConfig: ModbusTcpSecondaryDefinition[];
}

export interface ModbusTcpSecondaryDefinition {
  secondaryAddress: string;
  frequencyInSeconds: number;
  commandConfig: ModbusTcpSecondaryCommandConfig;
}

export interface ModbusTcpSecondaryCommandConfig {
  readCoils?: ModbusTcpSecondaryCommandReadCoilsConfig;
  readDiscreteInputs?: ModbusTcpSecondaryCommandReadDiscreteInputsConfig;
  readHoldingRegisters?: ModbusTcpSecondaryCommandReadHoldingRegistersConfig;
  readInputRegisters?: ModbusTcpSecondaryCommandReadInputRegistersConfig;
}

export interface ModbusTcpSecondaryCommandIndividualConfig {
  enabled: boolean;
  address: string;
  count?: number;
}

export type ModbusTcpSecondaryCommandReadCoilsConfig = ModbusTcpSecondaryCommandIndividualConfig;
export type ModbusTcpSecondaryCommandReadDiscreteInputsConfig = ModbusTcpSecondaryCommandIndividualConfig;
export type ModbusTcpSecondaryCommandReadHoldingRegistersConfig = ModbusTcpSecondaryCommandIndividualConfig;
export type ModbusTcpSecondaryCommandReadInputRegistersConfig = ModbusTcpSecondaryCommandIndividualConfig;
