## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils
import protocol.m2c2_slmp as slmp

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get(user_request):
    if utils.get_metadata("protocol",user_request,0) == "slmp":
        return slmp.create_job(user_request)
    elif utils.get_metadata("protocol",user_request,0) == "opcda":
        return user_request
    # add link to job builder for new protocol
    return 0