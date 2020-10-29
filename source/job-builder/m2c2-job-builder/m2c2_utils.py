## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging
import string
import random
import m2c2_protocol_converter as build

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_metadata(metadata, user_job_request, index):
    try:
        if metadata == "job":
            return user_job_request["job"]
        elif metadata == "control":
            return user_job_request["job"]["control"].lower()
        elif metadata == "properties":
            return user_job_request["job"]["properties"]
        elif metadata == "name":
            return user_job_request["job"]["properties"][index]["name"]
        elif metadata == "version":
            return user_job_request["job"]["properties"][index]["version"]
        elif metadata == "gg-group-id":
            return user_job_request["job"]["gg-group-id"]
        elif metadata == "machine-details":
            return user_job_request["job"]["machine-details"]
        elif metadata == "process":
            return user_job_request["job"]["machine-details"]["process"]
        elif metadata == "site-name":
            return user_job_request["job"]["machine-details"]["site-name"]    
        elif metadata == "area":
            return user_job_request["job"]["machine-details"]["area"]
        elif metadata == "connectivity-parameters":
            return user_job_request["job"]["machine-details"]["connectivity-parameters"]
        elif metadata == "machine-name":
            return user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-name"]
        elif metadata == "data-parameters":
            return user_job_request["job"]["machine-details"]["data-parameters"]
        elif metadata == "machine-query-iterations":
            return user_job_request["job"]["machine-details"]["data-parameters"]["machine-query-iterations"]
        elif metadata == "machine-query-time-interval":
            return user_job_request["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"]
        else:
            protocol = user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"].lower()
            return build.prot_keys(metadata, user_job_request, index, protocol)
    except:
        return ""

def unique_id(length=4):
    valid_char = string.ascii_uppercase + string.digits
    unique_id = ""
    for i in range(1, length + 1):
        unique_id += random.choice(valid_char)
    return unique_id