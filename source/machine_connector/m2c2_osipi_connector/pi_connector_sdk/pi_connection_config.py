# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from dataclasses import dataclass, field
from typing import Union


@dataclass
class PiAuthParam():

    def __init__(self):
        self.username: Union[str, None] = None
        self.password: Union[str, None] = None


@dataclass
class PiServerConnection:
    api_url: Union[str, None] = None
    server_name: Union[str, None] = None
    auth_mode: Union[str, None] = None
    verify_ssl: bool = True
<<<<<<< HEAD
    auth_param: PiAuthParam = PiAuthParam()
=======
    auth_param: PiAuthParam = field(default_factory=PiAuthParam)
>>>>>>> main


@dataclass
class PiQueryConfig():
    tag_names: 'list[str]' = field(default_factory=list)
    req_frequency_sec: float = 5
    catchup_req_frequency_sec: float = 0.1
    max_req_duration_sec: float = 60  # Might need to tweak based on data volume
    query_offset_from_now_sec: float = 0


@dataclass
class LocalStorageConfig():

    storage_directory: Union[str, None] = None
    enabled: bool = False


@dataclass
class PiConnectionConfig:

<<<<<<< HEAD
    server_connection: PiServerConnection = PiServerConnection()
    query_config: PiQueryConfig = PiQueryConfig()
    local_storage_config: LocalStorageConfig = LocalStorageConfig()
=======
    server_connection: PiServerConnection = field(
        default_factory=PiServerConnection)
    query_config: PiQueryConfig = field(default_factory=PiQueryConfig)
    local_storage_config: LocalStorageConfig = field(
        default_factory=LocalStorageConfig)
>>>>>>> main
    log_level: str = "INFO"
    time_log_file: str = './data/timelog.txt'  # TODO: MAKE DYNAMIC?
