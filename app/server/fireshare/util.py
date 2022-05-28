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
    return xxhash.xxh3_128_hexdigest(file_header)

def get_media_info(path):
    try:
        args = {'path': path}
        # run this without the fields after stream to see all fields
        cmd = 'ffprobe -v quiet -print_format json -show_entries stream {path}'.format(**args)
        print('Executing {cmd}'.format(**vars()))
        data = json.loads(sp.check_output(cmd.split()).decode('utf-8'))
        return data['streams']
    except Exception as ex:
        print('Could not extract video info', ex)
        return None

def create_poster(video_path, out_path):
    sp.call(['ffmpeg', '-v', 'quiet' '-i', video_path, '-ss', '00:00:00.000', '-vframes', '1', out_path])

def dur_string_to_seconds(dur: str) -> float:
    if type(dur) == int: return float(dur)
    num_parts = len(dur.split(':'))
    if num_parts == 1:
        return int(dur)
    elif num_parts == 2:
        m, s = dur.split(':')
        m, s = int(m), int(s)
        return s + m*60
    elif num_parts == 3:
        h, m, s = dur.split(':')
        h, m, s = int(h), int(m), int(s.split('.')[0])
        return s + m*60 + h*60*60
    else:
        print(f'Could not parse duration in to total seconds from {dur}')
        return None