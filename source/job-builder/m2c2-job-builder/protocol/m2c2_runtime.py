## Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
## SPDX-License-Identifier: Apache-2.0

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get(protocol):
    if protocol == "slmp":
        return "python3.7"
    elif protocol == "opcda":
        return "python2.7"
    # add runtime details for new protocol
    return 0