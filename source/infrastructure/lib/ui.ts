// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Construct, Duration, RemovalPolicy } from '@aws-cdk/core';
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment, CfnUserPool, CfnUserPoolUser, UserPool, UserPoolClient } from '@aws-cdk/aws-cognito';
import { Effect, FederatedPrincipal, PolicyDocument, PolicyStatement, Role } from '@aws-cdk/aws-iam';
import { Bucket } from '@aws-cdk/aws-s3';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';

/**
 * UiConstructProps props
 * @interface UiConstructProps
 */
export interface UiConstructProps {
  // The API ID
  readonly apiId: string;
  // S3 logging bucket
  readonly s3LoggingBucket: Bucket;
  // User E-Mail address
  readonly userEmail: string;
}

/**
 * @class
 * Machine to Cloud Connectivity Framework UI Construct.
 * It creates a CloudFront distribution, an UI hosting S3 bucket,
 * Cognito resources, and custom resources for UI assets.
 */
export class UiConstruct extends Construct {
  // CloudFront distribution domain name
  public cloudFrontDomainName: string;
  // Cognito Identity pool ID
  public identityPoolId: string;
  // UI S3 bucket
  public uiBucket: Bucket;
  // Cognito user pool ID
  public userPoolId: string;
  // Cognito user pool web client ID
  public webClientId: string;

  constructor(scope: Construct, id: string, props: UiConstructProps) {
    super(scope, id);

    const cloudFrontToS3 = new CloudFrontToS3(this, 'CloudFrontToS3', {
      bucketProps: {
        serverAccessLogsBucket: props.s3LoggingBucket,
        serverAccessLogsPrefix: 'ui-s3/'
      },
      cloudFrontDistributionProps: {
        comment: 'Machine to Cloud Connectivity Framework Distribution',
        enableLogging: true,
        errorResponses: [
          { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
          { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
        ],
        logBucket: props.s3LoggingBucket,
        logFilePrefix: 'ui-cf/'
      },
      insertHttpSecurityHeaders: false
    });
    this.cloudFrontDomainName = cloudFrontToS3.cloudFrontWebDistribution.domainName;
    this.uiBucket = cloudFrontToS3.s3Bucket!;

    const userPool = new UserPool(this, 'UserPool', {
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true
      },
      removalPolicy: RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true
      },
      userPoolName: `${Aws.STACK_NAME}-user-pool`,
      userInvitation: {
        emailSubject: '[Machine to Cloud Connectivity Framework] Login information',
        emailBody: `
          <p>
            You are invited to join Machine to Cloud Connectivity Framework.<br />
            https://${this.cloudFrontDomainName}
          </p>
          <p>
            Please sign in to Machine to Cloud Connectivity Framework using the temporary credentials below:<br />
            Username: <strong>{username}</strong><br />Password: <strong>{####}</strong>
          </p>
        `
      }
    });
    (userPool.node.defaultChild as CfnUserPool).userPoolAddOns = { advancedSecurityMode: 'ENFORCED' };
    this.userPoolId = userPool.userPoolId;

    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      generateSecret: false,
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(1),
      userPool,
      userPoolClientName: `${Aws.STACK_NAME}-userpool-client`
    });
    this.webClientId = userPoolClient.userPoolClientId;

    new CfnUserPoolUser(this, 'User', { // NOSONAR: typescript:S1848
      userPoolId: userPool.userPoolId,
      desiredDeliveryMediums: ['EMAIL'],
      forceAliasCreation: true,
      userAttributes: [
        { name: 'email', value: props.userEmail },
        { name: 'email_verified', value: 'true' }
      ],
      username: props.userEmail
    });

    const identityPool = new CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName,
        serverSideTokenCheck: false
      }]
    });
    this.identityPoolId = identityPool.ref;

    const authenticatedRole = new Role(this, 'IdentityPoolAuthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: `${Aws.STACK_NAME} Identity Pool authenticated role`,
      inlinePolicies: {
        'ExecuteApiPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [`arn:${Aws.PARTITION}:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${props.apiId}/prod/*`]
            })
          ]
        })
      }
    });

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachement', { // NOSONAR: typescript:S1848
      identityPoolId: identityPool.ref,
      roles: { authenticated: authenticatedRole.roleArn }
    });
  }
}