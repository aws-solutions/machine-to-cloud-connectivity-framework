// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Construct, RemovalPolicy } from '@aws-cdk/core';
import { ServicePrincipal } from '@aws-cdk/aws-iam';
import { Function as LambdaFunction } from '@aws-cdk/aws-lambda';
import {
  AccessLogFormat,
  AuthorizationType,
  ContentHandling,
  Deployment,
  EndpointType,
  Integration,
  IntegrationType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MethodOptions,
  PassthroughBehavior,
  RequestValidator,
  RestApi,
  Stage
} from '@aws-cdk/aws-apigateway';
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs';
import { addCfnSuppressRules } from '../utils/utils';

/**
 * ApiConstructProps props
 * @interface ApiConstructProps
 */
export interface ApiConstructProps {
  // Connection builder Lambda function
  readonly connectionBuilderLambdaFunction: LambdaFunction;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework API Construct.
 * It creates an API Gateway REST API and other resources.
 */
export class ApiConstruct extends Construct {
  // API endpoint
  public apiEndpoint: string;
  // API ID
  public apiId: string;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { connectionBuilderLambdaFunction } = props;
    const connectionBuilderLambdaFunctionArn = connectionBuilderLambdaFunction.functionArn;

    const apiLogGroup = new LogGroup(this, 'Logs', {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.THREE_MONTHS
    });
    addCfnSuppressRules(apiLogGroup, [{
      id: 'W84', reason: 'CloudWatch Logs are already encrypted by default.'
    }]);

    const api = new RestApi(this, 'M2C2Api', {
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowHeaders: [
          'Authorization',
          'Content-Type',
          'X-Amz-Date',
          'X-Amz-Security-Token',
          'X-Api-Key'
        ],
        allowMethods: [
          'GET',
          'POST',
          'OPTIONS'
        ],
        statusCode: 200
      },
      deploy: true,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
        stageName: 'prod',
        tracingEnabled: true
      },
      description: 'Machine to Cloud Connectivity Rest API',
      endpointTypes: [EndpointType.REGIONAL]
    });
    this.apiEndpoint = `https://${api.restApiId}.execute-api.${Aws.REGION}.amazonaws.com/prod`;
    this.apiId = api.restApiId;

    const requestValidator = new RequestValidator(this, 'ApiRequestValidator', {
      restApi: api,
      validateRequestParameters: true,
      validateRequestBody: true
    });

    addCfnSuppressRules(api.node.findChild('Deployment') as Deployment, [{
      id: 'W68', reason: 'The solution does not require the usage plan.'
    }]);
    addCfnSuppressRules(api.node.findChild('DeploymentStage.prod') as Stage, [{
      id: 'W64', reason: 'The solution does not require the usage plan.'
    }]);

    const getAllIntegration = new Integration({
      type: IntegrationType.AWS_PROXY,
      integrationHttpMethod: 'POST',
      options: {
        contentHandling: ContentHandling.CONVERT_TO_TEXT,
        integrationResponses: [{ statusCode: '200' }],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: { 'integration.request.querystring.nextToken': 'method.request.querystring.nextToken' }
      },
      uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
    });
    const getAllMethodOptions: MethodOptions = {
      authorizationType: AuthorizationType.IAM,
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': { modelId: 'Empty' }
        }
      }],
      requestParameters: { 'method.request.querystring.nextToken': false },
      requestValidator: requestValidator
    };

    /**
     * Connections API
     * GET /connections
     * POST /connections
     * GET /connections/{connectionName}
     */
    const connectionsResource = api.root.addResource('connections');
    connectionsResource.addMethod(
      'POST',
      new Integration({
        type: IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        options: {
          contentHandling: ContentHandling.CONVERT_TO_TEXT,
          integrationResponses: [{ statusCode: '200' }],
          passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH
        },
        uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
      }),
      {
        authorizationType: AuthorizationType.IAM,
        methodResponses: [{
          statusCode: '200',
          responseModels: {
            'application/json': { modelId: 'Empty' }
          }
        }],
        requestValidator: requestValidator
      }
    );
    connectionsResource.addMethod('GET', getAllIntegration, getAllMethodOptions);

    const connectionResource = connectionsResource.addResource('{connectionName}');
    connectionResource.addMethod(
      'GET',
      new Integration({
        type: IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        options: {
          contentHandling: ContentHandling.CONVERT_TO_TEXT,
          integrationResponses: [{ statusCode: '200' }],
          passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
          requestParameters: { 'integration.request.path.connectionName': 'method.request.path.connectionName' }
        },
        uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
      }),
      {
        authorizationType: AuthorizationType.IAM,
        methodResponses: [{
          statusCode: '200',
          responseModels: {
            'application/json': { modelId: 'Empty' }
          }
        }],
        requestParameters: { 'method.request.path.connectionName': true },
        requestValidator: requestValidator
      }
    );

    /**
     * Logs API
     * GET /logs
     * GET /logs/{connectionName}
     */
    const logsResource = api.root.addResource('logs');
    logsResource.addMethod('GET', getAllIntegration, getAllMethodOptions);
    logsResource.addResource('{connectionName}').addMethod(
      'GET',
      new Integration({
        type: IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        options: {
          contentHandling: ContentHandling.CONVERT_TO_TEXT,
          integrationResponses: [{ statusCode: '200' }],
          passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
          requestParameters: {
            'integration.request.path.connectionName': 'method.request.path.connectionName',
            'integration.request.querystring.nextToken': 'method.request.querystring.nextToken'
          }
        },
        uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
      }),
      {
        authorizationType: AuthorizationType.IAM,
        methodResponses: [{
          statusCode: '200',
          responseModels: {
            'application/json': { modelId: 'Empty' }
          }
        }],
        requestParameters: {
          'method.request.path.connectionName': true,
          'method.request.querystring.nextToken': false
        },
        requestValidator: requestValidator
      }
    );

    /**
     * Sitewise API
     * GET /sitewise/{serverName}
     */
     const sitewiseResource = api.root.addResource('sitewise');
     sitewiseResource.addResource('{serverName}').addMethod(
       'GET',
       new Integration({
         type: IntegrationType.AWS_PROXY,
         integrationHttpMethod: 'POST',
         options: {
           contentHandling: ContentHandling.CONVERT_TO_TEXT,
           integrationResponses: [{ statusCode: '200' }],
           passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
           requestParameters: {
             'integration.request.path.serverName': 'method.request.path.serverName'
           }
         },
         uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
       }),
       {
         authorizationType: AuthorizationType.IAM,
         methodResponses: [{
           statusCode: '200',
           responseModels: {
             'application/json': { modelId: 'Empty' }
           }
         }],
         requestParameters: {
           'method.request.path.serverName': true
         },
         requestValidator: requestValidator
       }
     );

    connectionBuilderLambdaFunction.addPermission('ApiLambdaInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: api.arnForExecuteApi()
    });
  }
}