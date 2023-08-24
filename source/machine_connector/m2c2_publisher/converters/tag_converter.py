# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging


class TagConverter:
    def __init__(self, protocol):
        self.protocol = protocol

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def convert_opcua_tag(self, payload):
        """
        Converting the OPC-UA alias, representing the telemetry tag
        Replacing '/' with '_' and "." with "-" in tag
        """
        self.payload = payload
        tag = self.payload["alias"].replace(".", "-").replace("/", "_")
        return tag

    def convert_opcda_tag(self, payload):
        """
        Using the alias to pull out the tag for OPC-DA
        """
        tag = payload["alias"].split('/')[-1]
        return tag

    def convert_osipi_tag(self, payload):
        """
        Converting the OSI PI name, representing the telemetry tag
        Replacing '/' with '_' and "." with "-" in tag
        """
        self.payload = payload
        tag = self.payload["alias"].replace(".", "-").replace("/", "_")
        return tag

<<<<<<< HEAD
=======
    def convert_modbustcp_tag(self, payload):
        """
        Using the alias to pull out the tag for modbustcp, tag is 
        last part of alias designated as "(user custom tag)_(modbus command)_(secondary address)"
        """
        tag = payload["alias"].split('/')[-1]
        return tag

>>>>>>> main
    def retrieve_tag(self, payload):
        if self.protocol == "opcua":
            self.tag = self.convert_opcua_tag(payload)
        if self.protocol == "opcda":
            self.tag = self.convert_opcda_tag(payload)
        if self.protocol == "osipi":
            self.tag = self.convert_osipi_tag(payload)
<<<<<<< HEAD
=======
        if self.protocol == "modbustcp":
            self.tag = self.convert_modbustcp_tag(payload)
>>>>>>> main
        return self.tag
