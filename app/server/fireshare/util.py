from pathlib import Path
import math
import os
import json
import logging
import subprocess as sp
import time
from hashlib import md5
from binascii import b2a_hex
import xxhash

def video_id(path: Path, mb=16):
    """
    Calculates the id of a video by using xxhash on the first 16mb (or the whole file if it's less than that)
    """
    with path.open('rb', 0) as f:
        file_header = f.read(int(1024*1024*mb))
    return xxhash.xxh64_hexdigest(file_header)
