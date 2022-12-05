// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CustomResource, CfnCondition, CfnCustomResource, Aws } from 'aws-cdk-lib';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { SecurityPolicyProtocol } from 'aws-cdk-lib/aws-cloudfront';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface CloudFrontConstructProps {
  readonly s3LoggingBucket: IBucket;
  readonly customResourcesFunctionArn: string;
  readonly shouldTeardownData: CfnCondition;
}

/**
 * Creates a CloudFront distribution.
 */
export class CloudFrontConstruct extends Construct {
  public cloudFrontDomainName: string;
  public uiBucket: Bucket;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    const cloudFrontToS3 = new CloudFrontToS3(this, 'CloudFrontToS3', {
      bucketProps: {
        serverAccessLogsBucket: props.s3LoggingBucket,
        serverAccessLogsPrefix: 'ui-s3/',
        bucketName: `${Aws.STACK_NAME}-${Aws.ACCOUNT_ID}-ui`
      },
      cloudFrontDistributionProps: {
        comment: 'Machine to Cloud Connectivity Framework Distribution',
        enableLogging: true,
        errorResponses: [
          { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
          { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
        ],
        logBucket: props.s3LoggingBucket,
        minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2019,
        logFilePrefix: 'ui-cf/'
      },
      insertHttpSecurityHeaders: false
    });
    this.cloudFrontDomainName = cloudFrontToS3.cloudFrontWebDistribution.domainName;
    this.uiBucket = <Bucket>cloudFrontToS3.s3Bucket;

    const teardownCloudfrontBucket = new CustomResource(this, 'TeardownCloudfrontBucket', {
      serviceToken: props.customResourcesFunctionArn,
      properties: {
        Resource: 'DeleteS3Bucket',
        BucketName: this.uiBucket.bucketName
      }
    });
    const cfnTeardownCloudfrontBucket = <CfnCustomResource>teardownCloudfrontBucket.node.defaultChild;
    cfnTeardownCloudfrontBucket.cfnOptions.condition = props.shouldTeardownData;

    NagSuppressions.addResourceSuppressions(
      cloudFrontToS3,
      [
        { id: 'AwsSolutions-CFR1', reason: 'The solution does not control geo restriction.' },
        { id: 'AwsSolutions-CFR2', reason: 'No need to enable WAF.' },
        {
          id: 'AwsSolutions-CFR4',
          reason: 'No contorl on the solution side as it is using the CloudFront default certificate.'
        }
      ],
      true
    );
  }
}
