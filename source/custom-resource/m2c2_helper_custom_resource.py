##################################################################################################################### 
# Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           # 
#                                                                                                                   # 
# Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    # 
# with the License. A copy of the License is located at                                                             # 
#                                                                                                                   # 
#     http://www.apache.org/licenses/LICENSE-2.0                                                                    # 
#                                                                                                                   # 
# or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES # 
# OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing         # 
# permissions and limitations under the License.                                                                    # 
######################################################################################################################
import json
import logging
import threading
import boto3
import sendcfnresponse
import uuid
import datetime 
import json 
import urllib.request 

s3 = boto3.client('s3')

def send_metrics(config): 
    metrics = {} 
    metrics['Solution'] = config['SolutionId'] 
    metrics['UUID'] = config['UUID'] 
    metrics['TimeStamp'] = str(datetime.datetime.utcnow().isoformat())
    data = {}
    data['ExistingGreengrassGroup'] = config['ExistingGreengrassGroup']
    data['Region'] = config['Region']
    data['EventType'] = config['EventType']
    metrics['Data'] = data
    url = 'https://metrics.awssolutionsbuilder.com/generic' 
    data = json.dumps(metrics, default=datetime_handler).encode('utf8') 
    headers = {'content-type': 'application/json'} 
    req = urllib.request.Request(url, data,headers) 
    response = urllib.request.urlopen(req) 
    print('RESPONSE CODE:: {}'.format(response.getcode())) 
    print('METRICS SENT:: {}'.format(data)) 
    return


def copy_objects(source_bucket, dest_bucket, prefix, objects, dest_prefix):
    cp_stat = []
    for o in objects:
        stat = {}
        key = prefix + o
        dest_key = dest_prefix + o
        copy_source = {
            'Bucket': source_bucket,
            'Key': key
        }
        print('copy_source: %s' % copy_source)
        print('dest_bucket = %s'%dest_bucket)
        print('dest_key = %s' %dest_key)
        try:
            cp_resp = s3.copy_object(CopySource=copy_source, Bucket=dest_bucket,
                    Key=dest_key)
            stat['RequestId'] = cp_resp['ResponseMetadata']['RequestId']
            stat['Status'] = cp_resp['ResponseMetadata']['HTTPStatusCode']
            cp_stat.append(stat)
        except Exception as err:
            print("Failed to copy the protocol lambda function to the destination S3 bucket. Error: {}".format(str(err)))
            raise
    return(cp_stat)

def delete_objects(bucket, prefix, objects):
    print('in delete function')
    del_stat = []
    for o in objects:
        stat = {}
        delete_key = prefix + o
        try:
            del_resp = s3.delete_object(Bucket=bucket, Key=delete_key)
            stat['RequestId'] = del_resp['ResponseMetadata']['RequestId']
            stat['Status'] = del_resp['ResponseMetadata']['HTTPStatusCode']
            del_stat.append(stat)
        except Exception as err:
            print("Failed to delete the protocol lambda function from the S3 bucket. Error: {}".format(str(err)))
            raise
    return(del_stat)

def timeout(event, context):
    logging.error('Execution is about to time out, sending failure response to CloudFormation')
    sendcfnresponse.send_response(event, context, sendcfnresponse.FAILED, {})

def handler(event, context):
    # make sure we send a failure to CloudFormation if the function
    # is going to timeout
    print("EVENT: " + str(event))
    timer = threading.Timer((context.get_remaining_time_in_millis()
                / 1000.00) - 0.5, timeout, args=[event, context])
    timer.start()
    print('Received event: %s' % json.dumps(event))
    status = sendcfnresponse.SUCCESS
    responseData = {}
    config = event['ResourceProperties']
    try:
        if event['RequestType'] in ['Create', 'Update'] :
            if config['Resource'] == 'CopyConnectorLambdaZip' or config['Resource'] == 'CopySLMPConnectorLambdaZip':
                print("Config: {}".format(str(config)))
                source_bucket = config['SourceBucket']
                dest_bucket = config['DestBucket']
                prefix = config['SourcePrefix']
                dest_prefix = config['DestPrefix']
                objects = config['Objects']
                responseData['UUID'] = str(uuid.uuid4())
                responseData['Data'] = copy_objects(source_bucket, dest_bucket, prefix, objects, dest_prefix)
            elif config['Resource'] == 'SendAnonymousMetrics':
                if event['RequestType'] == 'Create':
                    config['EventType'] = 'DeployStack'
                elif event['RequestType'] == 'Update':
                    config['EventType'] = 'UpdateStack'
                try:
                    send_metrics(config)
                except:
                    pass
        elif event['RequestType'] == 'Delete':
            if config['Resource'] == 'CopyConnectorLambdaZip' or config['Resource'] == 'CopySLMPConnectorLambdaZip':
                dest_bucket = config['DestBucket']
                dest_prefix = config['DestPrefix']
                objects = config['Objects']
                responseData['Data'] = delete_objects(dest_bucket, dest_prefix, objects)
            elif config['Resource'] == 'SendAnonymousMetrics':
                delete_config = event['ResourceProperties']
                delete_config['EventType'] = 'DeleteStack'
                send_metrics(delete_config)
    except Exception as e:
        logging.error('Exception: %s' % e, exc_info=True)
        status = sendcfnresponse.FAILED
    finally:
        timer.cancel()
        sendcfnresponse.send_response(event, context, status, responseData)