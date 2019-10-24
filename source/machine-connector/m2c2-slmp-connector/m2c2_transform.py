## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging
import m2c2_utils as utils
import m2c2_post_handler as post

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# PLC response in the following fomat: [[a0, b0, c0, d0],[a1, b1, c1, d1],[a2, b2, c2, d2],....] where a/b/c/d is in {"timestamps":"", "response":""}
# firstly the payload is decoded and sorted by timestamp as in {"timestamp":"",[{"tag name": "tag value"},...]}
# secondly the result is organised into {"tag name":[{"timestamp":"", "value": "tag value"},...]}
def transform(payload, job):
    #logger.info("payload: " +str(payload))
    #logger.info("Job: " + str(job))
    formatted_payload = {}
    decoded_responses = []
    for i in range(0, len(payload)):
        for j in range (0, len(payload[i])):
            # Decode and sort by timestamp
            decoded_responses.append(decode_frame(utils.get_metadata("communication-code", job, 0), payload[i][j], utils.get_metadata("data-decode", job, j)))
    # organise by tag name
    for i in range(0, len(decoded_responses)):
        if decoded_responses[i] != 0:
            for j in range(0, len(decoded_responses[i])):
                if list(decoded_responses[i].keys())[j] != "timestamp":
                    temp = {
                            "timestamp": decoded_responses[i]["timestamp"],
                            "value": decoded_responses[i][list(decoded_responses[i].keys())[j]]
                            }
                    if list(decoded_responses[i].keys())[j] not in list(formatted_payload.keys()):
                        formatted_payload[list(decoded_responses[i].keys())[j]] = [temp]
                    else:
                        formatted_payload[list(decoded_responses[i].keys())[j]].append(temp)
                else:
                    pass
        else:
            logger.info("Invalid dataframe format.")
            return 0
    post.to_stream(utils.get_metadata("name", job, 0), utils.get_metadata("version", job, 0), formatted_payload)
    return 1

def get_frame_content(response_frame):
    # Valid response starts with "d"
    if response_frame["response"][0].lower() == "d":
        # frame that include a serial number starts with "-4". The data start 4 char further in the array
        if response_frame["response"][1] == "4":
            response_frame["response"] = response_frame["response"][22:]
        else:
            response_frame["response"] = response_frame["response"][14:]
    else:
        response_frame["response"] = ""
    return response_frame


def get_data_length(response_frame, communication_code):
    if communication_code == "ascii":
        return(hex_str_to_num(response_frame["response"][0:4],communication_code))
    elif communication_code == "binary":
        return(2 * hex_str_to_num(response_frame["response"][0:4],communication_code))


def get_end_code(response_frame, communication_code):
     return hex_str_to_num(response_frame["response"][4:8],communication_code)


def get_data(response_frame):
    return response_frame["response"][8:]


def decode_frame(communication_code, response_frame, decode_info):
    response_frame = get_frame_content(response_frame)
    if response_frame["response"] == "":
        return 0
    data_length = get_data_length(response_frame, communication_code)
    end_code = get_end_code(response_frame,communication_code)
    # valid response end code must be 0
    if end_code != 0:
        return 0
    data = get_data(response_frame)
    # response length must be equal to length of the function data plus the 4 characters of the end code
    if int(data_length) != ((len(data) + 4)):
        return 0
    decoded_data = {
        "timestamp": response_frame["timestamp"]
    }
    if "device_read" in list(decode_info.keys()):
        decoded_data["device_read"]= data
        return decoded_data
    elif "device_read_random" in list(decode_info.keys()):
        tag_words = decode_info["device_read_random"]["words"]
        tag_dwords = decode_info["device_read_random"]["dwords"]
        pointer = 0
        word_len = 4
        dword_len = 8
        for i in range (0, len(tag_words)):
            decoded_data[tag_words[i]] = data[pointer:pointer+word_len]
            pointer = pointer + word_len
        for i in range (0, len(tag_dwords)):
            decoded_data[tag_dwords[i]] = data[pointer:pointer+dword_len]
            pointer = pointer + dword_len
        return decoded_data
    elif "array_label_read" in list(decode_info.keys()):
        number_of_points = hex_str_to_num(data[0:4],communication_code)
        pointer = 4
        for i in range(0,number_of_points):
            data_type = data[pointer : pointer + 2]
            pointer = pointer + 2
            read_unit = data[pointer : pointer + 2]
            pointer = pointer + 2
            data_length = 2 * hex_str_to_num(data[pointer:pointer+4],communication_code)
            pointer = pointer + 4
            decoded_data[decode_info["array_label_read"][i]] = data[pointer : pointer + data_length]
            pointer = pointer + data_length
        return decoded_data
    elif "label_read_random" in list(decode_info.keys()):
        number_of_points = hex_str_to_num(data[0:4],communication_code)
        pointer = 4
        for i in range(0,number_of_points):
            data_type = data[pointer : pointer + 2]
            pointer = pointer + 2
            spare = data[pointer : pointer + 2]
            pointer = pointer + 2
            data_length = 2 * hex_str_to_num(data[pointer:pointer+4],communication_code)
            pointer = pointer + 4
            decoded_data[decode_info["label_read_random"][i]] = data[pointer : pointer + data_length]
            pointer = pointer + data_length
        return decoded_data

def reverse_numbering(hex_string):
    step_counter = len(hex_string)
    result = ""
    while step_counter > 0:
        result = result + hex_string[step_counter:step_counter+2]
        step_counter -= 2
    return result

def hex_str_to_num(hex_string, communication_code):
    if hex_string:
        if communication_code == "binary":
            hex_string = reverse_numbering("0x" + hex_string)
        elif communication_code == "ascii":
            pass
        else:
            return ""
        return int(hex_string,16)
    else:
        return ""
