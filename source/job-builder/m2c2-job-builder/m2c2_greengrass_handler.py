## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import boto3
import logging
import os
import boto3
import json

import m2c2_protocol_converter as builder
import m2c2_utils as utils
import m2c2_globals as var
import m2c2_post_handler as post


logger = logging.getLogger()
logger.setLevel(logging.INFO)

lambda_client = boto3.client('lambda')
gg_client = boto3.client('greengrass')

class generate_greengrass_resources:
    def __init__(self, user_request):
        self.job_name = utils.get_metadata("name",user_request,0)
        self.job_version = utils.get_metadata("version",user_request,0)
        self.protocol = utils.get_metadata("protocol",user_request,0)
        self.lambda_path =  os.environ["CON_KEY"]
        self.lambda_role =  os.environ["CON_ROL"]

        self.m2c2_local_resource_path = var.m2c2_local_resource_path

        self.gg_group_id = utils.get_metadata("gg-group-id",user_request,0)
        logger.info("GreenGrass Group Id: " + str(self.gg_group_id))
        self.gg_connector_lambda = ""
        self.gg_connector_lambda_alias = ""
        self.gg_create_definition = ["", "", "", "", "", ""]
        self.gg_list_definitions = ["", "", "", "", "", ""]
        self.gg_get_definition_version = [[],[],[],[],[],[]]
        self.gg_definition_version = ["", "", "", "", "", ""]
        self.gg_group = ""
        self.gg_group_version = ""

        self.mnemo_list = [
            "Resource", 
            "Core", 
            "Device", 
            "Function", 
            "Logger", 
            "Subscription"
            ]
        

    def call_list_definitions(self, arg_max, arg_token, idx):
        if idx == 0: return gg_client.list_resource_definitions(MaxResults= arg_max, NextToken= arg_token)
        if idx == 1: return gg_client.list_core_definitions(MaxResults = arg_max, NextToken = arg_token)
        if idx == 2: return gg_client.list_device_definitions(MaxResults = arg_max, NextToken = arg_token)
        if idx == 3: return gg_client.list_function_definitions(MaxResults = arg_max, NextToken = arg_token)
        if idx == 4: return gg_client.list_logger_definitions(MaxResults = arg_max, NextToken = arg_token)
        if idx == 5: return gg_client.list_subscription_definitions(MaxResults = arg_max, NextToken = arg_token)

    def call_get_definition_version(self, arg_id, arg_versionid, idx):
        if idx == 0: return gg_client.get_resource_definition_version(ResourceDefinitionId = arg_id, ResourceDefinitionVersionId = arg_versionid)
        if idx == 1: return gg_client.get_core_definition_version(CoreDefinitionId = arg_id, CoreDefinitionVersionId = arg_versionid)
        if idx == 2: return gg_client.get_device_definition_version(DeviceDefinitionId = arg_id, DeviceDefinitionVersionId = arg_versionid)
        if idx == 3: return gg_client.get_function_definition_version(FunctionDefinitionId = arg_id, FunctionDefinitionVersionId = arg_versionid)
        if idx == 4: return gg_client.get_logger_definition_version(LoggerDefinitionId = arg_id, LoggerDefinitionVersionId = arg_versionid)
        if idx == 5: return gg_client.get_subscription_definition_version(SubscriptionDefinitionId = arg_id, SubscriptionDefinitionVersionId = arg_versionid)

    def call_create_definition(self, arg_name, idx):
        if idx == 0: return gg_client.create_resource_definition(Name = arg_name)
        if idx == 1: return gg_client.create_core_definition(Name = arg_name)
        if idx == 2: return gg_client.create_device_definition(Name = arg_name)
        if idx == 3: return gg_client.create_function_definition(Name = arg_name)
        if idx == 4: return gg_client.create_logger_definition(Name = arg_name)
        if idx == 5: return gg_client.create_subscription_definition(Name = arg_name)

    def call_create_definition_version(self, arg_id, arg_content, idx):
        if idx == 0: return gg_client.create_resource_definition_version(ResourceDefinitionId = arg_id, Resources = arg_content)
        if idx == 1: return gg_client.create_core_definition_version(CoreDefinitionId = arg_id, Cores = arg_content)
        if idx == 2: return gg_client.create_device_definition_version(DeviceDefinitionId = arg_id, Devices = arg_content)
        if idx == 3: return gg_client.create_function_definition_version(FunctionDefinitionId = arg_id, Functions = arg_content)
        if idx == 4: return gg_client.create_logger_definition_version(LoggerDefinitionId = arg_id, Loggers = arg_content)
        if idx == 5: return gg_client.create_subscription_definition_version(SubscriptionDefinitionId = arg_id, Subscriptions = arg_content)

    def call_delete_definition(self, arg_id, idx):
        if idx == 0: return gg_client.delete_resource_definition(ResourceDefinitionId = arg_id)
        if idx == 1: return gg_client.delete_core_definition(CoreDefinitionId = arg_id)
        if idx == 2: return gg_client.delete_device_definition(DeviceDefinitionId = arg_id)
        if idx == 3: return gg_client.delete_function_definition(FunctionDefinitionId = arg_id)
        if idx == 4: return gg_client.delete_logger_definition(LoggerDefinitionId = arg_id)
        if idx == 5: return gg_client.delete_subscription_definition(SubscriptionDefinitionId = arg_id)

    def create_gg_definitions(self):
        if not self.get_group_definition(): 
            return 0
        if not self.add_m2c2_connector():
            return self.delete_gg_definitions()
        if not self.update_group_definitions(): 
            return self.delete_gg_definitions()
        if not self.create_group_version(): 
            return self.delete_gg_definitions()
        return 1

    def delete_gg_definitions(self):
        logger.debug("Failed to execute job. All resources are being delete.")

        for i in range(0, len(self.gg_create_definition)):
            if self.gg_create_definition[i]:
                arg_id = self.gg_create_definition[i]["Id"]
                self.call_delete_definition(arg_id, i)
        if self.gg_connector_lambda:
            lambda_client.delete_function(FunctionName=self.gg_connector_lambda['FunctionName'])
        return 0

    def get_group_definition(self):
        try:
            self.gg_group = gg_client.get_group(GroupId=self.gg_group_id)
        except Exception as err:
            logger.info("gg group definition traceback:"+ str(err))
            post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_get_group_definition %(self.gg_group_id))
            return 0
        else:
            try:
                self.gg_group_version = gg_client.get_group_version(
                    GroupId=self.gg_group["Id"],
                    GroupVersionId=self.gg_group["LatestVersion"]
                )
            except Exception as err:
                logger.info("gg group definition version traceback:"+ str(err))
                post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_get_group_definition_version %(self.gg_group["Id"],self.gg_group["LatestVersion"]))
                return 0
        return 1

    def add_m2c2_connector(self):
        uniqueID = utils.unique_id()
        # import connector lambda to user account
        try:
            self.gg_connector_lambda = lambda_client.create_function(
                FunctionName="m2c2-" + self.protocol + "-connector-" + self.job_name + "-" + uniqueID,
                Runtime=builder.runtime(self.protocol),
                Role=self.lambda_role,
                Handler="m2c2-" + self.protocol + "-connector.function_handler",
                Code={
                    "S3Bucket": os.environ["JBM_BCK"],
                    "S3Key": self.protocol + "-" + self.lambda_path + "/m2c2-" + self.protocol + "-connector.zip",
                },
                Description="m2c2-" + self.protocol + "-connector-lambda-" + self.job_name,
                Timeout=5,
                MemorySize=128,
                Publish=True
            )
        except Exception as err:
            logger.debug("connector lambda traceback:"+ str(err))
            post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_add_lambda %(self.protocol, os.environ["JBM_BCK"]))
            return 0
        else:
            try:
                self.gg_connector_lambda_alias = lambda_client.create_alias(
                    FunctionName=self.gg_connector_lambda["FunctionArn"],
                    Name="m2c2-" + self.protocol + "-connector-" + self.job_name + "-" + uniqueID,
                    FunctionVersion='1'
                )
            except Exception as err:
                logger.debug("connector lambda alias traceback:"+ str(err))
                post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_add_lambda_alias)
                return 0
        return 1

    def update_group_definitions(self):
        for i in range(0, len(self.mnemo_list)):
            content_to_add = []

            # fetch existing definitions
            arg_max = "30"
            arg_token = ""
            list = self.call_list_definitions(arg_max, arg_token, i)
            self.gg_list_definitions[i] = list["Definitions"]
            while "NextToken" in list:
                arg_token = list["NextToken"]
                list = self.call_list_definitions(arg_max, arg_token, i)
                for j in range(0, len(list["Definitions"])):
                    self.gg_list_definitions[i].append(list["Definitions"][j])

            # match existing definitions with group content
            for j in range(0, len(self.gg_list_definitions[i])):
                k = 0
                if ('LatestVersionArn' in self.gg_list_definitions[i][j]):
                    k = k + 1
                    if (self.mnemo_list[i] + "DefinitionVersionArn" in self.gg_group_version["Definition"]):
                        if self.gg_group_version["Definition"][self.mnemo_list[i] + "DefinitionVersionArn"] == self.gg_list_definitions[i][j]["LatestVersionArn"]:
                            arg_id = self.gg_list_definitions[i][j]["Id"]
                            arg_versionid = self.gg_list_definitions[i][j]["LatestVersion"]
                            self.gg_temp_definition_version = self.call_get_definition_version(arg_id, arg_versionid, i)
                            if k == 1:
                                self.gg_get_definition_version[i] = self.gg_temp_definition_version["Definition"][self.mnemo_list[i] + "s"]
                            elif k > 1:
                                self.gg_get_definition_version[i].append(self.gg_temp_definition_version["Definition"][self.mnemo_list[i] + "s"])
                        else:
                            # definition is not in the group. move to next
                            pass
            
            # Retrieve the items specific to the job and check if it already exists within the retrieved definitions
            content_to_add = self.get_m2c2_gg_content(self.mnemo_list[i])
            if content_to_add:
                content_already_exists = 0
                for j in range (0, len(content_to_add)):
                    if content_already_exists:
                        break
                    for k in range (0, len(self.gg_get_definition_version[i])):
                        if content_to_add[j]["Id"] == self.gg_get_definition_version[i][k]["Id"]:
                            content_already_exists = 1
                            break
                if content_already_exists: content_to_add = []

            # Add 
            if self.gg_get_definition_version[i] or content_to_add:
                self.gg_get_definition_version[i] = self.gg_get_definition_version[i] + content_to_add

            # create a new definition
            arg_name = "m2c2-" + self.protocol + "-greengrass-" + self.mnemo_list[i].lower() + "-definition-" + self.job_name
            try:
                self.gg_create_definition[i] = self.call_create_definition(arg_name, i)
            except Exception as err:
                logger.info("create %s definition traceback: %s" %(self.mnemo_list[i].lower(), str(err)))
                post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_create_definition %(self.mnemo_list[i].lower(), arg_name))
                return 0

            arg_content = self.gg_get_definition_version[i]
            arg_id = self.gg_create_definition[i]["Id"]
            try:
                self.gg_definition_version[i] = self.call_create_definition_version(arg_id, arg_content, i)
            except Exception as err:
                logger.info("create %s definition version traceback: %s" %(self.mnemo_list[i].lower(), str(err)))
                post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_create_definition_version %(self.mnemo_list[i].lower()))
                return 0
        return 1


    def get_m2c2_gg_content(self,type):
        content = {
            "Resource": [{
                    "Name": "M2C2LocalResource",
                    "Id": "M2C2LocalResourceId",
                    "ResourceDataContainer": {
                        "LocalVolumeResourceData": {
                            "SourcePath": self.m2c2_local_resource_path,
                            "DestinationPath": self.m2c2_local_resource_path,
                            "GroupOwnerSetting": {
                                "AutoAddGroupOwner": True
                            }
                        }
                    }
            }],
            "Core": [],
            "Device": [], 
            "Function": [{
                "FunctionArn": self.gg_connector_lambda_alias["AliasArn"],
                "FunctionConfiguration": {
                    "EncodingType": "json",
                    "Environment": {
                        "AccessSysfs": False,
                        "ResourceAccessPolicies": [
                            {
                                "Permission": "rw",
                                "ResourceId": "M2C2LocalResourceId"
                            },
                        ],
                    },
                    "Executable": "m2c2_" + self.protocol + "_connector.function_handler",
                    "MemorySize": 128000,
                    "Pinned": True,
                    "Timeout": 10
                },
                "Id": "Function-id-" + self.job_name
            }],
            "Logger": [
                {
                    'Id': 'M2C2Logger1',
                    'Type': 'FileSystem',
                    'Component': 'GreengrassSystem',
                    'Level': 'INFO',
                    'Space': 128
                },{ 
                    'Id': 'M2C2Logger2',
                    'Type': 'FileSystem',
                    'Component': 'Lambda',
                    'Level': 'INFO',
                    'Space': 128
                },{
                    'Id': 'M2C2Logger3',
                    'Type': 'AWSCloudWatch',
                    'Component': 'Lambda',
                    'Level': 'INFO'
                }],
            "Subscription": [
                {
                    "Id": "from-cloud-" + self.job_name,
                    "Source": "cloud",
                    "Subject": "m2c2/job/" + self.job_name + "/submit",
                    "Target": self.gg_connector_lambda_alias["AliasArn"],
                },{
                    "Id": "from-lambda-" + self.job_name,
                    "Source": self.gg_connector_lambda_alias["AliasArn"],
                    "Subject": "m2c2/job/#",
                    "Target": "cloud"
                }
            ]
        }
        return content[type]

    def create_group_version(self):
        logger.info("Previous definitions: " + str(self.gg_group_version))
        logger.info("Updated definitions: " + str(self.gg_definition_version))
        try:
            self.resource_gg_group_version = gg_client.create_group_version(
                    GroupId = self.gg_group_id,        
                    ResourceDefinitionVersionArn = self.gg_definition_version[0]["Arn"],
                    CoreDefinitionVersionArn = self.gg_definition_version[1]["Arn"],
                    DeviceDefinitionVersionArn = self.gg_definition_version[2]["Arn"],
                    FunctionDefinitionVersionArn = self.gg_definition_version[3]["Arn"],
                    LoggerDefinitionVersionArn = self.gg_definition_version[4]["Arn"],
                    SubscriptionDefinitionVersionArn = self.gg_definition_version[5]["Arn"]
                    )

        except Exception as err:
            logger.info("create group version traceback: "+ str(err))
            post.to_user(self.job_name, self.job_version, "error", var.m2c2_gg_create_group_version)
            return 0
        return 1