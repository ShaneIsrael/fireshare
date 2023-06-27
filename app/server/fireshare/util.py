import os
from pathlib import Path
import json
import subprocess as sp
import xxhash
from fireshare import logger
import time

def lock_exists(path: Path):
    """
    Checks if a lockfile currently exists
    """
    lockfile = path / "fireshare.lock"
    return lockfile.exists()

def create_lock(path: Path):
    """
    Creates the lock file
    """
    lockfile = path / "fireshare.lock"
    if not lockfile.exists():
        logger.debug(f"A lockfile has been created at {str(lockfile)}")
        fp = open(lockfile, 'x')
        fp.close()

def remove_lock(path: Path):
    """
    Deletes the lock file
    """
    lockfile = path / "fireshare.lock"
    if lockfile.exists():
        logger.debug(f"A lockfile has been removed at {str(lockfile)}")
        os.remove(lockfile)

def video_id(path: Path, mb=16):
    """
    Calculates the id of a video by using xxhash on the first 16mb (or the whole file if it's less than that)
    """
    with path.open('rb', 0) as f:
        file_header = f.read(int(1024*1024*mb))
    return xxhash.xxh3_128_hexdigest(file_header)

def get_media_info(path):
    try:
        cmd = f'ffprobe -v quiet -print_format json -show_entries stream {path}'
        logger.debug(f"$ {cmd}")
        data = json.loads(sp.check_output(cmd.split()).decode('utf-8'))
        return data['streams']
    except Exception as ex:
        logger.warning('Could not extract video info')
        return None

def create_poster(video_path, out_path, second=0):
    s = time.time()
    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path), '-ss', str(second), '-vframes', '1', str(out_path)]
    logger.debug(f"$ {' '.join(cmd)}")
    sp.call(cmd)
    e = time.time()
    logger.info(f'Generated poster {str(out_path)} in {e-s}s')

def transcode_video(video_path, out_path):
    s = time.time()
    logger.info(f"Transcoding video")
    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path), '-c:v', 'libx264', '-c:a', 'aac', str(out_path)]
    logger.debug(f"$: {' '.join(cmd)}")
    sp.call(cmd)
    e = time.time()
    logger.info(f'Transcoded {str(out_path)} in {e-s}s')

def create_boomerang_preview(video_path, out_path, clip_duration=1.5):
    # https://stackoverflow.com/questions/65874316/trim-a-video-and-add-the-boomerang-effect-on-it-with-ffmpeg
    # https://ffmpeg.org/ffmpeg-filters.html#reverse
    # https://ffmpeg.org/ffmpeg-filters.html#Examples-148
    # ffmpeg -ss 0 -t 1.5 -i in.mp4 -y -filter_complex "[0]split[a][b];[b]reverse[a_rev];[a][a_rev]concat[clip];[clip]scale=-1:720" -an out.mp4
    s = time.time()
    boomerang_filter_720p = '[0]split[a][b];[b]reverse[a_rev];[a][a_rev]concat[clip];[clip]scale=-1:720'
    boomerang_filter_480p = '[0]split[a][b];[b]reverse[a_rev];[a][a_rev]concat[clip];[clip]scale=-1:480'
    boomerang_filter = '[0]split[a][b];[b]reverse[a_rev];[a][a_rev]concat'
    cmd = ['ffmpeg', '-v', 'quiet', '-ss', '0', '-t', str(clip_duration),
        '-i', str(video_path), '-y', '-filter_complex', boomerang_filter_480p, '-an', str(out_path)]
    logger.info(f"Creating boomering preview")
    logger.debug(f"$: {' '.join(cmd)}")
    sp.call(cmd)
    e = time.time()
    logger.info(f'Generated boomerang preview {str(out_path)} in {e-s}s')

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
        logger.warn(f'Could not parse duration in to total seconds from {dur}')
        return None

def seconds_to_dur_string(sec):
    sec = int(round(sec))
    hours = sec // 60 // 60
    mins = (sec - hours*60*60) // 60
    s = (sec-hours*60*60-mins*60) % 60
    if hours:
        return ':'.join([str(hours), str(mins).zfill(2), str(s).zfill(2)])
    else:
        return ':'.join([str(mins), str(s).zfill(2)])