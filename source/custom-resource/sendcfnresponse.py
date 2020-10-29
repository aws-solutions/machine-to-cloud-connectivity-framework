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
from json import dumps
import urllib.request

SUCCESS = "SUCCESS"
FAILED = "FAILED"

def send_response(event, context, status, responseData):
    print("Sending a response to CloudFormation to handle the custom resource lifecycle")
    print("Status: {}".format(str(status)))
    print("Response Data: {}".format(str(responseData)))

    responseBody = {
        'Status': status,
        'Reason': 'See details in CloudWatch Log Stream: ' + \
            context.log_stream_name,
        'PhysicalResourceId': context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': responseData
    }

    print('RESPONSE BODY: \n' + dumps(responseBody))

    data = dumps(responseBody).encode('utf-8')

    req = urllib.request.Request(
        event['ResponseURL'],
        data,
        headers={'Content-Length': len(data), 'Content-Type': ''})
    req.get_method = lambda: 'PUT'

    try:
        with urllib.request.urlopen(req) as response:
            print(f'response.status: {response.status}, ' +
                  f'response.reason: {response.reason}')
            print('response from cfn: ' + response.read().decode('utf-8'))
    except urllib.error.URLError:
        raise Exception('Received non-200 response while sending ' +\
            'response to AWS CloudFormation')

    return True