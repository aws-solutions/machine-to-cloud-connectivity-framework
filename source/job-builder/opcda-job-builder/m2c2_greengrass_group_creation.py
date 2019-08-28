## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import boto3
import logging
import os
import boto3

import m2c2_job_builder_messages as msg
import m2c2_job_builder_lib as lib


reference_bucket = os.environ["JBM_BCK"]

logger = logging.getLogger()
logger.setLevel(logging.INFO)

lambda_client = boto3.client('lambda')
gg_client = boto3.client('greengrass')



class generate_greengrass_resources:
    def __init__(self, job_name, job_version, gg_group_id, protocol):
        self.get_group_response = ""
        self.get_group_version_response = ""
        self.resource_gg_group_version = ""
        self.resource_gg_function_definition = ""
        self.resource_gg_function_definition_version = ""
        self.resource_gg_function_definition_delete = ""
        self.resource_gg_subscription_definition = ""
        self.resource_gg_subscription_definition_version = ""
        self.resource_gg_subscription_definition_delete = ""
        self.resource_gg_resource_definition = ""
        self.resource_gg_resource_definition_version = ""
        self.resource_gg_resource_definition_delete = ""
        self.resource_connector_lambda = ""
        self.resource_connector_lambda_alias = ""
        return

    def create(self,job_name, job_version, gg_group_id, protocol):
        connector_lambda_key = os.environ["CON_KEY"]
        connector_lambda_role = os.environ["CON_ROL"]
        # if Greengrass Group Id is not specified, use GroupId and ResourceId issued during the cloud formation template deployment
        if (gg_group_id == "") or (gg_group_id == os.environ["GGG_ID"]):
            gg_group_id = os.environ["GGG_ID"]
            gg_resource_id = os.environ["RES_ID"]
        else:
            gg_resource_id = ""

        if not self.create_lambda(connector_lambda_key, connector_lambda_role, job_name, job_version,protocol): return ""
        if not self.get_group_definition(gg_group_id, job_name, job_version) : return ""

        if not gg_resource_id:
            gg_resource_id = "M2C2LocalResourceId"
            resource_created = True
            resource_list = self.get_existing_resource_definitions(job_name, job_version)
            if not self.create_resource_definition(resource_list, job_name, job_version, gg_resource_id): return ""
        else:
            resource_created = False

        function_list = self.get_existing_function_definitions(job_name, job_version)
        if not self.create_function_definition(function_list, gg_resource_id, job_name, job_version): return ""

        subscription_list = self.get_existing_subscription_definitions(job_name, job_version)
        if not self.create_subscription_definition(subscription_list, job_name, job_version): return ""
        if not self.create_group_version(gg_group_id, job_name, job_version, resource_created): return ""
        return 1

    def remove(self):
        if self.resource_gg_function_definition_version != "":
            self.resource_gg_function_definition_delete = gg_client.delete_function_definition(FunctionDefinitionId=self.resource_gg_function_definition["Id"])
        if self.resource_gg_subscription_definition_version != "":
            self.resource_gg_subscription_definition_delete = gg_client.delete_subscription_definition(SubscriptionDefinitionId=self.resource_gg_subscription_definition["Id"])
        if self.resource_gg_resource_definition_version != "":
            self.resource_gg_resource_definition_delete = gg_client.delete_resource_definition(ResourceDefinitionId=self.resource_gg_resource_definition["Id"])
        if self.resource_connector_lambda != "":
            self.resource_connector_lambda_delete = lambda_client.delete_function(FunctionName=self.resource_connector_lambda['FunctionName'])
        if self.resource_connector_lambda_alias != "":
            self.resource_connector_lambda_alias_delete = lambda_client.delete_alias(FunctionName=self.resource_connector_lambda['FunctionName'],Name=self.resource_connector_lambda_alias["Name"])
        logger.info("Resources have been remove. Exiting.")
        return ""

    def create_lambda(self, connector_lambda, connector_lambda_role, job_name, job_version,protocol):
        uniqueID = lib.unique_id()
        try:
            self.resource_connector_lambda = lambda_client.create_function(
                FunctionName="m2c2-" + protocol + "-connector-" + job_name + "-" + uniqueID,
                Runtime="python2.7",
                Role=connector_lambda_role,
                Handler="m2c2-" + protocol + "-connector.function_handler",
                Code={
                    "S3Bucket": reference_bucket,
                    "S3Key": connector_lambda + "/m2c2-" + protocol + "-connector.zip",
                },
                Description="m2c2-" + protocol + "-connector-lambda-" + job_name,
                Timeout=5,
                MemorySize=128,
                Publish=True
            )
            logger.info("create lambda function: " + str(self.resource_connector_lambda))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_LAMBDA_CREATE)
            return ""
        else:
            try:
                self.resource_connector_lambda_alias = lambda_client.create_alias(
                    FunctionName=self.resource_connector_lambda["FunctionArn"],
                    Name="m2c2-" + protocol + "-connector-" + job_name + "-" + uniqueID,
                    FunctionVersion='1'
                )
            except Exception as err:
                logger.info("traceback:"+ str(err))
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_LAMBDA_CREATE_ALIAS)
                return self.remove()
        return 1

    def get_group_definition(self, gg_group_id, job_name, job_version):
        try:
            self.get_group_response = gg_client.get_group(GroupId=gg_group_id)
            logger.info("get group: " + str(self.get_group_response))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_GET_GROUP)
            return self.remove()
        else:
            try:
                self.get_group_version_response = gg_client.get_group_version(
                    GroupId=self.get_group_response["Id"],
                    GroupVersionId=self.get_group_response["LatestVersion"]
                )
                logger.info("get group version: " + str(self.get_group_version_response))
            except Exception as err:
                logger.info("traceback:"+ str(err))
                lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_GET_GROUP_VERSION)
                return self.remove()
        return 1

    def get_existing_function_definitions(self, job_name, job_version):
        try:
            list_function_definitions = []
            list_function_definitions_temp_array = gg_client.list_function_definitions(MaxResults='30')
            list_function_definitions = list_function_definitions_temp_array['Definitions']
            
            # List all available function definition 
            while ('NextToken' in list_function_definitions_temp_array):
                tokenValue = list_function_definitions_temp_array["NextToken"]
                list_function_definitions_temp_array = gg_client.list_function_definitions(NextToken=tokenValue)
                for i in range(0, len(list_function_definitions_temp_array['Definitions'])):
                    list_function_definitions.append(list_function_definitions_temp_array['Definitions'][i])
            
            # Only keep the function definition that are relevant to the current GreenGrass Group Id
            function_list = []
            for i in range(0, len(list_function_definitions)):
                if ('LatestVersionArn' in list_function_definitions[i]):
                    j = 0
                    if ('FunctionDefinitionVersionArn' in self.get_group_version_response["Definition"]):
                        if self.get_group_version_response["Definition"]["FunctionDefinitionVersionArn"] == \
                                list_function_definitions[i]["LatestVersionArn"]:
                            j = j + 1
                            function = gg_client.get_function_definition_version(
                                FunctionDefinitionId=list_function_definitions[i]["Id"],
                                FunctionDefinitionVersionId=list_function_definitions[i]["LatestVersion"]
                            )
                            if j == 1:
                                function_list = function["Definition"]["Functions"]
                            elif j > 1:
                                function_list.append(function["Definition"]["Functions"])
                        else:
                            # definition is not in the group. move to next
                            pass
                    else:
                        break
            return function_list
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_RETRIEVE_FUNCTIONS)
            return self.remove()

    def get_existing_subscription_definitions(self, job_name, job_version):
        try:
            list_subscription_definitions = []
            list_subscription_definitions_temp_array = gg_client.list_subscription_definitions(MaxResults='30')
            list_subscription_definitions = list_subscription_definitions_temp_array['Definitions']
            
            # List all available subscription definition 
            while ('NextToken' in list_subscription_definitions_temp_array):
                tokenValue = list_subscription_definitions_temp_array["NextToken"]
                list_subscription_definitions_temp_array = gg_client.list_subscription_definitions(NextToken=tokenValue)
                for i in range(0, len(list_subscription_definitions_temp_array['Definitions'])):
                    list_subscription_definitions.append(
                        list_subscription_definitions_temp_array['Definitions'][i])

            # Only keep the subscription definition that are relevant to the current GreenGrass Group Id
            subscription_list = []
            for i in range(0, len(list_subscription_definitions)):
                j = 0
                if ('LatestVersionArn' in list_subscription_definitions[i]):
                    j = j + 1
                    if ('SubscriptionDefinitionVersionArn' in self.get_group_version_response["Definition"]):
                        if (self.get_group_version_response["Definition"]["SubscriptionDefinitionVersionArn"] ==
                                list_subscription_definitions[i]["LatestVersionArn"]):
                            subscription = gg_client.get_subscription_definition_version(
                                SubscriptionDefinitionId=list_subscription_definitions[i]["Id"],
                                SubscriptionDefinitionVersionId=list_subscription_definitions[i]["LatestVersion"]
                            )
                            if j == 1:
                                subscription_list = subscription['Definition']['Subscriptions']
                            elif j > 1:
                                subscription_list.append(subscription['Definition']['Subscriptions'])
                        else:
                            # definition is not in the group. move to next
                            pass
            return subscription_list
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_RETRIEVE_SUSCRIPTIONS)
            return self.remove()

    def create_function_definition(self, function_list, gg_resource_id, job_name, job_version):

        try:
            self.resource_gg_function_definition = gg_client.create_function_definition(Name='m2c2-opcda-greengrass-function-definition' + job_name)
            logger.info("create function definition: " + str(self.resource_gg_function_definition))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_FUNCTION_DEFINITION)
            return self.remove()

        ##### Add new function to existing function list

        new_function = {
            'FunctionArn': self.resource_connector_lambda_alias["AliasArn"],
            'FunctionConfiguration': {
                'EncodingType': 'json',
                'Environment': {
                    'AccessSysfs': False,
                    'ResourceAccessPolicies': [
                        {
                            'Permission': 'rw',
                            'ResourceId': gg_resource_id
                        },
                    ],
                },
                'Executable': 'm2c2-opcda-connector.function_handler',
                'MemorySize': 128000,
                'Pinned': True,
                'Timeout': 10
            },
            'Id': 'Function-id-' + job_name
        }
        function_list.append(new_function)
        try:
            self.resource_gg_function_definition_version = gg_client.create_function_definition_version(
                FunctionDefinitionId=self.resource_gg_function_definition["Id"], Functions=function_list)
            logger.info("create function definition version: " + str(self.resource_gg_function_definition_version))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_FUNCTION_DEFINITION_VERSION)
            return self.remove()
        return 1

    def create_subscription_definition(self, subscription_list, job_name, job_version):
        try:
            self.resource_gg_subscription_definition = gg_client.create_subscription_definition(Name='m2c2-opcda-greengrass-subscription-definition-' + job_name)
            logger.info("create subscription definition: " + str(self.resource_gg_subscription_definition))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_SUBSCRIPTION_DEFINITION)
            return self.remove()
        
        # OPCDA connector subscriptions are added to the existing greegrass group subscription definitions
        new_subscription = {
            'Id': 'from-cloud-subscription-id' + job_name,
            'Source': 'cloud',
            'Subject': "m2c2/job/" + job_name + "/submit",
            'Target': self.resource_connector_lambda_alias["AliasArn"],
        }
        subscription_list.append(new_subscription)
        new_subscription = {
            'Id': 'from-lambda-subscription-id' + job_name,
            'Source': self.resource_connector_lambda_alias["AliasArn"],
            'Subject': 'm2c2/job/#',
            'Target': 'cloud'
        }
        subscription_list.append(new_subscription)

        try:
            self.resource_gg_subscription_definition_version = gg_client.create_subscription_definition_version(
                SubscriptionDefinitionId=self.resource_gg_subscription_definition["Id"],
                Subscriptions=subscription_list
            )
            logger.info("create subscription definition version: " + str(self.resource_gg_subscription_definition_version))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_SUBSCRIPTION_DEFINITION_VERSION)
            return self.remove()
        return 1

    def get_existing_resource_definitions(self, job_name, job_version):
        try:
            list_resource_definitions = []
            list_resource_definitions_temp_array = gg_client.list_resource_definitions(MaxResults='30')
            list_resource_definitions = list_resource_definitions_temp_array['Definitions']
            
            # List all available local resource definition 
            while ('NextToken' in list_resource_definitions_temp_array):
                tokenValue = list_resource_definitions_temp_array["NextToken"]
                list_resource_definitions_temp_array = gg_client.list_resource_definitions(NextToken=tokenValue)
                for i in range(0, len(list_resource_definitions_temp_array['Definitions'])):
                    list_resource_definitions.append(list_resource_definitions_temp_array['Definitions'][i])

            # Only keep the local resource definition that are relevant to the current GreenGrass Group Id
            resource_list = []
            for i in range(0, len(list_resource_definitions)):
                if ('LatestVersionArn' in list_resource_definitions[i]):
                    j = 0
                    if ('ResourceDefinitionVersionArn' in self.get_group_version_response["Definition"]):
                        if self.get_group_version_response["Definition"]["ResourceDefinitionVersionArn"] == \
                                list_resource_definitions[i]["LatestVersionArn"]:
                            j = j + 1
                            resource = gg_client.get_resource_definition_version(
                                ResourceDefinitionId=list_resource_definitions[i]["Id"],
                                ResourceDefinitionVersionId=list_resource_definitions[i]["LatestVersion"]
                            )
                            if j == 1:
                                resource_list = resource["Definition"]["Resources"]
                            elif j > 1:
                                resource_list.append(resource["Definition"]["Resources"])
                        else:
                            # definition is not in the group. move to next
                            pass
                    else:
                        break
            return resource_list
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_RETRIEVE_RESOURCES)
            return self.remove()

    def create_resource_definition(self, resource_list, job_name, job_version, gg_resource_id):
        try:
            self.resource_gg_resource_definition = gg_client.create_resource_definition(Name="M2C2LocalResource" + job_name)
            logger.info("create resource definition: " + str(self.resource_gg_resource_definition))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_RESOURCE_DEFINITION)
            return self.remove()

        # OPCDA connector local resource added to the existing greegrass group resource definitions
        new_resource_required = True
        for i in range(0, len(resource_list)):
            if resource_list[i]["Id"] == gg_resource_id:
                new_resource_required = False
        if new_resource_required:
            new_resource = {
                "Name": gg_resource_id,
                "Id": gg_resource_id,
                "ResourceDataContainer": {
                    "LocalVolumeResourceData": {
                        "SourcePath": "/m2c2/job",
                        "DestinationPath": "/m2c2/job",
                        "GroupOwnerSetting": {
                            "AutoAddGroupOwner": True
                        }
                    }
                }
            }
            resource_list.append(new_resource)
        try:
            self.resource_gg_resource_definition_version = gg_client.create_resource_definition_version(ResourceDefinitionId=self.resource_gg_resource_definition["Id"], Resources=resource_list)
            logger.info("create resource definition version: " + str(self.resource_gg_resource_definition_version))
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_RESOURCE_DEFINITION_VERSION)
            return self.remove()
        return 1

    def create_group_version(self, gg_group_id, job_name, job_version, resource_created):
        CoreDefinitionVersionArn=self.get_group_version_response["Definition"]["CoreDefinitionVersionArn"]
        FunctionDefinitionVersionArn=self.resource_gg_function_definition_version["Arn"]
        GroupId=gg_group_id
        SubscriptionDefinitionVersionArn=self.resource_gg_subscription_definition_version["Arn"]

        if resource_created:
            ResourceDefinitionVersionArn=self.resource_gg_resource_definition_version["Arn"]
        else:
            ResourceDefinitionVersionArn=self.get_group_version_response["Definition"]["ResourceDefinitionVersionArn"]
    
        try:
            self.resource_gg_group_version = gg_client.create_group_version(
                    CoreDefinitionVersionArn=CoreDefinitionVersionArn,
                    FunctionDefinitionVersionArn=FunctionDefinitionVersionArn,
                    GroupId=GroupId,
                    ResourceDefinitionVersionArn=ResourceDefinitionVersionArn,
                    SubscriptionDefinitionVersionArn=SubscriptionDefinitionVersionArn)
        except Exception as err:
            logger.info("traceback:"+ str(err))
            lib.post_to_user(job_name, job_version, "error", msg.ERR_MSG_GREENGRASS_CREATE_GROUP_VERSION)
            return self.remove()
        return 1
