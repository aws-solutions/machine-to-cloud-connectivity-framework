# Change Log
 All notable changes to this project will be documented in this file.

 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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


