# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0


class OPCDAMsgValidations:
    def __init__(self):
        """
        This class establishes the expected configuration and validation
         of types used by the OPC DA collector and
         expected format for the publisher.
        """
        pass

    def payload_required_keys(self) -> list:
        return ["alias", "messages"]

    def messages_required_keys(self) -> list:
        return ["name", "timestamp", "value", "quality"]

    def payload_validations(self) -> dict:
        return {
            "alias": lambda x: isinstance(x, str),
            "messages": lambda x: isinstance(x, list)
        }

    def quality_validations(self) -> list:
        return [
            'Good',
            'GOOD',
            'Bad',
            'BAD',
            'Uncertain',
            'UNCERTAIN'
        ]

    def msgs_validations(self) -> dict:
        return {
            "name": lambda x: isinstance(x, str),
            "timestamp": lambda x: isinstance(x, str),
            "value": lambda x: x,
            "quality": lambda x: isinstance(x, str) and x in self.quality_validations()
        }
