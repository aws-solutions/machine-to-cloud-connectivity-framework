# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

class FileException(Exception):
    """Machine to Cloud Connectivity utils file exception"""
    pass


class OPCDaConnectorException(Exception):
    """Machine to Cloud Connectivity Framework OPC DA connector exception"""
    pass


class ConverterException(Exception):
    """Machine to Cloud Connectivity Framework converter exception"""
    pass


class StreamManagerHelperException(Exception):
    """Machine to Cloud Connectivity Framework stream manager helper exception"""
    pass


class ValidationException(Exception):
    """Machine to Cloud Connectivity Framework validation exception"""
    pass


class PublisherException(Exception):
    """Machine to Cloud Connectivity Framework publisher exception"""
    pass
