# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

class HistorianMessage:

    def __init__(self, source_id: str, collector_id: str, measurement_id: str, timestamp: str, value: any, quality: str):
        self.sourceId = source_id
        self.collectorId = collector_id
        self.measurementId = measurement_id
        self.measureName = measurement_id
        self.timestamp = timestamp
        self.value = value
        self.measureQuality = quality
