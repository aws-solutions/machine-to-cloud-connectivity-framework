# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from dataclasses import dataclass


@dataclass
class PiResponse:

    path: str
    name: str
    records: 'list[dict]'
