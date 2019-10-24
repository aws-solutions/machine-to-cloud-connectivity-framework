## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils
import m2c2_globals as var
import m2c2_post_handler as post

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get(user_request):
    if utils.get_metadata("protocol",user_request,0) == "slmp":

        if  utils.get_metadata("network",user_request,0) > var.max_slmp_network:
            post.to_user("","","error", var.m2c2_err_json_range %("network"))
            return 0
        
        if (utils.get_metadata("station",user_request,0) > var.max_slmp_station) and (utils.get_metadata("station",user_request,0) != 255) and (utils.get_metadata("station",user_request,0) != 0):
            post.to_user("","","error", var.m2c2_err_json_range %("station"))
            return 0

        if  utils.get_metadata("multidrop",user_request,0) > var.max_slmp_multidrop:
            post.to_user("","","error", var.m2c2_err_json_range %("multidrop"))
            return 0

        if  utils.get_metadata("subheader",user_request,0) not in var.slmp_subheader:
            post.to_user("","","error", var.m2c2_err_json_range %("subheader"))
            return 0
        
        if  utils.get_metadata("communication-code",user_request,0) not in var.slmp_communication_code:
            post.to_user("","","error", var.m2c2_err_json_range %("communication-code"))
            return 0

        if  utils.get_metadata("ethernet",user_request,0) not in var.slmp_ethernet:
            post.to_user("","","error", var.m2c2_err_json_range %("ethernet"))
            return 0
        return 1
    elif utils.get_metadata("protocol",user_request,0) == "opcda":
        return 1
    # add limits for new protocol
    return 0
