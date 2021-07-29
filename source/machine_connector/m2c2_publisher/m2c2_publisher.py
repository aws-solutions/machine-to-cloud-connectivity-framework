# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
This is the Machine To Cloud Connectivity Publisher Lambda function.
It takes data from a stream and writes it to predefined definitions

The publisher expects the payload of the messages on the stream to be the following:
{
    "alias": str,
    "messages": [
        {
            "name": alias,
            "value": various values,
            "quality": 'Good|GOOD|Bad|BAD|Uncertain|UNCERTAIN',
            "timestamp": str
        }
    ]
}
It publishes data to any of the following: SiteWise, Kinesis Data Stream, an IoT topic
"""
import logging
import os

from greengrasssdk.stream_manager import (
    ExportDefinition
)

from payload_router import PayloadRouter
from utils import (CheckpointManager, StreamManagerHelperClient)


# Constant variables
# Kinesis Data Stream name
KINESIS_STREAM_NAME = os.environ["KINESIS_STREAM_NAME"]
# Greengrass Stream name
CONNECTION_GG_STREAM_NAME = os.environ["CONNECTION_GG_STREAM_NAME"]
# Connection name - used for IoT topic and alias (when needed)
CONNECTION_NAME = os.environ["CONNECTION_NAME"]

# Connection defined destination values
# Connection builder won't set these if they aren't defined as a destination in the connection
SEND_TO_SITEWISE = os.getenv("SEND_TO_SITEWISE")
SEND_TO_IOT_TOPIC = os.getenv("SEND_TO_IOT_TOPIC")
SEND_TO_KINESIS_STREAM = os.getenv("SEND_TO_KINESIS_STREAM")

# The following variables may not be set
# if using a protocol supported by an AWS-managed connector
# Site name from Greengrass Lambda Environment variables
SITE_NAME = os.getenv("SITE_NAME")
# Area from Greengrass Lambda Environment variables
AREA = os.getenv("AREA")
# Process from Greengrass Lambda Environment variables
PROCESS = os.getenv("PROCESS")
# Machine name from Greengrass Lambda Environment variables
MACHINE_NAME = os.getenv("MACHINE_NAME")

# Messaging protocol
PROTOCOL = os.environ['PROTOCOL']

# Stream Manager SiteWise publisher stream
sitewise_stream = 'SiteWise_Stream'
# Stream Manager Kinesis publisher stream
kinesis_sm_stream = 'm2c2_kinesis_stream'

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5GB
# Number of messages to read from a stream at a time
read_msg_number = 1

# Checkpoint db - to track message sequence numbers
checkpoint_db = '/m2c2/job/stream_checkpoints'

# Checkpoint client for tracking message sequence
checkpoint_client = CheckpointManager(checkpoint_db)
# Base stream manager client
smh_client = StreamManagerHelperClient()

# Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def retrieve_checkpoints():
    # Gets the latest checkpoints from the on-disk data store
    # If this is a new connection, there will be no checkpoints, return None
    try:
        trailing_cp, primary_cp = checkpoint_client.retrieve_checkpoints(
            CONNECTION_GG_STREAM_NAME
        )
        return(trailing_cp, primary_cp)
    except Exception as err:
        logger.error("There was an issue retrieving checkpoints for stream {}: {}".format(
            CONNECTION_GG_STREAM_NAME,
            err
           )
        )
        raise


def write_checkpoint(checkpoint, value):
    try:
        checkpoint_client.write_checkpoints(CONNECTION_GG_STREAM_NAME, checkpoint, value)
    except Exception as err:
        logger.error("There was an issue writing the checkpoint {} of value {} for stream {}: {}".format(
            checkpoint,
            value,
            CONNECTION_GG_STREAM_NAME,
            err
           )
        )
        raise


def create_hierarchy():
    return{
            "site_name": SITE_NAME,
            "area": AREA,
            "process": PROCESS,
            "machine_name": MACHINE_NAME
        }


def create_destinations():
    return {
            "send_to_sitewise": SEND_TO_SITEWISE,
            "send_to_kinesis_stream": SEND_TO_KINESIS_STREAM,
            "send_to_iot_topic": SEND_TO_IOT_TOPIC
        }


def create_destination_streams():
    return {
            "sitewise_stream": sitewise_stream,
            "kinesis_sm_stream": kinesis_sm_stream
        }


def init_router_client():
    hierarchy = create_hierarchy()
    destinations = create_destinations()
    destination_streams = create_destination_streams()
    router_client = PayloadRouter(
        PROTOCOL,
        CONNECTION_NAME,
        hierarchy,
        destinations,
        destination_streams,
        max_stream_size,
        KINESIS_STREAM_NAME
    )
    return router_client


def payload_router(router_client, message):
    try:
        message_sequence_number = router_client.route_payload(message)
        return message_sequence_number
    except Exception as err:
        raise Exception("There was an error when trying to send data to the payload router: '{}'".format(err))


def create_stream():
    logger.info("Stream {} not found, attempting to create it.".format(
        CONNECTION_GG_STREAM_NAME
        )
    )
    gg_exports = ExportDefinition()
    smh_client.create_stream(CONNECTION_GG_STREAM_NAME, max_stream_size, gg_exports)


def check_for_gg_stream():
    # Ensure the message stream exists, if it doesn't, create
    avail_streams = smh_client.list_streams()
    if CONNECTION_GG_STREAM_NAME not in avail_streams:
        return False
    else:
        return True


def main():
    logger.info("Starting up publisher for connection {}".format(CONNECTION_NAME))

    logger.info("Checking for GG stream")
    # In this case, if the stream does not exist, it is created
    stream_exists = check_for_gg_stream()
    if not stream_exists:
        create_stream()

    # Get the checkpoints from the data store
    # Trailing checkpoint will be the last sequence number written to the cloud
    # Primary checkpoint will be the last sequence number read from the stream
    trailing, primary = retrieve_checkpoints()

    # If the trailing checkpoint exists,
    # set the primary to the next in the sequence after the trailing
    if trailing:
        primary = trailing + 1
        write_checkpoint('primary', trailing)

    # If primary isn't set in the checkpoint manager,
    # retrieve the oldest sequence number from the stream
    if not primary:
        primary = smh_client.get_oldest_sequence_number(CONNECTION_GG_STREAM_NAME)
        write_checkpoint('primary', primary)

    # The sequence number tracks the sequence number of the message in progress
    sequence_number = primary

    # Retrive message from the stream
    logger.info("Reading from stream {}".format(CONNECTION_GG_STREAM_NAME))
    router_client = init_router_client()
    # In a infinite loop, read the next message in the stream
    # If there are no messages associate with the sequence number,
    # check the stream again until there are new messages
    # When there is a new message, send to the payload router
    while True:
        try:
            message_data = smh_client.read_from_stream(
                CONNECTION_GG_STREAM_NAME,
                sequence_number,
                read_msg_number
                )
            if message_data:
                for message in message_data:
                    message_sequence_number = payload_router(router_client, message)
                    write_checkpoint('trailing', message_sequence_number)
                    message_sequence_number += 1
                    write_checkpoint('primary', message_sequence_number)
                    sequence_number = message_sequence_number
        except Exception as err:
            logger.error("There was an error when trying to read your data from a stream and send it to AWS: {}".format(err))
            raise


def function_handler(connection_data, context):
    return


main()
