# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [4.1.0] - 2022-09-01

### Added

- OSI PI Connector support

## [4.0.1] - 2022-07-27

### Changed

- A bug fix was made to the greengrass deployer lambda function and the baked-in greengrass core install script

## [4.0.1] - 2022-07-27

### Changed

- A bug fix was made to the greengrass deployer lambda function and the baked-in greengrass core install script
## [4.0.0] - 2022-05-12

⚠ BREAKING CHANGES

`v4.0.0` does not support to upgrade from the previous version.

- The solution supports AWS IoT Greengrass V2. AWS IoT Greengrass V1 is no longer supported.
- AWS IoT Greengrass Lambda functions are replaced by AWS IoT Greengrass private custom components.

### Added

- Amazon Timestream as a data destination
- Multiple Amazon IoT Greengrass v2 core devices support

## [3.0.0] - 2021-07-29

⚠ BREAKING CHANGES

`v3.0.0` does not support to upgrade from the previous version.

- `job` has been changed to `connection`.
- **Job DynamoDB table**: the table has been replaced to `Connection DynamoDB table` with the new primary key
- **Job definition**: the job definition has been replaced to the new connection definition
- **Job builder Lambda function**: the job builder Lambda function has been replaced to the connection builder Lambda function and the Greengrass deployer Lambda function

### Added

- API and UI to control connections for the better user experience
- OPC UA support
- AWS IoT SiteWise as a data destination
- AWS IoT SiteWise connector on Greengrass
- IoT topic messages consumer for informational and error logs
  - The IoT rule routes messages to Amazon Simple Queue Service queue.
  - An AWS Lambda function, `sqs-message-consumer`, consumes the messages in the queue.
  - Amazon DynamoDB logs table stores the processed logs.

### Changed

- All Lambda functions excluding machine connector Lambda functions are migrated to TypeScript.
- Replaces the Python package and file name with `-` to `_`
- A machine connector Lambda function has been split into a collector Lambda function and a publisher Lambda function.
- MQTT topics:
  - Informational logs: `m2c2/info/{connectionName}`
  - Error logs:`m2c2/error/{connectionName}`
  - Connection control: `m2c2/job/{connectionName}`
  - Data: `m2c2/data/{connectionName}`

### Removed

- Seamless Message Protocol (SLMP) is deprecated.

## [2.2.0] - 2021-03-30

### Added

- AWS Greengrass Stream Manager and Amazon Kinesis Data Stream for OPC DA connector data
- AWS CDK source code to generate AWS CloudFormation template
- `ConnectorClient` for the common actions

### Changed

- Amazon Kinesis Data Firehose gets OPC DA connector data from Amazon Kinesis Data Stream.
- OPC DA connector Lambda runtime to Python 3.7

### Removed

- Kinesis Firehose Connector
- AWS CloudFormation template

## [2.1.0] - 2020-10-28

### Added

- Creates an S3 bucket to store OPC DA telemetry data
- Creates Kinesis Data Firehose to take OPC DA data messages, batches the messages into gzip artifacts, and forwards the artifacts to the S3 data bucket
- Adds the Kinesis Data Firehose connector in Greengrass and creates the appropriate subscriptions to send the OPC DA data from the Greengrass edge device to the Kinesis Data Firehose in the user's account

### Changes

- OPC DA telemetry data published on IoT topic m2c2/job/<job-name>/<site-name>/<area>/<process>/<machine-name>/<tag-name>

## [2.0.0] - 2019-10-10

### Added

- Machine to cloud connectivity framework with support for Mitsubishi SLMP device and array read functions
- Significant job builder code refactoring in view of enabling users to add their own protocol

## [1.0.0] - 2019-08-20

### Added

- Machine to cloud connectivity framework with support for OPC DA protocol
- Deploys IoT Core and Rules related to triggering the OPC DA Job Builder
- Deploys the OPC DA Job Builder lambda function
- Deploys DynamoDB to store metadata related to the machine jobs
- Deploys Greengrass group that can be deployed to your gateway
