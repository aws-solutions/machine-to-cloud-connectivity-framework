// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, RemovalPolicy } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  ContentHandling,
  Deployment,
  EndpointType,
  Integration,
  IntegrationProps,
  IntegrationType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MethodOptions,
  PassthroughBehavior,
  RequestValidator,
  RestApi,
  Stage
} from 'aws-cdk-lib/aws-apigateway';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { addCfnSuppressRules } from '../../utils/utils';

export interface ApiConstructProps {
  readonly connectionBuilderLambdaFunction: LambdaFunction;
}

/**
 * Creates a REST API and API related resources.
 */
export class ApiConstruct extends Construct {
  public apiEndpoint: string;
  public apiId: string;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { connectionBuilderLambdaFunction } = props;
    const connectionBuilderLambdaFunctionArn = connectionBuilderLambdaFunction.functionArn;

    const apiLogGroup = new LogGroup(this, 'Logs', {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.THREE_MONTHS
    });
    addCfnSuppressRules(apiLogGroup, [
      {
        id: 'W84',
        reason: 'CloudWatch Logs are already encrypted by default.'
      }
    ]);

    const api = new RestApi(this, 'RestApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowHeaders: ['Authorization', 'Content-Type', 'X-Amz-Date', 'X-Amz-Security-Token', 'X-Api-Key'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
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
    api.node.tryRemoveChild('Endpoint');

    const requestValidator = new RequestValidator(this, 'ApiRequestValidator', {
      restApi: api,
      validateRequestParameters: true,
      validateRequestBody: true
    });

    addCfnSuppressRules(api.node.findChild('Deployment') as Deployment, [
      {
        id: 'W68',
        reason: 'The solution does not require the usage plan.'
      }
    ]);
    addCfnSuppressRules(api.node.findChild('DeploymentStage.prod') as Stage, [
      {
        id: 'W64',
        reason: 'The solution does not require the usage plan.'
      }
    ]);

    const basicIntegration: IntegrationProps = {
      type: IntegrationType.AWS_PROXY,
      integrationHttpMethod: 'POST',
      options: {
        contentHandling: ContentHandling.CONVERT_TO_TEXT,
        integrationResponses: [{ statusCode: '200' }],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH
      },
      uri: `arn:${Aws.PARTITION}:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectionBuilderLambdaFunctionArn}/invocations`
    };
    const nextTokenIntegration: IntegrationProps = {
      ...basicIntegration,
      options: {
        ...basicIntegration.options,
        requestParameters: { 'integration.request.querystring.nextToken': 'method.request.querystring.nextToken' }
      }
    };
    const basicMethodOption: MethodOptions = {
      authorizationType: AuthorizationType.IAM,
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': { modelId: 'Empty' }
          }
        }
      ],
      requestValidator: requestValidator
    };
    const nextTokenMethodOption: MethodOptions = {
      ...basicMethodOption,
      requestParameters: { 'method.request.querystring.nextToken': false }
    };

    /**
     * Connections API
     * GET /connections
     * POST /connections
     * GET /connections/{connectionName}
     */
    const connectionsResource = api.root.addResource('connections');
    connectionsResource.addMethod('GET', new Integration(nextTokenIntegration), nextTokenMethodOption);
    connectionsResource.addMethod('POST', new Integration(basicIntegration), basicMethodOption);
    connectionsResource.addResource('{connectionName}').addMethod(
      'GET',
      new Integration({
        ...basicIntegration,
        options: {
          ...basicIntegration.options,
          requestParameters: { 'integration.request.path.connectionName': 'method.request.path.connectionName' }
        }
      }),
      {
        ...basicMethodOption,
        requestParameters: { 'method.request.path.connectionName': true }
      }
    );

    /**
     * Logs API
     * GET /logs
     * GET /logs/{connectionName}
     */
    const logsResource = api.root.addResource('logs');
    logsResource.addMethod('GET', new Integration(nextTokenIntegration), nextTokenMethodOption);
    logsResource.addResource('{connectionName}').addMethod(
      'GET',
      new Integration({
        ...basicIntegration,
        options: {
          ...basicIntegration.options,
          requestParameters: {
            'integration.request.path.connectionName': 'method.request.path.connectionName',
            'integration.request.querystring.nextToken': 'method.request.querystring.nextToken'
          }
        }
      }),
      {
        ...basicMethodOption,
        requestParameters: { 'method.request.path.connectionName': true, 'method.request.querystring.nextToken': false }
      }
    );

    /**
     * SiteWise API
     * GET /sitewise/{serverName}
     */
    const siteWiseResource = api.root.addResource('sitewise');
    siteWiseResource.addResource('{serverName}').addMethod(
      'GET',
      new Integration({
        ...basicIntegration,
        options: {
          ...basicIntegration.options,
          requestParameters: { 'integration.request.path.serverName': 'method.request.path.serverName' }
        }
      }),
      {
        ...basicMethodOption,
        requestParameters: { 'method.request.path.serverName': true }
      }
    );

    /**
     * Greengrass API
     * GET /greengrass
     * POST /greengrass
     * GET /greengrass/user
     */
    const greengrassResource = api.root.addResource('greengrass');
    greengrassResource.addMethod('GET', new Integration(nextTokenIntegration), nextTokenMethodOption);
    greengrassResource.addMethod('POST', new Integration(basicIntegration), basicMethodOption);
    greengrassResource.addResource('user').addMethod('GET', new Integration(basicIntegration), basicMethodOption);

    connectionBuilderLambdaFunction.addPermission('ApiLambdaInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: api.arnForExecuteApi()
    });

    // cdk-nag suppressions
    NagSuppressions.addResourceSuppressions(
      api,
      [
        { id: 'AwsSolutions-APIG3', reason: 'No need to enable WAF as it is up to users.' },
        { id: 'AwsSolutions-APIG4', reason: 'Authorized by IAM' },
        { id: 'AwsSolutions-COG4', reason: 'Authorized by IAM' },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AmazonAPIGatewayPushToCloudWatchLogs managed policy is used by CDK itself.'
        }
      ],
      true
    );
  }
}
