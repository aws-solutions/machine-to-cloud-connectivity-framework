# Change Log
 All notable changes to this project will be documented in this file.
 
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- UI to support creation of the job
- Support for more industrial protocols
- More details on how you can build your own connectors

## [1.0.0] - 2019-08-20
### Added
- Machine to cloud connectivity framework with support for OPC DA protocol
- Deploys IoT Core and Rules related to triggering the OPC DA Job Builder
- Deploys the OPC DA Job Builder lambda function
- Deploys DynamoDB to store metadata related to the machine jobs
- Deploys Greengrass group that can be deployed to your gateway

## [2.0.0] - 2019-10-10
### Added
- Machine to cloud connectivity framework with support for Mitsubishi SLMP device and array read functions
- Significant job builder code refactoring in view of enabling users to add their own protocol
