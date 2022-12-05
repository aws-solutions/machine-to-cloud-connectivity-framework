# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
from boilerplate.logging.logger import get_logger
from utils.constants import WORK_BASE_DIR
from utils.custom_exception import PublisherException
from utils import (PickleCheckpointManager, StreamManagerHelperClient)
from payload_router import PayloadRouter
from greengrasssdk.stream_manager import (
    ExportDefinition
)
import time
import os
import logging


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


# Constant variables
# Kinesis Data Stream name
KINESIS_STREAM_NAME = os.getenv("KINESIS_STREAM_NAME")
# Timestream Kinesis Data Stream name
TIMESTREAM_KINESIS_STREAM = os.getenv("TIMESTREAM_KINESIS_STREAM")
# Greengrass Stream name
CONNECTION_GG_STREAM_NAME = os.getenv("CONNECTION_GG_STREAM_NAME")
# Historian Kinesis Data Stream name
HISTORIAN_KINESIS_STREAM = os.getenv("HISTORIAN_KINESIS_STREAM")
# Connection name - used for IoT topic and alias (when needed)
CONNECTION_NAME = os.getenv("CONNECTION_NAME")
# Collecotr id - used as an attribute for historian messages
COLLECTOR_ID = os.getenv("COLLECTOR_ID")

# Connection defined destination values
# Connection builder won't set these if they aren't defined as a destination in the connection
SEND_TO_SITEWISE = os.getenv("SEND_TO_SITEWISE")
SEND_TO_IOT_TOPIC = os.getenv("SEND_TO_IOT_TOPIC")
SEND_TO_KINESIS_STREAM = os.getenv("SEND_TO_KINESIS_STREAM")
SEND_TO_TIMESTREAM = os.getenv("SEND_TO_TIMESTREAM")
SEND_TO_HISTORIAN = os.getenv("SEND_TO_HISTORIAN")

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
PROTOCOL = os.getenv("PROTOCOL")

# Stream Manager SiteWise publisher stream
sitewise_stream = 'SiteWise_Stream'
# Stream Manager Kinesis publisher stream
kinesis_sm_stream = 'm2c2_kinesis_stream'
# Stream Manager Timestream Kinesis publisher stream
timestream_kinesis_stream = "m2c2_timestream_stream"

# Max size of message stream when creating (in bytes)
max_stream_size = 5368706371  # 5GB
# Number of messages to read from a stream at a time
read_msg_number = 1

# Checkpoint db - to track message sequence numbers
checkpoint_db = f"{WORK_BASE_DIR}/m2c2-{CONNECTION_NAME}-publisher/stream_checkpoints"

# Checkpoint client for tracking message sequence
checkpoint_client = PickleCheckpointManager(checkpoint_db)
# Base stream manager client
smh_client = StreamManagerHelperClient()

# Logging
logger = logging.getLogger()  # get_logger('m2c2_publisher.py')


def retrieve_checkpoints():
    # Gets the latest checkpoints from the on-disk data store
    # If this is a new connection, there will be no checkpoints, return None
    try:
        trailing_cp, primary_cp = checkpoint_client.retrieve_checkpoints(
            CONNECTION_GG_STREAM_NAME
        )
        return (trailing_cp, primary_cp)
    except Exception as err:
        logger.error(
            "There was an issue retrieving checkpoints for stream {}: {}".format(
                CONNECTION_GG_STREAM_NAME,
                err
            )
        )
        raise


def write_checkpoint(checkpoint, value):
    try:
        checkpoint_client.write_checkpoints(
            CONNECTION_GG_STREAM_NAME, checkpoint, value)
    except Exception as err:
        logger.error(
            f"There was an issue writing the checkpoint {checkpoint} of value {value} for stream {CONNECTION_GG_STREAM_NAME}: {err}"
        )
        raise


def create_hierarchy():
    return {
        "site_name": SITE_NAME,
        "area": AREA,
        "process": PROCESS,
        "machine_name": MACHINE_NAME
    }


def create_destinations():
    return {
        "send_to_sitewise": SEND_TO_SITEWISE,
        "send_to_kinesis_stream": SEND_TO_KINESIS_STREAM,
        "send_to_iot_topic": SEND_TO_IOT_TOPIC,
        "send_to_timestream": SEND_TO_TIMESTREAM,
        "send_to_historian": SEND_TO_HISTORIAN
    }


def create_destination_streams():
    return {
        "sitewise_stream": sitewise_stream,
        "kinesis_sm_stream": kinesis_sm_stream,
        "timestream_kinesis_stream": timestream_kinesis_stream
    }


def init_router_client():
    hierarchy = create_hierarchy()
    destinations = create_destinations()
    destination_streams = create_destination_streams()
    payload_router_parameters = {
        "protocol": PROTOCOL,
        "connection_name": CONNECTION_NAME,
        "hierarchy": hierarchy,
        "destinations": destinations,
        "destination_streams": destination_streams,
        "max_stream_size": max_stream_size,
        "kinesis_data_stream": KINESIS_STREAM_NAME,
        "timestream_kinesis_data_stream": TIMESTREAM_KINESIS_STREAM,
        "historian_data_stream": HISTORIAN_KINESIS_STREAM,
        "collector_id": COLLECTOR_ID
    }
    router_client = PayloadRouter(**payload_router_parameters)
    return router_client


def payload_router(router_client, message):
    try:
        message_sequence_number = router_client.route_payload(message)
        return message_sequence_number
    except Exception as err:
        raise PublisherException(
            f"There was an error when trying to send data to the payload router: '{err}'")


def create_stream():
    logger.info(
        f"Stream {CONNECTION_GG_STREAM_NAME} not found, attempting to create it.")
    gg_exports = ExportDefinition()
    smh_client.create_stream(CONNECTION_GG_STREAM_NAME,
                             max_stream_size, gg_exports)


def check_for_gg_stream():
    # Ensure the message stream exists, if it doesn't, create
    avail_streams = smh_client.list_streams()
    if CONNECTION_GG_STREAM_NAME not in avail_streams:
        return False
    else:
        return True


def main():
    logger.info(f"Starting up publisher for connection {CONNECTION_NAME}")

    # In this case, if the stream does not exist, it is created
    logger.info("Checking for GG stream")
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
        primary = smh_client.get_oldest_sequence_number(
            CONNECTION_GG_STREAM_NAME)
        write_checkpoint('primary', primary)

    # The sequence number tracks the sequence number of the message in progress
    sequence_number = primary

    # Retrive message from the stream
    logger.info(f"Reading from stream {CONNECTION_GG_STREAM_NAME}")
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
                    message_sequence_number = payload_router(
                        router_client, message)
                    write_checkpoint('trailing', message_sequence_number)
                    message_sequence_number += 1
                    write_checkpoint('primary', message_sequence_number)
                    sequence_number = message_sequence_number

            # To reduce the load, sleep 0.01 second.
            time.sleep(0.01)
        except Exception as err:
            logger.error(
                f"There was an error when trying to read your data from a stream and send it to AWS: {err}")
            raise


if __name__ == "__main__":
    main()
