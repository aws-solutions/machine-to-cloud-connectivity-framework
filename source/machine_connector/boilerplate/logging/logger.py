# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import sys


def get_logger(class_name: str):
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    try:
        print(f"setting log level to: {LOG_LEVEL}")
        logging.basicConfig(stream=sys.stdout, level=LOG_LEVEL)
    except Exception as err:
        print("Setting log level failed...using default log level")
        print(err)
        logging.basicConfig(stream=sys.stdout, level="INFO")
    logger = logging.getLogger(class_name)
    logger.info(f"Using Log Level: {LOG_LEVEL}")
    return logger
