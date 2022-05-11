// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { consoleErrorSpy, mockAwsLambda } from './mock';
import { LambdaError } from '../errors';
import LambdaHandler from '../aws-handlers/lambda-handler';

const lambdaHandler = new LambdaHandler();

describe('Unit tests of invokeGreengrassDeployer() function', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    control: 'mock'
  };

  beforeEach(() => {
    mockAwsLambda.invoke.mockReset();
    consoleErrorSpy.mockReset();
  });

  test('Test success to invoke the Greengrass deployer Lambda function', async () => {
    mockAwsLambda.invoke.mockImplementationOnce(() => ({
      promise() {
        return Promise.resolve();
      }
    }));

    await lambdaHandler.invokeGreengrassDeployer(payload);
    expect(mockAwsLambda.invoke).toHaveBeenCalledTimes(1);
    expect(mockAwsLambda.invoke).toHaveBeenCalledWith({
      FunctionName: process.env.GREENGRASS_DEPLOYER_LAMBDA_FUNCTION,
      InvocationType: 'Event',
      Payload: JSON.stringify(payload)
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test failure to invoke the Greengrass deployer Lambda function', async () => {
    mockAwsLambda.invoke.mockImplementationOnce(() => ({
      promise() {
        return Promise.reject('Failure');
      }
    }));

    try {
      await lambdaHandler.invokeGreengrassDeployer(payload);
    } catch (error) {
      expect(mockAwsLambda.invoke).toHaveBeenCalledTimes(1);
      expect(mockAwsLambda.invoke).toHaveBeenCalledWith({
        FunctionName: process.env.GREENGRASS_DEPLOYER_LAMBDA_FUNCTION,
        InvocationType: 'Event',
        Payload: JSON.stringify(payload)
      });
      expect(error).toEqual(
        new LambdaError({
          message: `Failed to ${payload.control} the connection.`,
          name: 'LambdaHandlerError'
        })
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[LambdaHandler]', '[invokeGreengrassDeployer] Error: ', 'Failure');
    }
  });
});
