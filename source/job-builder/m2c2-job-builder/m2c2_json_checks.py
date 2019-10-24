## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import json
import m2c2_globals as var
import logging
import os

import m2c2_post_handler as post
import m2c2_globals as var
import m2c2_protocol_converter as build
import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def test_fields(test_dict, json, index):
    test_keys = list(test_dict.keys())
    for i in range (0, len(test_dict)):
        if utils.get_metadata(test_keys[i], json, index) != "":
            if type(utils.get_metadata(test_keys[i], json, index)) not in test_dict[test_keys[i]]:
                post.to_user("", "", "info", var.m2c2_err_json_key_type %(test_keys[i], str(test_dict[test_keys[i]])))
                return 0
        else:
            post.to_user("", "", "info", var.m2c2_err_json_key_not_found %(test_keys[i]))
            return 0
    return 1

def check_schema(submitted_json):
    abort_flag = False
    # check top json schema
    test_dict = {
        "job": [dict]
    }
    if not test_fields(test_dict, submitted_json, 0):
        return 0

    test_dict = {
        "control": [str],
        "properties": [list]
    }
    if not test_fields(test_dict, submitted_json, 0):
        return 0

    # json structure checked per control request type
    if utils.get_metadata("control", submitted_json, 0) in ["pull"]:
        for i in range(0, len(utils.get_metadata("properties", submitted_json, 0))):
            test_dict = {
                "name": [str]
                } 
            if not test_fields(test_dict, submitted_json, i):
                abort_flag = True

        if not abort_flag:
            return submitted_json
        
    elif utils.get_metadata("control", submitted_json, 0) in ["start","stop","push"]:
        for i in range(0, len(utils.get_metadata("properties", submitted_json, 0))):
            test_dict = {
                "name": [str],
                "version": [str]
                } 
            if not test_fields(test_dict, submitted_json, i):
                abort_flag = True       

        if not abort_flag:
            return submitted_json
        
    # elif utils.get_metadata("control", submitted_json, 0) in ["push"]:
    #     if len(utils.get_metadata("properties", submitted_json, 0)) != 1:
    #         post.to_user("", "", "error", var.m2c2_err_json_key_count %(str(len(utils.get_metadata("properties", submitted_json, 0))), submitted_json["job"]["control"]))
    #         return 0
        
    #     test_dict = {
    #         "name": [str],
    #         "version": [str]
    #         } 
    #     if not test_fields(test_dict, submitted_json, 0):
    #         abort_flag = True       
        
    #     if not abort_flag:
    #         return submitted_json      
    
    elif utils.get_metadata("control", submitted_json, 0) in ["deploy", "update"]:
        # full json structure is required to proceed. 
        # A user provided GreenGrass Group Id will be used
        if len(utils.get_metadata("properties", submitted_json, 0)) != 1:
            post.to_user("", "", "error", var.m2c2_err_json_key_count %(str(len(utils.get_metadata("properties", submitted_json, 0))), submitted_json["job"]["control"]))
            return 0

        test_dict = {
            "name": [str],
            "version": [str]
            } 
        if not test_fields(test_dict, submitted_json, 0):
            abort_flag = True  

        test_dict = {
            "machine-details": [dict]
        }
        if not test_fields(test_dict, submitted_json, 0):
            abort_flag = True
        
        test_dict = {
            "gg-group-id": [str]
        }
        if not test_fields(test_dict, submitted_json, 0):
            abort_flag = False

        if utils.get_metadata("gg-group-id", submitted_json, 0) == "":
            submitted_json["job"]["gg-group-id"] = os.environ["GGG_ID"]

        test_dict = {
            "connectivity-parameters": [dict],
            "data-parameters": [dict]
        }
        if not test_fields(test_dict, submitted_json, 0):
            abort_flag = True

        test_dict = {
            "protocol": [str],
        }
        if not test_fields(test_dict, submitted_json, 0):
            abort_flag = True

        # get protocol specific connectivity parameters
        test_dict = build.connectivity_keys(submitted_json)
        if test_dict:
            if not test_fields(test_dict, submitted_json, 0):
                abort_flag = True
        else:
            post.to_user("", "", "error", var.m2c2_err_json_connectivity)
            abort_flag = True
        # get generic collection parameters
        test_dict = {
            "machine-query-iterations": [int],
            "machine-query-time-interval": [int, float],
            "attributes": [list]
        }
        if not test_fields(test_dict, submitted_json, 0):
            return 0  

        # range check
        if not var.min_iteration <= utils.get_metadata("machine-query-iterations", submitted_json, 0) <= var.max_iteration:
            post.to_user("", "", "error", var.m2c2_err_json_range %("machine-query-iterations"))
            abort_flag = True
        
        if not var.min_interval <= utils.get_metadata("machine-query-time-interval", submitted_json, 0) <= var.max_interval:
            post.to_user("", "", "error", var.m2c2_err_json_range %("machine-query-time-interval"))
            abort_flag = True

        # get protocol specific data parameters
        for i in range (0, len(utils.get_metadata("attributes", submitted_json, 0))):
            test_dict = build.data_keys(submitted_json, i)
            if test_dict:
                if not test_fields(test_dict, submitted_json, i):
                    abort_flag = True
            else:
                post.to_user("", "", "error", var.m2c2_err_json_function)
                abort_flag = True

        if not build.check_range(submitted_json):
            abort_flag = True

        if not abort_flag:
            return submitted_json
    return 0
