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
    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path), '-ss', str(second), '-vframes', '1', '-vf', 'scale=iw:ih:force_original_aspect_ratio=decrease', str(out_path)]
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

def transcode_video_quality(video_path, out_path, height, use_gpu=False):
    """
    Transcode a video to a specific height (e.g., 720, 1080) while maintaining aspect ratio.
    
    Fallback chain when GPU is enabled:
    1. AV1 with GPU (av1_nvenc) - RTX 40 series+
    2. VP9/WebM with GPU (vp9_nvenc) - GTX 1050+
    3. AV1 with CPU (libaom-av1)
    4. H.264 with CPU (libx264)
    
    Args:
        video_path: Path to the source video
        out_path: Path for the transcoded output
        height: Target height in pixels (e.g., 720, 1080)
        use_gpu: Whether to use GPU acceleration (NVENC if available)
    """
    s = time.time()
    
    # Determine output container based on codec
    out_path_str = str(out_path)
    
    # Build ffmpeg command
    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path)]
    
    # Add GPU acceleration if enabled
    if use_gpu:
        # Try AV1 NVENC first (av1_nvenc)
        # Note: av1_nvenc requires newer NVIDIA GPUs (RTX 40 series+)
        logger.info(f"Transcoding video to {height}p using GPU AV1 (NVENC)")
        cmd.extend(['-c:v', 'av1_nvenc', '-preset', 'p4', '-cq:v', '30'])
        cmd.extend(['-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str])
    else:
        # Use libaom-av1 for CPU encoding with reasonable settings
        logger.info(f"Transcoding video to {height}p using CPU AV1")
        cmd.extend(['-c:v', 'libaom-av1', '-cpu-used', '4', '-crf', '30', '-b:v', '0'])
        cmd.extend(['-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str])
    
    logger.debug(f"$: {' '.join(cmd)}")
    
    try:
        result = sp.call(cmd)
        if result != 0 and use_gpu:
            # GPU AV1 failed, try VP9/WebM with GPU (widely supported format)
            logger.warning(f"GPU AV1 transcoding failed, trying VP9/WebM with GPU")
            # Change output to .webm for VP9
            webm_path = out_path_str.replace('.mp4', '.webm')
            cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                   '-c:v', 'vp9_nvenc', '-preset', 'p4', '-cq:v', '30',
                   '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', webm_path]
            logger.debug(f"$: {' '.join(cmd)}")
            result = sp.call(cmd)
            
            if result == 0:
                # VP9 GPU encoding succeeded, rename to final output
                import shutil
                shutil.move(webm_path, out_path_str)
                logger.info(f"Successfully transcoded with VP9/WebM using GPU")
            else:
                # VP9 GPU failed, fallback to CPU AV1
                logger.warning(f"GPU VP9 transcoding failed, falling back to CPU AV1")
                cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                       '-c:v', 'libaom-av1', '-cpu-used', '4', '-crf', '30', '-b:v', '0',
                       '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str]
                logger.debug(f"$: {' '.join(cmd)}")
                result = sp.call(cmd)
                if result != 0:
                    # AV1 CPU encoding failed, fallback to H.264 as last resort
                    logger.warning(f"CPU AV1 encoding failed, falling back to H.264")
                    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                           '-vf', f'scale=-2:{height}', '-c:a', 'aac', '-b:a', '128k', out_path_str]
                    logger.debug(f"$: {' '.join(cmd)}")
                    sp.call(cmd)
    except Exception as ex:
        logger.error(f"Error transcoding video: {ex}")
        if use_gpu:
            # Try VP9/WebM with GPU on exception
            logger.warning(f"GPU transcoding encountered error, trying VP9/WebM with GPU")
            try:
                webm_path = out_path_str.replace('.mp4', '.webm')
                cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                       '-c:v', 'vp9_nvenc', '-preset', 'p4', '-cq:v', '30',
                       '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', webm_path]
                logger.debug(f"$: {' '.join(cmd)}")
                result = sp.call(cmd)
                
                if result == 0:
                    import shutil
                    shutil.move(webm_path, out_path_str)
                    logger.info(f"Successfully transcoded with VP9/WebM using GPU after error")
                else:
                    # VP9 GPU failed, try CPU AV1
                    logger.warning(f"GPU VP9 failed, falling back to CPU AV1")
                    cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                           '-c:v', 'libaom-av1', '-cpu-used', '4', '-crf', '30', '-b:v', '0',
                           '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str]
                    logger.debug(f"$: {' '.join(cmd)}")
                    result = sp.call(cmd)
                    if result != 0:
                        # Final fallback to H.264
                        logger.warning(f"CPU AV1 encoding failed, falling back to H.264")
                        cmd = ['ffmpeg', '-v', 'quiet', '-y', '-i', str(video_path),
                               '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                               '-vf', f'scale=-2:{height}', '-c:a', 'aac', '-b:a', '128k', out_path_str]
                        logger.debug(f"$: {' '.join(cmd)}")
                        sp.call(cmd)
            except Exception:
                raise
        else:
            raise
    
    e = time.time()
    logger.info(f'Transcoded {str(out_path)} to {height}p in {e-s:.2f}s')

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