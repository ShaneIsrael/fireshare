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

# Cache for NVENC availability check to avoid repeated subprocess calls
_nvenc_availability_cache = {}

def check_nvenc_available(encoder=None):
    """
    Check if NVENC (NVIDIA GPU encoding) is available.
    
    Args:
        encoder: Optional specific encoder to check ('h264_nvenc' or 'av1_nvenc').
                 If None, checks if any NVENC encoder is available.
    
    Returns:
        bool: True if the specified NVENC encoder (or any NVENC encoder) is available, False otherwise
    """
    cache_key = encoder or 'any_nvenc'
    
    # Return cached result if available
    if cache_key in _nvenc_availability_cache:
        return _nvenc_availability_cache[cache_key]
    
    try:
        # Try to get the list of encoders from ffmpeg
        result = sp.run(
            ['ffmpeg', '-hide_banner', '-encoders'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            if encoder:
                # Check for specific encoder
                available = encoder in result.stdout
            else:
                # Check if any NVENC encoder is available (h264_nvenc is the baseline)
                available = 'h264_nvenc' in result.stdout
            
            _nvenc_availability_cache[cache_key] = available
            return available
        
        _nvenc_availability_cache[cache_key] = False
        return False
    except Exception as ex:
        logger.debug(f"Could not check for NVENC availability: {ex}")
        _nvenc_availability_cache[cache_key] = False
        return False

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
    1. AV1 with GPU (av1_nvenc) - RTX 40 series or newer
    2. H.264 with GPU (h264_nvenc) - GTX 1050+ / Pascal or newer
    3. AV1 with CPU (libaom-av1) - Excellent compression
    4. H.264 with CPU (libx264) - Universal fallback
    
    Args:
        video_path: Path to the source video
        out_path: Path for the transcoded output
        height: Target height in pixels (e.g., 720, 1080)
        use_gpu: Whether to use GPU acceleration (NVENC if available)
    """
    s = time.time()
    
    # Determine output container based on codec
    out_path_str = str(out_path)
    
    # Check if GPU is requested but not available
    if use_gpu and not check_nvenc_available():
        logger.warning("GPU transcoding requested but NVENC not available")
        logger.warning("This typically means:")
        logger.warning("  1. NVIDIA drivers are not installed on the host")
        logger.warning("  2. NVIDIA Container Toolkit is not installed")
        logger.warning("  3. Docker is not configured with the nvidia runtime")
        logger.warning("  4. The GPU does not support NVENC")
        logger.warning("See: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html")
        logger.info("Falling back to CPU transcoding")
        use_gpu = False
    
    # Build ffmpeg command
    # Use 'error' level to see actual errors while keeping output clean
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path)]
    
    # Add GPU acceleration if enabled
    if use_gpu:
        # Try AV1 NVENC first (requires RTX 40 series or newer)
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
            # GPU AV1 NVENC failed - try H.264 NVENC (works on older GPUs)
            logger.warning(f"GPU AV1 NVENC transcoding failed (likely requires RTX 40 series+)")
            logger.info(f"Trying GPU H.264 NVENC (works on GTX 1050+/Pascal or newer)")
            cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
                   '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq:v', '23',
                   '-vf', f'scale=-2:{height}', '-c:a', 'aac', '-b:a', '128k', out_path_str]
            logger.debug(f"$: {' '.join(cmd)}")
            result = sp.call(cmd)
            if result != 0:
                # H.264 NVENC also failed, fall back to CPU AV1
                logger.warning(f"GPU H.264 NVENC also failed, falling back to CPU AV1")
                cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
                       '-c:v', 'libaom-av1', '-cpu-used', '4', '-crf', '30', '-b:v', '0',
                       '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str]
                logger.debug(f"$: {' '.join(cmd)}")
                result = sp.call(cmd)
                if result != 0:
                    # AV1 CPU encoding failed, fallback to H.264 CPU as last resort
                    logger.warning(f"CPU AV1 encoding failed, falling back to CPU H.264")
                    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                           '-vf', f'scale=-2:{height}', '-c:a', 'aac', '-b:a', '128k', out_path_str]
                    logger.debug(f"$: {' '.join(cmd)}")
                    sp.call(cmd)
    except Exception as ex:
        logger.error(f"Error transcoding video: {ex}")
        if use_gpu:
            # Try H.264 NVENC fallback on exception
            logger.warning(f"GPU AV1 transcoding encountered error, trying GPU H.264 NVENC")
            try:
                cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
                       '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq:v', '23',
                       '-vf', f'scale=-2:{height}', '-c:a', 'aac', '-b:a', '128k', out_path_str]
                logger.debug(f"$: {' '.join(cmd)}")
                result = sp.call(cmd)
                if result != 0:
                    # Try CPU AV1
                    logger.warning(f"GPU H.264 NVENC failed, falling back to CPU AV1")
                    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
                           '-c:v', 'libaom-av1', '-cpu-used', '4', '-crf', '30', '-b:v', '0',
                           '-vf', f'scale=-2:{height}', '-c:a', 'libopus', '-b:a', '96k', out_path_str]
                    logger.debug(f"$: {' '.join(cmd)}")
                    result = sp.call(cmd)
                    if result != 0:
                        # Final fallback to H.264 CPU
                        logger.warning(f"CPU AV1 encoding failed, falling back to CPU H.264")
                        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path),
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