## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get(user_request):
    if utils.get_metadata("protocol",user_request,0) == "slmp":
        return {
            "port-number": [int],
            "machine-ip": [str],
            "network": [int],
            "station": [int],
            "module": [str],
            "multidrop": [int],
            "timer": [int],
            "subheader": [str],
            "communication-code": [str],
            "ethernet": [str]
        }
    elif utils.get_metadata("protocol",user_request,0) == "opcda":
        return {
            "opcda-server-name": [str],
            "machine-ip": [str]
        }
    # add "connectivity-parameters" for new protocol
    return 0
   