## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import socket
import logging
import binascii
import datetime
from datetime import datetime
from os import environ

import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class DeviceCommunication:
    def __init__(self, current_target_system):
        self.protocol = utils.get_metadata("protocol", current_target_system, 0)
        self.server_address = (utils.get_metadata("machine-ip", current_target_system, 0), utils.get_metadata("port-number", current_target_system, 0))
        self.ethernet = utils.get_metadata("ethernet", current_target_system, 0)
        self.communication_code = utils.get_metadata("communication-code", current_target_system, 0)
        self.scheduled_read = utils.get_metadata("data-frames", current_target_system, 0)
        
        if self.ethernet == "udp":
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        elif self.ethernet == "tcp":
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.frame_counter = 0

    def open(self):
        logger.info("opening communication")
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.settimeout(3)
        if self.connect():
            return 1
        else:
            return 0

    def connect(self):
        logger.info("connecting using " + self.ethernet)
        if self.ethernet == "tcp":
            try:
                self.sock.connect(self.server_address)
                return 1
            except Exception as err:
                if err == "":
                    return 1
                else:
                    logger.info("Failed to connect: " + str(err))
                    return 0
        elif self.ethernet == "udp":
            return 1

    def close(self):
        logger.info("closing connection")
        try:
            self.sock.close()
        except:
            pass
        return 1

    def add_counter(self, current_frame):
        if current_frame[1] == "4":
            if self.frame_counter == 65535:
                self.frame_counter = 0
            else:
                self.frame_counter += 1

            serial = str(self.frame_counter)
            while len(serial) < 4:
                serial = "0"+ serial

            if self.communication_code == "ascii":
                return current_frame[0:4] + serial + current_frame[4:]
            elif self.communication_code == "binary":
                return current_frame[0:4] + serial[2:] + serial[0:2] + current_frame[4:]
        else:
            return frame

    def send(self, frame):
        if self.ethernet == 'tcp':
            self.sock.sendall(frame)
            plc_response = self.sock.recv(4096)
        if self.ethernet == "udp":
            self.sock.sendto(frame, self.server_address)
            plc_response, server = self.sock.recvfrom(4096)
        return plc_response

    def read(self):
        plc_responses = []
        for i in range (0, len(self.scheduled_read)):
            ready_to_send_frame = ""
            ready_to_send_frame = self.add_counter(self.scheduled_read[i])
            # encoding the frame as per requested transmission mode
            if self.communication_code == "binary":
                plc_responses.append(
                    {
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f"),
                        "response": binascii.hexlify(self.send(binascii.unhexlify(ready_to_send_frame.encode("utf-8")))).decode("utf-8")
                    }
                )
            elif self.communication_code == "ascii":
                plc_responses.append(
                    {
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f"),
                        "response": self.send(ready_to_send_frame.encode("utf-8")).decode("utf-8")
                    }
                )
        return plc_responses
