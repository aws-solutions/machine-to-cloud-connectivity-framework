## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get(metadata, user_job_request, index, protocol):
    try:
        if protocol == "opcda":
            if metadata == "site-name":
                return str(user_job_request["job"]["machine-details"]["site-name"])
            elif metadata == "area":
                return str(user_job_request["job"]["machine-details"]["area"])
            elif metadata == "process":
                return str(user_job_request["job"]["machine-details"]["process"])
            elif metadata == "protocol":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"].lower()
            elif metadata == "machine-ip":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-ip"]
            elif metadata == "opcda-server-name":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["opcda-server-name"]
            elif metadata == "machine-name":
                return str(user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-name"])
            elif metadata == "attributes":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"]
            elif metadata == "function":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["function"]
            elif metadata == "address-list":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]
        
        elif protocol == "slmp":
            if metadata == "site-name":
                return str(user_job_request["job"]["machine-details"]["site-name"])
            elif metadata == "area":
                return str(user_job_request["job"]["machine-details"]["area"])
            elif metadata == "process":
                return str(user_job_request["job"]["machine-details"]["process"])
            elif metadata == "machine-name":
                return str(user_job_request["job"]["machine-details"]["machine-name"])
            elif metadata == "protocol":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"].lower()
            elif metadata == "communication-code":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["communication-code"].lower()
            elif metadata == "port-number":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["port-number"]
            elif metadata == "machine-ip":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["machine-ip"]
            elif metadata == "ethernet":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["ethernet"].lower()
            elif metadata == "network":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["network"]
            elif metadata == "station":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["station"]
            elif metadata == "module":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["module"]
            elif metadata == "multidrop":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["multidrop"]
            elif metadata == "timer":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["timer"]
            elif metadata == "subheader":
                return user_job_request["job"]["machine-details"]["connectivity-parameters"]["subheader"]
            elif metadata == "attributes":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"]
            elif metadata == "function":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["function"]
            elif metadata == "address-list":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]
            elif metadata == "subcommand":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["subcommand"]
            elif metadata == "tag-name":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["tag-name"]
            elif metadata == "device-code":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["device-code"]
            elif metadata == "head-device":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["head-device"]
            elif metadata == "number-of-points":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["number-of-points"]
            elif metadata == "words":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["words"]
            elif metadata == "dwords":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["dwords"]
            elif metadata == "label-list":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["label-list"]
            elif metadata == "abbreviation":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["abbreviation"]
            elif metadata == "labels":
                return user_job_request["job"]["machine-details"]["data-parameters"]["attributes"][index]["address-list"]["labels"]
        # Add keys for new protocol
        else:
            return ""
    except:
        return ""
