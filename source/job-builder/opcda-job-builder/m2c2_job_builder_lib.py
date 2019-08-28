## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0


import string
import random
import boto3
import json
import datetime
import logging
import urllib.request 
import ssl
import os

import m2c2_job_builder_messages as msg

logger = logging.getLogger()
logger.setLevel(logging.INFO)

anonymousDataEndpoint = 'https://metrics.awssolutionsbuilder.com/generic'
iot_client = boto3.client('iot-data')

def remove_duplicate(array):
  return list(dict.fromkeys(array))

def unique_id(length=4):
    valid_char = string.ascii_uppercase + string.digits
    unique_id = ""
    for i in range(1, length + 1):
        unique_id += random.choice(valid_char)
    return unique_id

def post_to_user(name, version, type, message):
    user_message = {}
    if name == "":
        topic = "m2c2/job/" + type
    else:
        topic = "m2c2/job/" + name + "/" + type
    user_message["job-name"] = name
    if version != "": user_message["version"] = version
    user_message["message"] = message
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(user_message))

def create_job(user_job_request):
    if user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"] == "opcda":
        return user_job_request



###############
# JSON CHECKS #
###############

def json_check(user_job_request):
    if "control" not in user_job_request["job"]:
        post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_CONTROL)
        logger.info(msg.ERR_MSG_JSON_KEY_CONTROL)
        return ""
    if "properties" not in user_job_request["job"]:
        post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_PROPERTIES)
        logger.info(msg.ERR_MSG_JSON_KEY_PROPERTIES)
        return ""

    if user_job_request["job"]["control"].lower() in ["pull","start","stop","push"]:
        return generic_check(user_job_request)
    elif user_job_request["job"]["control"].lower() in ["deploy","update"]:
        try:
            if user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"].lower() == "opcda" :
                return opcda_check(user_job_request)
        except:
            post_to_user("", "","error", msg.ERR_MSG_JSON_KEY_MACHINE)
            logger.info(msg.ERR_MSG_JSON_KEY_MACHINE)
            return ""
    else:
        post_to_user("", "","error", msg.ERR_MSG_UNKNOWN_CONTROL %(user_job_request["job"]["control"].lower()))
        logger.info(msg.msg.ERR_MSG_UNKNOWN_CONTROL %(user_job_request["job"]["control"].lower()))
        return ""

def opcda_check(user_job_request):
    checked_json = {}
    checked_json["job"] = {}
    checked_json["job"]["control"] = user_job_request["job"]["control"]

    # greengrass group id specified by the user, a variable is created to store the value. This will be used through the resource creation. 
    if "gg-group-id" in user_job_request["job"] and user_job_request["job"]["control"].lower() in ["deploy"]:
        checked_json["job"]["gg_group_id"] = user_job_request["job"]["gg-group-id"]
        
    # user issue deploy/update command: it is compulsory to pass a single {name, version} tupple and all machine-details keys

    checked_json["job"]["properties"] = []
    checked_json["job"]["machine-details"] = {}
    if (len(user_job_request["job"]["properties"]) == 1) and ("name" in user_job_request["job"]["properties"][0]) and ("version" in user_job_request["job"]["properties"][0]):
        temp = {}
        temp["name"] = user_job_request["job"]["properties"][0]["name"]
        temp["version"] = str(user_job_request["job"]["properties"][0]["version"])
        checked_json["job"]["properties"].append(temp)
    else:
        post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_DEPLOY_UPDATE_PROPERTIES)
        logger.info(msg.ERR_MSG_JSON_KEY_DEPLOY_UPDATE_PROPERTIES)
        return ""

    if "machine-details" in user_job_request["job"]:
        connectivity_parameters = user_job_request["job"]["machine-details"]["connectivity-parameters"]
        data_parameters = user_job_request["job"]["machine-details"]["data-parameters"]
        required_connectivity_parameters = ["machine-name", "machine-ip", "protocol", "opcda-server-name"]
        required_data_parameters = ["machine-query-time-interval", "machine-query-iterations", "attributes"]
        checked_json["job"]["machine-details"]["connectivity-parameters"] = {}
        for i in range(0, len(required_connectivity_parameters)):
            if required_connectivity_parameters[i] not in connectivity_parameters:
                post_to_user("","","error", msg.ERR_MSG_JSON_KEY_CONNECTIVITY)
                logger.info(msg.ERR_MSG_JSON_KEY_CONNECTIVITY)
                return ""
            else:
                checked_json["job"]["machine-details"]["connectivity-parameters"][required_connectivity_parameters[i]] = user_job_request["job"]["machine-details"]["connectivity-parameters"][required_connectivity_parameters[i]]
        checked_json["job"]["machine-details"]["data-parameters"] = {}
        for i in range(0, len(required_data_parameters)):
            if required_data_parameters[i] not in data_parameters:
                post_to_user("","","error", msg.ERR_MSG_JSON_KEY_DATA)
                logger.info(msg.ERR_MSG_JSON_KEY_DATA)
                return ""
            else:
                checked_json["job"]["machine-details"]["data-parameters"][required_data_parameters[i]] = user_job_request["job"]["machine-details"]["data-parameters"][required_data_parameters[i]]

        # Clamping machine query value
        checked_json["job"]["machine-details"]["data-parameters"]["machine-query-iterations"] = sorted([1,checked_json["job"]["machine-details"]["data-parameters"]["machine-query-iterations"],30])[1]
        checked_json["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"] = sorted([0.5,checked_json["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"],30])[1]

        # optional keys can be specified.
        if "site-name" in user_job_request["job"]["machine-details"]:
            checked_json["job"]["machine-details"]["site-name"] = user_job_request["job"]["machine-details"]["site-name"]
        else:
            checked_json["job"]["machine-details"]["site-name"] = ""
        if "area" in user_job_request["job"]["machine-details"]:
            checked_json["job"]["machine-details"]["area"] = user_job_request["job"]["machine-details"]["area"]
        else:
            checked_json["job"]["machine-details"]["area"] = ""
        if "process" in user_job_request["job"]["machine-details"]:
            checked_json["job"]["machine-details"]["process"] = user_job_request["job"]["machine-details"]["process"]
        else:
            checked_json["job"]["machine-details"]["process"] = ""
    else:
        post_to_user(user_job_request["job"]["job-name"][0], str(user_job_request["job"]["version"][0]),"error", msg.ERR_MSG_JSON_KEY_MACHINE)
    return checked_json

def generic_check(user_job_request):
    checked_json = {}
    checked_json["job"] = {}
    checked_json["job"]["control"] = user_job_request["job"]["control"]
    # user issue pull command: job name is the only compulsory key
    if len(user_job_request["job"]["properties"]) > 1:
        job_name_list = []
        for i in range (0,len(user_job_request["job"]["properties"])):
            if "name" in user_job_request["job"]["properties"][i]:
                job_name_list.append(user_job_request["job"]["properties"][i]["name"])
        if len(job_name_list) - len(remove_duplicate(job_name_list)):
                post_to_user("", "", "error", msg.ERR_MSG_JSON_JOB_DUPLICATE)
                logger.info(msg.ERR_MSG_JSON_JOB_DUPLICATE)
                return ""

    if user_job_request["job"]["control"] in ["pull"]:
        checked_json["job"]["properties"] = []
        for i in range(0, len(user_job_request["job"]["properties"])):
            if ("name" in user_job_request["job"]["properties"][i]) and ("version" not in user_job_request["job"]["properties"][i]):
                temp = {}
                temp["name"] = user_job_request["job"]["properties"][i]["name"]
                checked_json["job"]["properties"].append(temp)
            else:
                if "version" in user_job_request["job"]["properties"][i]:
                    post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_PULL_VERSION)
                    logger.info(msg.ERR_MSG_JSON_KEY_PULL_VERSION)
                    return ""
                else:
                    post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_PULL)
                    logger.info(msg.ERR_MSG_JSON_KEY_PULL)
                    return ""
    # user issue push command: it is compulsory to pass a single {name, version} tupple
    elif user_job_request["job"]["control"].lower() in ["push"]:
        checked_json["job"]["properties"] = []
        if (len(user_job_request["job"]["properties"]) == 1) and ("name" in user_job_request["job"]["properties"][0]) and ("version" in user_job_request["job"]["properties"][0]):
            temp = {}
            temp["name"] = user_job_request["job"]["properties"][0]["name"]
            temp["version"] = str(user_job_request["job"]["properties"][0]["version"])
            checked_json["job"]["properties"].append(temp)
        else:
            post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_PUSH)
            logger.info(msg.ERR_MSG_JSON_KEY_PUSH)
            return ""
    
    # user issue start/stop command: it is compulsory to pass at least 1 {name, version}  tupple
    elif user_job_request["job"]["control"].lower() in ["start", "stop"]:
        checked_json["job"]["properties"] = []
        for i in range(0, len(user_job_request["job"]["properties"])):
            if ("name" in user_job_request["job"]["properties"][i]) and ("version" in user_job_request["job"]["properties"][i]):
                temp = {}
                temp["name"] = user_job_request["job"]["properties"][i]["name"]
                temp["version"] = str(user_job_request["job"]["properties"][i]["version"])
                checked_json["job"]["properties"].append(temp)
            else:
                post_to_user("", "", "error", msg.ERR_MSG_JSON_KEY_START_STOP)
                logger.info(msg.ERR_MSG_JSON_KEY_START_STOP)
                return ""
    return checked_json


###############
# ADD METRICS #
###############

def get_metrics(user_job_request):
    temp_metrics = {}
    temp_metrics = generic_metrics(user_job_request)
    if user_job_request["job"]["control"] in ["start", "push", "update"]:
        if user_job_request["job"]["machine-details"]["connectivity-parameters"]["protocol"] == "opcda":
            aws_metrics = opcda_metrics(user_job_request,temp_metrics)
    send_metrics(temp_metrics)

def generic_metrics(job):
    aws_metrics = {}
    aws_metrics['Solution'] = os.environ["SOL_ID"]
    aws_metrics['UUID'] = os.environ["UUID"]
    aws_metrics['TimeStamp'] = str(datetime.datetime.utcnow().isoformat())
    aws_metrics["Data"] ={
        "EventType": job["job"]["control"],
        "Version": os.environ["SOL_VER"],
        "JobName" : job["job"]["properties"][0]["name"]}
    return aws_metrics

def opcda_metrics(job,temp_metrics):
    temp_metrics["Data"]["protocol"]= job["job"]["machine-details"]["connectivity-parameters"]["protocol"]
    temp_metrics["Data"]["machine-query-time-interval"] = job["job"]["machine-details"]["data-parameters"]["machine-query-time-interval"]
    temp_metrics["Data"]["machine-query-iterations"] = job["job"]["machine-details"]["data-parameters"]["machine-query-iterations"]
    tag_count = 0
    tag_list = 0
    for i in range (0,len(job["job"]["machine-details"]["data-parameters"]["attributes"])):
        if job["job"]["machine-details"]["data-parameters"]["attributes"][i]["function"] == "read_tags":
            tag_count =+ len(job["job"]["machine-details"]["data-parameters"]["attributes"][i]["address-list"])
        if job["job"]["machine-details"]["data-parameters"]["attributes"][i]["function"] == "read_list":
            tag_list =+ len(job["job"]["machine-details"]["data-parameters"]["attributes"][i]["address-list"])
    temp_metrics["Data"]["number-of-lists"] = tag_list
    temp_metrics["Data"]["number-of-tags"] = tag_count
    return temp_metrics

def send_metrics(data):
    url = 'https://metrics.awssolutionsbuilder.com/generic'
    data = json.dumps(data).encode("utf-8") 
    headers = {'content-type': 'application/json'} 
    req = urllib.request.Request(url, data, headers) 
    response = urllib.request.urlopen(req) 
    print('RESPONSE CODE:: {}'.format(response.getcode())) 
    print('METRICS SENT:: {}'.format(data)) 

