# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest
import pytest
from unittest import mock


from converters.tag_converter import TagConverter
class TestTagConverter(unittest.TestCase):
    def setUp(self):
        self.protocol_opcua = "opcua"
        self.protocol_opcda = "opcda"
        self.opcua_alias = "/RealTime/TestMetric"
        self.opcda_alias = "/Site/Area/Process/Machine/TestMetric"

    def test_tag_converter_opcua(self):
        self.opcua_client = TagConverter(self.protocol_opcua)
        self.payload = {"alias": self.opcua_alias}
        self.tag = self.opcua_client.retrieve_tag(self.payload)
        self.assertEqual(self.tag, "_RealTime_TestMetric")

    def test_tag_converter_opcda(self):
        self.opcda_client = TagConverter(self.protocol_opcda)
        self.payload = {"alias": self.opcda_alias}
        self.tag = self.opcda_client.retrieve_tag(self.payload)
        self.assertEqual(self.tag, "TestMetric")
