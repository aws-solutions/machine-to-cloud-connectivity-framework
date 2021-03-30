## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_metadata(metadata, user_job_request,index):
    if metadata == "name":
        return user_job_request["job"]["properties"][index]["name"]
    elif metadata == "version":
        return user_job_request["job"]["properties"][index]["version"]
    elif metadata == "control":
        return user_job_request["job"]["control"].lower()
    elif metadata == "protocol":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"].lower()
    elif metadata == "communication-code":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["communication-code"]
    elif metadata == "port-number":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["port-number"]
    elif metadata == "machine-ip":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-ip"]
    elif metadata == "protocol":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"]
    elif metadata == "ethernet":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["ethernet"]
    elif metadata == "machine-name":
        return user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-name"]
    elif metadata == "machine-query-time-interval":
        return user_job_request["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"]
    elif metadata == "machine-query-iterations":
        return user_job_request["job"]["machine-details"]["data-parameters"]["machine-query-iterations"]
    elif metadata == "data-frames":
        return user_job_request["job"]["machine-details"]["data-parameters"]["data-frames"]
    elif metadata == "data-decode":
        return user_job_request["job"]["machine-details"]["data-parameters"]["data-decode"][index]
    else:
        return ""

