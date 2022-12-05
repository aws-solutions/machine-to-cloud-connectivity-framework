// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface ModbusTcpDefinition {
  host: string;
  hostPort: number;
  hostTag: string;
  modbusSlavesConfig: ModbusTcpSlaveDefinition[];
}

export interface ModbusTcpSlaveDefinition {
  slaveAddress: string;
  frequencyInSeconds: number;
  commandConfig: ModbusTcpSlaveCommandConfig;
}

export interface ModbusTcpSlaveCommandConfig {
  readCoils?: ModbusTcpSlaveCommandReadCoilsConfig;
  readDiscreteInputs?: ModbusTcpSlaveCommandReadDiscreteInputsConfig;
  readHoldingRegisters?: ModbusTcpSlaveCommandReadHoldingRegistersConfig;
  readInputRegisters?: ModbusTcpSlaveCommandReadInputRegistersConfig;
}

export interface ModbusTcpSlaveCommandIndividualConfig {
  enabled: boolean;
  address: string;
  count?: number;
}

export type ModbusTcpSlaveCommandReadCoilsConfig = ModbusTcpSlaveCommandIndividualConfig;
export type ModbusTcpSlaveCommandReadDiscreteInputsConfig = ModbusTcpSlaveCommandIndividualConfig;
export type ModbusTcpSlaveCommandReadHoldingRegistersConfig = ModbusTcpSlaveCommandIndividualConfig;
export type ModbusTcpSlaveCommandReadInputRegistersConfig = ModbusTcpSlaveCommandIndividualConfig;
