## Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging
import binascii

import m2c2_utils as utils

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_job(user_request):
    communication_code = utils.get_metadata("communication-code",user_request,0)
    networking_frame = get_slmp_networking_frame(user_request["job"]["machine-details"]["connectivity-parameters"],communication_code)
    data_frames = get_slmp_data_frame(networking_frame, user_request["job"]["machine-details"]["data-parameters"]["attributes"],communication_code)
    data_decode = get_slmp_data_decode(user_request["job"]["machine-details"]["data-parameters"]["attributes"],communication_code)
    processed_job = {
        "job":{
            "control":utils.get_metadata("control",user_request,0),
            "properties":[
                    {
                        "name": utils.get_metadata("name",user_request,0),
                        "version": utils.get_metadata("version",user_request,0)
                    }
            ],
            "machine-details":{
                "site-name": utils.get_metadata("site-name",user_request,0),
                "process": utils.get_metadata("process",user_request,0),
                "area": utils.get_metadata("area",user_request,0),
                "data-parameters":{
                    "machine-query-iterations": utils.get_metadata("machine-query-iterations",user_request,0),
                    "machine-query-time-interval": utils.get_metadata("machine-query-time-interval",user_request,0),
                    "data-frames": data_frames,
                    "data-decode": data_decode
                },
                "connectivity-parameters":{
                    "port-number": utils.get_metadata("port-number",user_request,0),
                    "machine-ip": utils.get_metadata("machine-ip",user_request,0),
                    "protocol": utils.get_metadata("protocol",user_request,0),
                    "machine-name": utils.get_metadata("machine-name",user_request,0),
                    "communication-code": utils.get_metadata("communication-code",user_request,0),
                    "ethernet": utils.get_metadata("ethernet",user_request,0)
                }
            }

        }
    }
    return processed_job

def get_slmp_data_frame(networking_frame, user_request, communication_code):
    frames = []
    for i in range(0,len(user_request)):
        if user_request[i]["function"] == "device_read":
            frames.append(get_slmp_device_read_frame(user_request[i]["address-list"],communication_code))
        elif  user_request[i]["function"] == "device_read_random":
            frames.append(get_slmp_device_read_random_frame(user_request[i]["address-list"],communication_code))
        elif user_request[i]["function"] == "array_label_read":
            frames.append(get_slmp_array_label_read_frame(user_request[i]["address-list"],communication_code))
        elif user_request[i]["function"] == "label_read_random":
            frames.append(get_slmp_label_read_random_frame(user_request[i]["address-list"],communication_code))
    return get_slmp_set_of_frames(networking_frame,frames,communication_code)

def get_slmp_data_decode(user_request, communication_code):
    decode = []
    for i in range(0,len(user_request)):
        if user_request[i]["function"] == "device_read":
            decode.append(get_slmp_device_read_decode(user_request[i]["address-list"],communication_code))
        elif  user_request[i]["function"] == "device_read_random":
            decode.append(get_slmp_device_read_random_decode(user_request[i]["address-list"],communication_code))
        elif user_request[i]["function"] == "array_label_read":
            decode.append(get_slmp_array_label_read_decode(user_request[i]["address-list"],communication_code))
        elif user_request[i]["function"] == "label_read_random":
            decode.append(get_slmp_label_read_random_decode(user_request[i]["address-list"],communication_code))
    return decode

def get_slmp_set_of_frames(networking_frame,frames,communication_code):
    for i in range(0,len(frames)):
        if communication_code == "ascii":
            data_length = len(frames[i]) + len(networking_frame[1])
        if communication_code == "binary":
            data_length = int((len(frames[i]) + len(networking_frame[1]))/2)
        frames[i] = networking_frame[0] + num_to_hex_str(data_length,"word",communication_code) + networking_frame[1] + frames[i]
    return frames

def get_slmp_label_read_random_frame(user_request,communication_code):
    command = "041C"
    if communication_code == "binary":
        command = reverse_numbering("0x"+ command)
    subcommand = user_request["subcommand"]

    # build abbreviations
    abbreviation = user_request["abbreviation"]
    abb_count = len(abbreviation)
    converted_abb = ""
    for i in range(0,abb_count):
        current_abb = abbreviation[i]
        for j in range(0, len(current_abb)):
            converted_abb += num_to_hex_str(int(binascii.hexlify(current_abb[j]),16),"word",communication_code)
        converted_abb = num_to_hex_str(len(current_abb),"word",communication_code) + converted_abb

    # build labels

    label_list = user_request["label-list"]
    converted_lbl = ""
    for i in range(0, len(label_list)):
        current_lbl = label_list[i]["label"]
        working_lbl_frame = ""
        for j in range(0, len(current_lbl)):
            working_lbl_frame += num_to_hex_str(int(binascii.hexlify(bytes(current_lbl[j],encoding="ascii")),16),"word",communication_code)
        converted_lbl += num_to_hex_str(len(current_lbl),"word",communication_code) + working_lbl_frame

    return (\
        command + \
        subcommand + \
        num_to_hex_str(len(label_list),"word",communication_code) + \
        num_to_hex_str(abb_count,"word",communication_code) + \
        converted_abb + \
        converted_lbl)

def get_slmp_label_read_random_decode(user_request,communication_code):
    label_list = user_request["label-list"]
    tags = []
    for i in range(0, len(label_list)):
        tags.append(label_list[i]["tag-name"])
    return {
            "label_read_random": tags
        }

def get_slmp_array_label_read_frame(user_request,communication_code):
    command = "041A"
    if communication_code == "binary":
        command = reverse_numbering("0x"+ command)
    subcommand = user_request["subcommand"]

    # build abbreviations
    abbreviation = user_request["abbreviation"]
    abb_count = len(abbreviation)
    for i in range(0,abb_count):
        current_abb = abbreviation[i]
        converted_abb = ""
        for j in range(0, len(current_abb)):
            converted_abb += num_to_hex_str(int(binascii.hexlify(bytes(current_abb[j],encoding="ascii")),16),"word",communication_code)
        converted_abb = num_to_hex_str(len(current_abb),"word",communication_code) + converted_abb


    # build labels
    label_list = user_request["label-list"]
    converted_lbl = ""
    for i in range(0, len(label_list)):
        current_lbl = label_list[i]["label"]
        working_lbl_frame = ""
        for j in range(0, len(current_lbl)):
            working_lbl_frame += num_to_hex_str(int(binascii.hexlify(bytes(current_lbl[j],encoding="ascii")),16),"word",communication_code)

        converted_lbl += num_to_hex_str(len(current_lbl),"word",communication_code) + working_lbl_frame + \
            num_to_hex_str(label_list[i]["read-unit"],"byte",communication_code) + \
            num_to_hex_str(0,"byte",communication_code) + \
            num_to_hex_str(label_list[i]["data-length"],"word",communication_code)

    return (\
        command +\
        subcommand + \
        num_to_hex_str(len(label_list),"word",communication_code) + \
        num_to_hex_str(abb_count,"word",communication_code) + \
        converted_abb + \
        converted_lbl)

def get_slmp_array_label_read_decode(user_request,communication_code):
    label_list = user_request["label-list"]
    tags = []
    for i in range(0, len(label_list)):
        tags.append(label_list[i]["tag-name"])
    return {
            "array_label_read": tags
        }

def get_slmp_device_read_frame(user_request,communication_code):
    command = "0401"
    if communication_code == "binary":
        command = reverse_numbering("0x"+ command)
    subcommand = user_request["subcommand"]
    devicecode = user_request["device-code"]
    headdevice = user_request["head-device"]
    points = user_request["number-of-points"]
    if communication_code == "ascii":
        return command + subcommand + devicecode + headdevice + points
    elif communication_code == "binary":
        return command + subcommand + headdevice + devicecode + points

def get_slmp_device_read_decode(user_request,communication_code):
    return {
            "device_read": user_request["tag-name"]
        }

def get_slmp_device_read_random_frame(user_request,communication_code):
    command = "0403"
    if communication_code == "binary":
        command = reverse_numbering("0x"+ command)
    subcommand = user_request["subcommand"]
    words_count = 0
    read_random_word = ""
    dwords_count = 0
    read_random_dword = ""

    if "words" in user_request:
        words = user_request["words"]
        words_count = len(words)
        try:
            for i in range(0, words_count):
                if communication_code == "ascii":
                    read_random_word = read_random_word + words[i]["device-code"] + words[i]["head-device"]
                elif communication_code == "binary":
                    read_random_word = read_random_word + words[i]["head-device"] + words[i]["device-code"]
        except:
            pass
    if "dwords" in user_request:
        dwords = user_request["dwords"]
        dwords_count = len(dwords)
        try:
            for i in range(0, dwords_count):
                if communication_code == "ascii":
                    read_random_dword = read_random_dword + dwords[i]["device-code"] + dwords[i]["head-device"]
                elif communication_code == "binary":
                    read_random_dword = read_random_dword + dwords[i]["head-device"] + dwords[i]["device-code"]
        except:
            pass


    return (\
        command + \
        subcommand + \
        num_to_hex_str(words_count,"byte",communication_code) + \
        num_to_hex_str(dwords_count,"byte",communication_code) + \
        read_random_word + \
        read_random_dword)

def get_slmp_device_read_random_decode(user_request,communication_code):
    read_random_word = []
    read_random_dword = []

    if "words" in user_request:
        words = user_request["words"]
        words_count = len(words)
        try:
            for i in range(0, words_count):
                read_random_word.append(words[i]["tag-name"])
        except:
            pass

    if "dwords" in user_request:
        dwords = user_request["dwords"]
        dwords_count = len(dwords)
        try:
            for i in range(0, dwords_count):
                read_random_dword.append(dwords[i]["tag-name"])
        except:
            pass

    return {
            "device_read_random": {
                    "words": read_random_word,
                    "dwords": read_random_dword
                }
            }

def get_slmp_networking_frame(user_request, communication_code):
    network = get_slmp_network(user_request["network"], communication_code)
    station = get_slmp_station(user_request["station"], communication_code)
    module = get_slmp_module(user_request["module"], communication_code)
    multidrop = get_slmp_multidrop(user_request["multidrop"], communication_code)
    timer = get_slmp_timer(user_request["timer"], communication_code)
    subheader = get_slmp_subheader(user_request["subheader"])
    return subheader + network + station + module + multidrop, timer

def get_slmp_subheader(subheader_type):
    if subheader_type == "with serial":
        subheader = "54000000"
    elif subheader_type == "without serial":
        subheader = "5000"
    else:
        subheader = ""
    return subheader

def get_slmp_network(network, communication_code):
    # default to local if not specified
    if not network: network = 0
    return num_to_hex_str(network,"byte",communication_code)

def get_slmp_station(station, communication_code):
    # default to local if not specified
    if not station: station = 255
    return num_to_hex_str(station,"byte",communication_code)

def get_slmp_module(module, communication_code):
    # default to local if not specified
    if not module: module = "03FF"
    module = "0x" + module
    return num_to_hex_str(int(module,16),"word",communication_code)

def get_slmp_multidrop(multidrop, communication_code):
    #hardcoded to 0 for initial release
    if not multidrop: multidrop = 0
    return num_to_hex_str(multidrop,"byte",communication_code)

def get_slmp_timer(timer, communication_code):
    #hardcoded to 0 for initial release
    if not timer: timer = 0
    return num_to_hex_str(timer,"word",communication_code)

def num_to_hex_str(dec_value, type, communication_code):
    lookup = {
        "word" : 2,
        "byte" : 1,
        "dword" : 4
    }
    length_out = lookup.get(type, "")
    if not length_out: return 0
    hex_string = hex(dec_value)
    while len(hex_string) < ((length_out*2)+2):
        hex_string = "0x0"+ hex_string[2:]
    hex_string = hex_string.upper()
    if communication_code == "binary":
        return reverse_numbering(hex_string)
    elif communication_code == "ascii":
        return hex_string[2:]
    else:
        return ""

def reverse_numbering(hex_string):
    step_counter = len(hex_string)
    result = ""
    while step_counter > 0:
        result = result + hex_string[step_counter:step_counter+2]
        step_counter -= 2
    return result