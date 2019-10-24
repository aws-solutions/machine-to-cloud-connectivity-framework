## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import datetime
from datetime import datetime
import logging
import json
import os

import m2c2_utils as utils
import m2c2_globals as var
import m2c2_post_handler as post

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def write(data):
    data["job"]["_last-update-timestamp_"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    job_name = utils.get_metadata("name",data,0)
    try:
        with open(var.config_path + job_name + ".json", "w+", encoding = "utf-8") as file:
            json.dump(data, file)
        return 1
    except Exception as err:
        logger.info("Unable to write local file: " + str(err))
        post.to_user("error", data, var.m2c2_local_write %(var.config_path))
        return 0


def read(data):
    job_name = utils.get_metadata("name",data,0)
    if os.path.exists(var.config_path + job_name + ".json"):
        with open(var.config_path + job_name + ".json") as file:
            data = json.load(file)
        return data
    else:
        post.to_user("error", data, var.m2c2_local_read %(job_name))
        return ""
