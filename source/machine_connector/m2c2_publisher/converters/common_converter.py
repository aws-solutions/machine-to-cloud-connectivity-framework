# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging

from utils.custom_exception import ConverterException


class CommonConverter:
    def __init__(self, hierarchy):
        self.site_name = hierarchy["site_name"]
        self.area = hierarchy["area"]
        self.process = hierarchy["process"]
        self.machine_name = hierarchy["machine_name"]

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)

    def add_metadata(self, payload: dict, tag: str) -> dict:
        """
        This adds metadata to identify the source and tag of the payload
        """
        try:
            self.key_list = [
                "site_name",
                "area",
                "process",
                "machine_name",
                "tag"
            ]
            self.value_list = [
                self.site_name,
                self.area,
                self.process,
                self.machine_name,
                tag
            ]
            self.metadata_dict = dict(zip(self.key_list, self.value_list))
            payload.update(self.metadata_dict)
            return (payload)
        except Exception as err:
            self.logger.error(
                "An error has occurred in the common converter: {}".format(err))
            raise ConverterException(err)
