# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# NOTE: This script is intended only for development purposes.
# It can be used to clean an environment after the M2C2 Cloudformation stack is torn down
# PLEASE use it with caution as it can be destructive if used improperly

from multiprocessing import Process
import os
import boto3
import json
s3 = boto3.resource('s3')
cf = boto3.client('cloudformation')
s3Client = boto3.client('s3')
timestreamClient = boto3.client('timestream-write')

bucket_prefix = os.environ['BUCKET_PREFIX']

processes = []


def get_s3_buckets_for_stack(stack_name):

    stack_resources = cf.list_stack_resources(
        StackName=stack_name
    )

    s3_bucket_resources = []
    for resource in stack_resources['StackResourceSummaries']:
        if resource['ResourceType'] == 'AWS::S3::Bucket':
            s3_bucket_resources.append(resource['PhysicalResourceId'])

    return s3_bucket_resources


def get_s3_buckets_by_prefix(s3_prefix):

    prefix_buckets = []

    for bucket in s3.buckets.all():
        if bucket.name.startswith(s3_prefix):
            prefix_buckets.append(bucket.name)

    return prefix_buckets


def clean_and_remove_bucket(bucket_name):
    s3_bucket = s3.Bucket(bucket_name)
    bucket_versioning = s3.BucketVersioning(bucket_name)
    if bucket_versioning.status == 'Enabled':
        s3_bucket.object_versions.delete()
    else:
        s3_bucket.objects.all().delete()

    print(f'Cleaned S3 Bucket: {bucket_name}')

    s3_bucket.delete()

    print(f'Deleted S3 Bucket: {bucket_name}')


def reset_env():

    buckets = get_s3_buckets_by_prefix(s3_prefix=bucket_prefix)

    for bucket in buckets:
        processes.append(
            Process(target=clean_and_remove_bucket, args=(bucket,)))


def reset_timestream():

    databases = []

    result = timestreamClient.list_databases(MaxResults=10)
    databases.extend(result['Databases'])
    next_token = result.get('NextToken', None)
    while next_token:
        result = timestreamClient.list_databases(
            NextToken=next_token, MaxResults=10)
        databases.extend(result['Databases'])
        next_token = result.get('NextToken', None)

    for database_info in databases:

        tables = []

        database_name = database_info['DatabaseName']

        result = timestreamClient.list_tables(
            DatabaseName=database_name, MaxResults=10)
        tables.extend(result['Tables'])
        next_token = result.get('NextToken', None)
        while next_token:
            result = timestreamClient.list_tables(DatabaseName=database_name,
                                                  NextToken=next_token, MaxResults=10)
            tables.extend(result['Tables'])
            next_token = result.get('NextToken', None)

        for table_info in tables:

            tableName = table_info['TableName']

            timestreamClient.delete_table(
                DatabaseName=database_name, TableName=tableName)

        timestreamClient.delete_database(DatabaseName=database_name)


if __name__ == '__main__':

    print('The following buckets will be removed:')
    print(json.dumps(get_s3_buckets_by_prefix(bucket_prefix)))

    resp = input('Continue?')

    if resp.lower() != 'y':
        print("Did not get 'y' response. Exiting...")
        exit(1)

    reset_env()
    for processRun in processes:
        processRun.start()
    for processRun in processes:
        processRun.join()

    print('Delete all timestream databases?')
    resp = input('Continue?')

    if resp.lower() != 'y':
        print("Did not get 'y' response. Exiting...")
        exit(1)

    reset_timestream()
