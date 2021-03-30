## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

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