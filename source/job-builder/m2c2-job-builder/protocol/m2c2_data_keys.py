## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get(user_request, index):
    if utils.get_metadata("protocol",user_request,0) == "slmp":
        if utils.get_metadata("function",user_request,index) == "device_read": 
            return {
                "tag-name": [str],
                "subcommand": [str],
                "device-code": [str],
                "head-device": [str],
                "number-of-points": [str]
            }
        elif utils.get_metadata("function",user_request,index) == "device_read_random":
            return {
                "subcommand": [str],
                "words": [list],
                "dwords": [list]
            }
        elif utils.get_metadata("function",user_request,index) == "array_label_read":
            return {
                "subcommand": [str],
                "abbreviation": [list],
                "label-list": [list],
            }
        elif utils.get_metadata("function",user_request,index) == "label_read_random":
            return {
                "subcommand": [str],
                "abbreviation": [list],
                "label-list": [list]
            }
    elif utils.get_metadata("protocol",user_request,0) == "opcda":
        if utils.get_metadata("function",user_request,index) == "read_list":
            return {
              "address-list": [list]
            }
        elif utils.get_metadata("function",user_request,index) == "read_tags":
            return {
              "address-list": [list]
            }
    # add "data-parameters" keys required for new protocol
    return 0
