// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  CfnUserPool,
  CfnUserPoolUser,
  UserPool,
  UserPoolClient
} from 'aws-cdk-lib/aws-cognito';
import { Effect, FederatedPrincipal, PolicyDocument, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnBucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface UiConstructProps {
  readonly apiId: string;
  readonly resourceBucket: IBucket;
  readonly userEmail: string;
  readonly cloudFrontDomainName: string;
}

/**
 * Creates a CloudFront distribution, an UI hosting S3 bucket, and Cognito resources.
 */
export class UiConstruct extends Construct {
  public identityPoolId: string;
  public userPoolId: string;
  public webClientId: string;

  constructor(scope: Construct, id: string, props: UiConstructProps) {
    super(scope, id);

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
            https://${props.cloudFrontDomainName}
          </p>
          <p>
            Please sign in to Machine to Cloud Connectivity Framework using the temporary credentials below:<br />
            Username: <strong>{username}</strong><br />Password: <strong>{####}</strong>
          </p>
        `
      }
    });
    (<CfnUserPool>userPool.node.defaultChild).userPoolAddOns = { advancedSecurityMode: 'ENFORCED' };
    this.userPoolId = userPool.userPoolId;

    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      generateSecret: false,
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(1),
      userPool,
      userPoolClientName: `${Aws.STACK_NAME}-userpool-client`
    });
    this.webClientId = userPoolClient.userPoolClientId;

    new CfnUserPoolUser(this, 'User', {
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
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
          serverSideTokenCheck: false
        }
      ]
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
        ExecuteApiPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [
                Stack.of(this).formatArn({
                  service: 'execute-api',
                  resource: props.apiId,
                  resourceName: 'prod/*'
                })
              ]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [props.resourceBucket.arnForObjects('public/*')]
            })
          ]
        })
      }
    });

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: { authenticated: authenticatedRole.roleArn }
    });

    (props.resourceBucket.node.defaultChild as CfnBucket).corsConfiguration = {
      corsRules: [
        {
          allowedMethods: ['GET'],
          allowedOrigins: [`https://${props.cloudFrontDomainName}`],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag']
        }
      ]
    };

    NagSuppressions.addResourceSuppressions(userPool, [
      { id: 'AwsSolutions-COG2', reason: 'No need to enable MFA as that is option for users.' }
    ]);
    NagSuppressions.addResourceSuppressions(authenticatedRole, [
      { id: 'AwsSolutions-IAM5', reason: 'It does not allow wildcard permissions.' }
    ]);
  }
}
