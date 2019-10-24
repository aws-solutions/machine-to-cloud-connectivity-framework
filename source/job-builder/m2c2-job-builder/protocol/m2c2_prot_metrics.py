## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get(user_request,aws_metrics):
    if utils.get_metadata("protocol",user_request,0) == "opcda":
        aws_metrics["Data"]["protocol"]= utils.get_metadata("protocol",user_request,0)
        aws_metrics["Data"]["machine-query-time-interval"] = utils.get_metadata("machine-query-time-interval",user_request,0)
        aws_metrics["Data"]["machine-query-iterations"] = utils.get_metadata("machine-query-iterations",user_request,0)
        tag_count = 0
        tag_list = 0
        for i in range (0,len(user_request["job"]["machine-details"]["data-parameters"]["attributes"])):
            if utils.get_metadata("function",user_request,i) == "read_tags":
                tag_count += len(utils.get_metadata("address-list",user_request,i))
            elif utils.get_metadata("function",user_request,i) == "read_list":
                tag_list += len(user_request)
        aws_metrics["Data"]["number-of-lists"] = tag_list
        aws_metrics["Data"]["number-of-tags"] = tag_count
        return aws_metrics 
    elif utils.get_metadata("protocol",user_request,0) == "slmp":
        aws_metrics["Data"]["protocol"]= utils.get_metadata("protocol",user_request,0)
        aws_metrics["Data"]["machine-query-time-interval"] = utils.get_metadata("machine-query-time-interval",user_request,0)
        aws_metrics["Data"]["machine-query-iterations"] = utils.get_metadata("machine-query-iterations",user_request,0)
        # Need to add add number of items read
        temp_metrics = {
            "device_read": 0,
            "device_read_random": 0,
            "array_label_read": 0,
            "label_read_random": 0
        }
        attributes = utils.get_metadata("attributes",user_request,0)
        for i in range(0, len(attributes)):
            if utils.get_metadata("function",user_request,i) == "device_read":
                temp_metrics["device_read"] += 1
            elif utils.get_metadata("function",user_request,i) == "device_read_random":
                try:
                    temp_metrics["device_read_random"] += len(attributes[i]["address-list"]["words"])
                except:
                    temp_metrics["device_read_random"] += 0
                try:
                    temp_metrics["device_read_random"] += len(attributes[i]["address-list"]["dwords"])
                except:
                    temp_metrics["device_read_random"] += 0
            elif utils.get_metadata("function",user_request,i) == "array_label_read":
                temp_metrics["array_label_read"] += len(attributes[i]["address-list"]["label-list"])
            elif utils.get_metadata("function",user_request,i) == "label_read_random":
                temp_metrics["label_read_random"] += len(attributes[i]["address-list"]["label-list"])
            aws_metrics["Data"]["details"] = temp_metrics
        return aws_metrics 
    # add metrics for new protocol
    return 0