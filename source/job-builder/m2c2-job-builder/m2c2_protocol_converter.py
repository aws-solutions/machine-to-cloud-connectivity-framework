## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

import m2c2_utils as utils
import protocol.m2c2_prot_keys as pkeys
import protocol.m2c2_conn_keys as ckeys
import protocol.m2c2_data_keys as dkeys
import protocol.m2c2_range as chkrng
import protocol.m2c2_job as jb
import protocol.m2c2_runtime as rt
import protocol.m2c2_prot_metrics as met

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def prot_keys(metadata, user_job_request, index, protocol):
    return pkeys.get(metadata, user_job_request, index, protocol)

def connectivity_keys(user_request):
    return ckeys.get(user_request)
   
def data_keys(user_request, index):
    return dkeys.get(user_request, index)

def check_range(user_request):
    return chkrng.get(user_request)
    
def job(user_request):
    return jb.get(user_request)

def runtime(protocol):
    return rt.get(protocol)

def protocol_metrics(user_request,aws_metrics):
    return met.get(user_request,aws_metrics)

