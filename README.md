**[Machine to Cloud Connectivity Framework](https://aws.amazon.com/solutions/implementations/machine-to-cloud-connectivity-framework/)** | **[🚧 Feature request](https://github.com/awslabs/machine-to-cloud-connectivity-framework/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=)** | **[🐛 Bug Report](https://github.com/awslabs/machine-to-cloud-connectivity-framework/issues/new?assignees=&labels=bug&template=bug_report.md&title=)** | **[❓ General Question](https://github.com/awslabs/machine-to-cloud-connectivity-framework/issues/new?assignees=&labels=question&template=general_question.md&title=)**

**Note**: If you want to use the solution without building from source, navigate to Solution Landing Page

## Table of Content
- [Solution Overview](#solution-overview)
- [Architecture Diagram](#architecture-diagram)
- [AWS CDK and Solutions Constructs](#aws-cdk-and-solutions-constructs)
- [Customizing the Solution](#customizing-the-solution)
  - [Prerequisites for Customization](#prerequisites-for-customization)
  - [Unit Test](#unit-test)
  - [Build](#build)
  - [Deploy](#deploy)
- [License](#license)

# Solution Overview
AWS offers the Machine to Cloud Connectivity Framework (M2C2) solution to help customers connect factory equipment such as PLCs, CNC Machines, OPC DA servers more easily and securely. This solution provides a framework to define communication with factory equipment from the AWS cloud. This solution is designed to work out-of-the-box to connect equipment that support Open Protocol Communication Data Access (OPC DA) and customers can use this solution as a reference implementation to build connectors for other protocols within their factory as per their needs.

M2C2 for OPC DA provides a framework where customers can define the OPC DA supported equipment they want to connect to, the tags from that equipment that you wish to read and the frequency at which customers would like to read. This data will then be available in an Amazon Simple Storage Service (Amazon S3) bucket by default and AWS IoT topic optionally for customers either push to their own data lake and visualize the data, run machine learning for use cases such as predictive maintenance of factory equipment, create notifications and alerts or integrate one of the many other services within the AWS IoT rule engine.

For more information and a detailed deployment guide visit the Machine to Cloud Connectivity Framework at https://aws.amazon.com/solutions/implementations/machine-to-cloud-connectivity-framework/

# Architecture Diagram
![Architecture Diagram](./deployment/architecture.png)

# AWS CDK and Solutions Constructs
[AWS Cloud Development Kit (AWS CDK)](https://aws.amazon.com/cdk/) and [AWS Solutions Constructs](https://aws.amazon.com/solutions/constructs/) make it easier to consistently create well-architected infrastructure applications. All AWS Solutions Constructs are reviewed by AWS and use best practices established by the AWS Well-Architected Framework. This solution uses the following AWS Solutions Constructs:
- [aws-kinesisstreams-kinesisfirehose-s3](https://docs.aws.amazon.com/solutions/latest/constructs/aws-kinesisstreams-kinesisfirehose-s3.html)
- [aws-lambda-dynamodb](https://docs.aws.amazon.com/solutions/latest/constructs/aws-lambda-dynamodb.html)

In addition to the AWS Solutions Constructs, the solution uses AWS CDK directly to create infrastructure resources.
# Customizing the Solution
## Prerequisites for Customization
- [AWS Commnad Line Interface](https://aws.amazon.com/cli/)
- Node.js 10.x or later
- Python 3.7 or later

### 1. Clone the repository
```bash
git clone https://github.com/awslabs/machine-to-cloud-connectivity-framework.git
cd machine-to-cloud-connectivity-framework
export MAIN_DIRECTORY=$PWD
```

### 2. Declare environment variables
```bash
export REGION=aws-region-code # the AWS region to launch the solution (e.g. us-east-1)
export DIST_OUTPUT_BUCKET=my-bucket-name # bucket where customized code will reside
export SOLUTION_NAME=my-solution-name # the solution name
export VERSION=my-version # version number for the customized code
```

## Unit Test
After making changes, run unit tests to make sure added customization passes the tests:
```bash
cd $MAIN_DIRECTORY/deployment
chmod +x run-unit-tests.sh
./run-unit-tests.sh
```

## Build
```bash
cd $MAIN_DIRECTORY/deployment
chmod +x build-s3-dist.sh
./build-s3-dist.sh $DIST_OUTPUT_BUCKET $SOLUTION_NAME $VERSION
```

## Deploy
### 1. Create an Amazon Simple Storage Service (Amazon S3) bucket
To deploy the customized solution, create a regional Amazon S3 bucket so that AWS Lambda functions can get the resource from the regional bucket.
```bash
aws s3 md s3://$DIST_OUTPUT_BUCKET-$REGION --region $REGION
```

### 2. Upload the assets to the bucket
```bash
cd $MAIN_DIRECTORY/deployment
aws s3 sync ./regional-s3-assets/ s3://$DIST_OUTPUT_BUCKET-$REGION/$SOLUTION_NAME/$VERSION/ --acl bucket-owner-full-control
aws s3 sync ./global-s3-assets/ s3://$DIST_OUTPUT_BUCKET-$REGION/$SOLUTION_NAME/$VERSION/ --acl bucket-owner-full-control
```
### 3. Deploy the solution
- Get the link of the `machine-to-cloud-connectivity.template` uploaded to your Amazon S3 bucket.
- Deploy the Machine to Cloud Connectivity Framework solution to your account by launching a new AWS CloudFormation stack using the S3 link of the `machine-to-cloud-connectivity.template`.

# License
Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0