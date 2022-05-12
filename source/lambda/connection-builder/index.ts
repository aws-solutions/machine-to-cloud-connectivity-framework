// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { handleGetRequest } from './api-get-request';
import { handlePostRequest } from './api-post-request';
import { LambdaError } from '../lib/errors';
import Logger, { LoggingLevel } from '../lib/logger';
import { APIGatewayRequest, APIGatewayResponse, APIResponseBodyType } from '../lib/types/connection-builder-types';

const { API_ENDPOINT, LOGGING_LEVEL } = process.env;
const logger = new Logger('connection-builder', LOGGING_LEVEL);

/**
 * The Lambda function deals with API requests and returns the response to the API Gateway.
 * @param event The request from the API Gateway
 * @returns The response to the API Gateway
 */
export async function handler(event: APIGatewayRequest): Promise<APIGatewayResponse> {
  const response: APIGatewayResponse = {
    headers: {
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      'Access-Control-Allow-Origin': '*'
    },
    statusCode: 200,
    body: JSON.stringify({})
  };

  try {
    logger.log(LoggingLevel.INFO, `Request: ${JSON.stringify(event, null, 2)}`);

    const { body, headers, httpMethod, path, pathParameters, queryStringParameters, resource } = event;

    if (!headers || !headers.Host || headers.Host !== API_ENDPOINT) {
      throw new LambdaError({
        message: 'Invalid Host header',
        name: 'ConnectionBuilderError',
        statusCode: 400
      });
    }

    const queryStrings = queryStringParameters || {};
    let result: APIResponseBodyType;

    switch (httpMethod) {
      case 'GET':
        result = await handleGetRequest({
          path,
          pathParameters,
          queryStrings,
          resource
        });

        break;
      case 'POST':
        result = await handlePostRequest({
          body,
          resource
        });

        break;
      default:
        throw new LambdaError({
          message: `Not supported http method: ${httpMethod}`,
          name: 'ConnectionBuilderError',
          statusCode: 405
        });
    }

    response.body = JSON.stringify(result);
  } catch (error) {
    logger.log(LoggingLevel.ERROR, 'Error occurred: ', error);

    /**
     * When an error happens, unless the error is controlled by `LambdaError`,
     * it sanitizes the error message to "Internal service error.".
     */
    response.statusCode = error instanceof LambdaError ? error.statusCode : 500;
    response.body = JSON.stringify({
      errorMessage: error instanceof LambdaError ? error.message : 'Internal service error.'
    });
  }

  return response;
}
