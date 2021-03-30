## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import sys
import os
import sendcfnresponse
import urllib.request
import boto3
import json
import tarfile
import logging
import time

from botocore.exceptions import ClientError
from botocore.client import Config


logger = logging.getLogger()
logger.setLevel(logging.INFO)

STACK_NAME = os.environ['StackName']
THING_ARN = os.environ['ThingArn']
THING_NAME = os.environ['ThingName']
REGION_NAME = os.environ['AWS_REGION']
S3_BUCKET = os.environ['S3Bucket']
SOLUTION_ID = os.environ['SolutionId']
SOLUTION_VERSION = os.environ['SolutionVersion']

# boto3 clients
config = {}
s3_client_config = {
        "s3": { "addressing_style": "virtual" },
        "signature_version": "s3v4"
    }

if SOLUTION_ID and SOLUTION_VERSION:
    config["user_agent_extra"] = f"AwsSolution/{SOLUTION_ID}/{SOLUTION_VERSION}"
    s3_client_config["user_agent_extra"] = f"AwsSolution/{SOLUTION_ID}/{SOLUTION_VERSION}"

iot_client = boto3.client("iot", config=Config(**config))
greengrass_client = boto3.client("greengrass", config=Config(**config))
s3_resource = boto3.resource('s3', config=Config(**config))
s3_client = boto3.client("s3", config=Config(**s3_client_config))

response_data = {}


def write_tar_to_s3(tar_file):
    try:
        logger.info("Trying to write tar file to S3")

        obj_name = str(tar_file).split('/')[-1]
        bucket = s3_resource.Bucket(S3_BUCKET)
        s3_object = bucket.Object(obj_name)
        with open(tar_file, 'rb') as data:
            s3_object.upload_fileobj(data)

        signed_url = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': obj_name
            },
            ExpiresIn=7200
        )
        logger.info("The signed URL: {}".format(signed_url))

        return signed_url
    except Exception as e:
        error_msg = "There was an error uploading the %s objects to the s3 bucket %s: %s" % (str(tar_file), str(S3_BUCKET), str(e))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise


def create_tar_archive(certs_dir, conf_dir, setup_file):
    logger.info("certs_dir: {}, conf_dir: {}, setup_file: {}".format(certs_dir, conf_dir, setup_file))

    try:
        tar_file_name = "/tmp/m2c2-greengrass-" + STACK_NAME + ".tar.gz"
        with tarfile.open(tar_file_name, "w:gz") as tar:
            tar.add(setup_file, arcname='setup.sh')
            tar.add(certs_dir, arcname=os.path.basename(certs_dir.rstrip("/")))
            tar.add(conf_dir, arcname=os.path.basename(conf_dir.rstrip("/")))
        logger.info("Tar file name: {}".format(tar_file_name))
        return(tar_file_name)
    except Exception as e:
        error_msg = "There was an error creating the tarball archive file: %s" % (str(e))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise


def create_setup_script(event):
    try:
        setup_commands = [
            "#!/bin/bash",
            "#Prereq for running this script: download the tar file from S3 that contains your certificate and keypair, upload the tarball to your Greengrass instance",
            "# Run this file with the command `sudo ./setup.sh`",
            "cp certs/* /greengrass/certs",
            "cp config/* /greengrass/config",
            "if [[ ! -d /m2c2 && ! -d /m2c2/job ]] ; then",
            "  mkdir -p /m2c2/job",
            "fi",
            "chown -R ggc_user /m2c2/job/",
            "/greengrass/ggc/core/greengrassd start"
        ]
        file_name = "/tmp/setup.sh"
        logger.info('Writing %s' % str(file_name))
        with open(file_name, "w") as fh:
            for e in setup_commands:
                fh.write(e)
                fh.write('\n')
        os.chmod(file_name, 0o755)
        os.listdir("/tmp/")
        return(file_name)
    except Exception as e:
        error_msg = 'There was an error %s when creating the file %s' % (str(e), str(file_name))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise

def write_file(file_name, file_dir, data):
    try:
        if not os.path.exists(file_dir):
            os.mkdir(file_dir)
        file_full_path = file_dir + file_name
        logger.info('Writing %s' % str(file_full_path))
        with open(file_full_path, 'w') as out_file:
            out_file.write(data)
    except Exception as e:
        error_msg = 'There was an error %s when creating the file %s' % (str(e), str(file_name))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise

def create_config_json(cert_file_name, private_key_name, iot_end_point):
    try:
        file_name = "config.json"
        file_dir = "/tmp/config/"
        respawn = 'false'
        data = {
            "coreThing" : {
                "caPath" : "root.ca.pem",
                "certPath" : cert_file_name,
                "keyPath" : private_key_name,
                "thingArn" : THING_ARN,
                "iotHost" : iot_end_point,
                "ggHost" : "greengrass-ats.iot." + REGION_NAME + ".amazonaws.com"
            },
            "runtime" : {
                "cgroup" : {
                    "useSystemd" : "yes"
                }
            },
            "managedRespawn" : respawn,
            "crypto" : {
                "principals" : {
                    "SecretsManager" : {
                        "privateKeyPath" : "file:///greengrass/certs/" + private_key_name
                    },
                    "IoTCertificate" : {
                        "privateKeyPath" : "file:///greengrass/certs/" + private_key_name,
                        "certificatePath" : "file:///greengrass/certs/" + cert_file_name
                    }
                },
                "caPath" : "file:///greengrass/certs/root.ca.pem"
            }
        }
        logger.info("Creating the config.json file")
        logger.info(json.dumps(data))
        return(file_name, file_dir, data)
    except Exception as e:
        error_msg = "There was an error creating the config.json file: %s" % (str(e))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise


def get_amazon_ca(event):
    try:
        rootfile_name = '/tmp/certs/root.ca.pem'
        urllib.request.urlretrieve('https://www.amazontrust.com/repository/AmazonRootCA1.pem', rootfile_name)
    except Exception as e:
        error_msg = "There was an error getting the Amazon Root CA1 file and writing it: %s" % (str(e))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise


def generate_cert_and_keys(event):
    try:
        response = iot_client.create_keys_and_certificate(
            setAsActive=True
        )
        cert_id = response['certificateId']
        cert_arn = response['certificateArn']
        cert_pem = response['certificatePem']
        private_key = response['keyPair']['PrivateKey']
        public_key = response['keyPair']['PublicKey']
        return(cert_id, cert_arn, cert_pem, private_key, public_key)
    except Exception as e:
        error_msg = "There was an error generating the certificate and key pair: %s" % (str(e))
        response_data['Error'] = error_msg
        logger.error(error_msg)
        raise


def handler(event, context):
    try:
        logger.info('Received event: {}'.format(json.dumps(event)))
        resource = event['ResourceProperties']['Resource']

        if resource == 'CreateGGCertAndKeys':
            if event['RequestType'] == 'Create':
                iot_end_point = iot_client.describe_endpoint(endpointType='iot:Data-ATS')['endpointAddress']
                cert_id, cert_arn, cert_pem, private_key, public_key = generate_cert_and_keys(event)
                logger.info('Created cert: %s ' % (cert_id))

                filePrefix = cert_id[0:7]
                cert_file_name = filePrefix + "-cert.pem"
                private_key_name = filePrefix + "-private.key"
                public_key_name = filePrefix + "-public.key"
                certs_dir = '/tmp/certs/'

                write_file(cert_file_name, certs_dir, cert_pem)
                write_file(private_key_name, certs_dir, private_key)
                write_file(public_key_name, certs_dir, public_key)
                get_amazon_ca(event)

                config_file_name, config_file_dir, data = create_config_json(cert_file_name, private_key_name, iot_end_point)
                write_file(config_file_name, config_file_dir, json.dumps(data))

                setup = create_setup_script(event)
                tar_file = create_tar_archive(certs_dir, config_file_dir, setup)
                logger.info("TarFile: {}".format(tar_file))
                generated_s3_url = write_tar_to_s3(tar_file)

                response_data['certificateId'] = cert_id
                response_data['certificateArn'] = cert_arn
                response_data['certificateName'] = cert_file_name
                response_data['privateKeyName'] = private_key_name
                response_data['publicKeyName'] = public_key_name
                response_data['iotEndpoint'] = iot_end_point
                response_data['generatedS3URL'] = generated_s3_url
        elif resource == 'DeleteGGCertAndKeys':
            if event['RequestType'] == 'Delete':
                cert_id = event['ResourceProperties']['CertId']
                greengrass_group_id = event['ResourceProperties']['GreengrassGroupId']

                logger.info('Resetting the Greengrass group')
                greengrass_client.reset_deployments(
                    GroupId=greengrass_group_id,
                    Force=True
                )

                logger.info('Checking thing principals')
                try:
                    response = iot_client.list_thing_principals(thingName=THING_NAME)
                    while response['principals']:
                        logger.info('Checking thing principals again...')
                        time.sleep(3)
                        response = iot_client.list_thing_principals(thingName=THING_NAME)
                except iot_client.exceptions.ResourceNotFoundException as error:
                    logger.error("There was an error deleteing Greengrass resources: {}".format(error))
                    pass
                else:
                    logger.info('Deleting cert: %s', cert_id)
                    iot_client.update_certificate(
                        certificateId=cert_id,
                        newStatus='INACTIVE'
                    )
                    iot_client.delete_certificate(
                        certificateId=cert_id,
                        forceDelete=True
                    )

        status = sendcfnresponse.SUCCESS
    except Exception as e:
        logger.error('Error: {}'.format(e))
        status = sendcfnresponse.FAILED

    logger.info('Returning response of: {}, with result of: {}'.format(status, response_data))
    sendcfnresponse.send_response(event, context, status, response_data)