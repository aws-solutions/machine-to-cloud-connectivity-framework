// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Logger, { LoggingLevel } from '../logger';

const debugSpy = jest.spyOn(console, 'debug');
const infoSpy = jest.spyOn(console, 'info');
const warnSpy = jest.spyOn(console, 'warn');
const errorSpy = jest.spyOn(console, 'error');

beforeEach(() => {
  debugSpy.mockReset();
  infoSpy.mockReset();
  warnSpy.mockReset();
  errorSpy.mockReset();
});

test('Test when the logging level is LoggingLevel.VERBOSE', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', LoggingLevel.VERBOSE);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).toHaveBeenCalledTimes(2);
  expect(debugSpy).toHaveBeenNthCalledWith(1, '[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(debugSpy).toHaveBeenNthCalledWith(2, '[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is `VERBOSE`', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'VERBOSE');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).toHaveBeenCalledTimes(2);
  expect(debugSpy).toHaveBeenNthCalledWith(1, '[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(debugSpy).toHaveBeenNthCalledWith(2, '[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is LoggingLevel.DEBUG', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', LoggingLevel.DEBUG);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).toHaveBeenCalledTimes(1);
  expect(debugSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is `DEBUG`', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'DEBUG');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).toHaveBeenCalledTimes(1);
  expect(debugSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is LoggingLevel.INFO', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', LoggingLevel.INFO);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is `INFO`', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'INFO');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).toHaveBeenCalledTimes(1);
  expect(infoSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is LoggingLevel.WARN', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', LoggingLevel.WARN);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is `WARN`', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'WARN');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith('[Test]', 'Message 1', 'Message 2', 'Message 3');
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is LoggingLevel.ERROR', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', LoggingLevel.ERROR);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is `ERROR`', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'ERROR');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is invalid, the default logging level is ERROR', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', 'invalid');
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});

test('Test when the logging level is undefined, the default logging level is ERROR', () => {
  const error = Error('Failure');
  const logging = new Logger('Test', undefined);
  logging.log(LoggingLevel.VERBOSE, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.DEBUG, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.INFO, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.WARN, 'Message 1', 'Message 2', 'Message 3');
  logging.log(LoggingLevel.ERROR, 'Message', error);

  expect(debugSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith('[Test]', 'Message', error);
});
