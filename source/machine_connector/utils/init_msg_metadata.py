# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os


class InitMessage:

    def __init__(self):
        # Site name from Greengrass Lambda Environment variables
        self.SITE_NAME = os.environ["SITE_NAME"]
        # Area from Greengrass Lambda Environment variables
        self.AREA = os.environ["AREA"]
        # Process from Greengrass Lambda Environment variables
        self.PROCESS = os.environ["PROCESS"]
        # Machine name from Greengrass Lambda Environment variables
        self.MACHINE_NAME = os.environ["MACHINE_NAME"]

    def init_user_message(self) -> dict:
        self.user_message = {}
        self.user_message["siteName"] = self.SITE_NAME
        self.user_message["area"] = self.AREA
        self.user_message["process"] = self.PROCESS
        self.user_message["machineName"] = self.MACHINE_NAME
        return(self.user_message)
