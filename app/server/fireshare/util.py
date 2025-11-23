import os
from pathlib import Path
import json
import subprocess as sp
import xxhash
from fireshare import logger
import time
import glob

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

# Cache for the working encoder to avoid trying failed encoders repeatedly
# Format: {'gpu': encoder_dict, 'cpu': encoder_dict}
# where encoder_dict contains 'name', 'video_codec', 'audio_codec', 'extra_args'
_working_encoder_cache = {'gpu': None, 'cpu': None}

def clear_nvenc_cache():
    """Clear the NVENC availability cache to force a re-check."""
    global _nvenc_availability_cache
    _nvenc_availability_cache = {}

def clear_encoder_cache():
    """Clear the working encoder cache to force encoder re-detection."""
    global _working_encoder_cache
    _working_encoder_cache = {'gpu': None, 'cpu': None}
    logger.info("Encoder cache cleared - will re-detect working encoders on next transcode")

def diagnose_nvenc_setup():
    """
    Diagnose NVENC setup issues and log helpful information.
    Returns diagnostic information about the NVENC setup.
    """
    diagnostics = {
        'nvidia_smi_available': False,
        'libnvidia_encode_found': False,
        'library_paths': [],
        'ffmpeg_has_nvenc': False
    }
    
    # Check if nvidia-smi is available
    try:
        result = sp.run(['nvidia-smi'], capture_output=True, timeout=5)
        diagnostics['nvidia_smi_available'] = result.returncode == 0
        if result.returncode == 0:
            logger.debug("nvidia-smi is available - GPU is accessible")
    except Exception:
        logger.debug("nvidia-smi not available")
    
    # Check for libnvidia-encode.so.1
    search_paths = [
        '/usr/lib/x86_64-linux-gnu',
        '/usr/lib64',
        '/usr/local/nvidia/lib',
        '/usr/local/nvidia/lib64',
        '/usr/lib',
    ]
    
    for path in search_paths:
        matches = glob.glob(f"{path}/*nvidia-encode*.so*")
        if matches:
            diagnostics['libnvidia_encode_found'] = True
            diagnostics['library_paths'].extend(matches)
    
    # Check current LD_LIBRARY_PATH
    ld_path = os.environ.get('LD_LIBRARY_PATH', '')
    logger.debug(f"LD_LIBRARY_PATH: {ld_path}")
    
    # Check if ffmpeg has nvenc
    try:
        result = sp.run(
            ['ffmpeg', '-hide_banner', '-encoders'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            diagnostics['ffmpeg_has_nvenc'] = 'h264_nvenc' in result.stdout
    except Exception:
        pass
    
    return diagnostics

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

def _get_encoder_candidates(use_gpu=False):
    """
    Get the list of encoder configurations to try in priority order.
    
    Args:
        use_gpu: Whether to include GPU encoders in the list
    
    Returns:
        list: List of encoder configurations to try in order
    """
    # CPU encoder configurations (shared between GPU and CPU modes)
    cpu_encoders = [
        {
            'name': 'AV1 CPU',
            'video_codec': 'libaom-av1',
            'audio_codec': 'libopus',
            'audio_bitrate': '96k',
            'extra_args': ['-cpu-used', '4', '-crf', '30', '-b:v', '0']
        },
        {
            'name': 'H.264 CPU',
            'video_codec': 'libx264',
            'audio_codec': 'aac',
            'audio_bitrate': '128k',
            'extra_args': ['-preset', 'medium', '-crf', '23']
        }
    ]
    
    # Define encoder configurations to try in order
    if use_gpu:
        # GPU mode: try GPU encoders first, then fall back to CPU encoders
        gpu_encoders = [
            {
                'name': 'AV1 NVENC',
                'video_codec': 'av1_nvenc',
                'audio_codec': 'libopus',
                'audio_bitrate': '96k',
                'extra_args': ['-preset', 'p4', '-cq:v', '30']
            },
            {
                'name': 'H.264 NVENC',
                'video_codec': 'h264_nvenc',
                'audio_codec': 'aac',
                'audio_bitrate': '128k',
                'extra_args': ['-preset', 'p4', '-cq:v', '23']
            }
        ]
        return gpu_encoders + cpu_encoders
    else:
        # CPU mode: only try CPU encoders
        return cpu_encoders

def _build_transcode_command(video_path, out_path, height, encoder):
    """
    Build an ffmpeg command for transcoding with the given encoder.
    
    Args:
        video_path: Path to the source video
        out_path: Path for the transcoded output
        height: Target height in pixels
        encoder: Encoder configuration dict
    
    Returns:
        list: ffmpeg command as a list of arguments
    """
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(video_path)]
    cmd.extend(['-c:v', encoder['video_codec']])
    
    if 'extra_args' in encoder:
        cmd.extend(encoder['extra_args'])
    
    cmd.extend(['-vf', f'scale=-2:{height}'])
    cmd.extend(['-c:a', encoder['audio_codec'], '-b:a', encoder.get('audio_bitrate', '128k')])
    cmd.append(str(out_path))
    
    return cmd

def transcode_video_quality(video_path, out_path, height, use_gpu=False, timeout_seconds=3600):
    """
    Transcode a video to a specific height (e.g., 720, 1080) while maintaining aspect ratio.
    
    Tries encoders in priority order during actual transcoding, then caches the first
    successful encoder for all subsequent transcodes until the application is restarted.
    
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
        timeout_seconds: Maximum time allowed for encoding (default: 3600 seconds/1 hour)
    
    Returns:
        bool: True if transcoding succeeded, False if all encoders failed
    """
    global _working_encoder_cache
    s = time.time()
    
    # Determine output container based on codec
    out_path_str = str(out_path)
    
    mode = 'gpu' if use_gpu else 'cpu'
    
    # Use cached encoder if available to avoid redundant encoder detection during bulk transcoding.
    if _working_encoder_cache[mode] is not None:
        encoder = _working_encoder_cache[mode]
        logger.debug(f"Using cached {mode.upper()} encoder: {encoder['name']}")
        
        # Build ffmpeg command using the cached encoder
        logger.info(f"Transcoding video to {height}p using {encoder['name']}")
        cmd = _build_transcode_command(video_path, out_path, height, encoder)
        
        logger.debug(f"$: {' '.join(cmd)}")
        
        try:
            result = sp.run(cmd, timeout=timeout_seconds)
            if result.returncode == 0:
                e = time.time()
                logger.info(f'Transcoded {str(out_path)} to {height}p in {e-s:.2f}s')
                return True
            else:
                # Cached encoder failed - clear cache and fall through to try all encoders
                logger.warning(f"Cached encoder {encoder['name']} failed with exit code {result.returncode}")
                logger.info("Clearing encoder cache and retrying with all available encoders...")
                _working_encoder_cache[mode] = None
        except sp.TimeoutExpired:
            logger.warning(f"Cached encoder {encoder['name']} timed out after {timeout_seconds} seconds")
            logger.info("Clearing encoder cache and retrying with all available encoders...")
            _working_encoder_cache[mode] = None
            # Clean up the process and any partial output
            if os.path.exists(out_path_str):
                try:
                    os.remove(out_path_str)
                    logger.debug(f"Cleaned up timed out output file: {out_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up timed out output: {cleanup_ex}")
        except Exception as ex:
            # Cached encoder failed - clear cache and fall through to try all encoders
            logger.warning(f"Cached encoder {encoder['name']} failed: {ex}")
            logger.info("Clearing encoder cache and retrying with all available encoders...")
            _working_encoder_cache[mode] = None
    
    # No cached encoder - need to detect a working encoder
    # Check if GPU is requested but NVENC is not available in ffmpeg
    if use_gpu and not check_nvenc_available():
        logger.warning("GPU transcoding requested but NVENC not available in ffmpeg")
        
        # Run diagnostics to help user understand the issue
        diag = diagnose_nvenc_setup()
        
        if diag['nvidia_smi_available']:
            logger.warning("✓ GPU is accessible (nvidia-smi works)")
            logger.warning("✗ But NVENC encoder is not available to ffmpeg")
            logger.warning("")
            
            # Try to automatically fix the library path issue
            if diag['libnvidia_encode_found'] and diag['library_paths'] and len(diag['library_paths']) > 0:
                library_dir = str(Path(diag['library_paths'][0]).parent)
                current_ld_path = os.environ.get('LD_LIBRARY_PATH', '')
                current_paths = current_ld_path.split(':') if current_ld_path else []
                
                # Add the library directory to LD_LIBRARY_PATH if not already present
                if library_dir not in current_paths:
                    new_ld_path = f"{library_dir}:{current_ld_path}" if current_ld_path else library_dir
                    os.environ['LD_LIBRARY_PATH'] = new_ld_path
                    logger.info(f"Automatically added {library_dir} to LD_LIBRARY_PATH")
                    
                    # Clear the cache and retry the check
                    clear_nvenc_cache()
                    
                    if check_nvenc_available():
                        logger.info("✓ NVENC is now available! Continuing with GPU transcoding")
                        # Don't set use_gpu to False, let it continue
                    else:
                        logger.warning("✗ NVENC still not available after adding library path")
                        logger.warning("Common causes on Unraid/Docker:")
                        logger.warning("  1. NVIDIA driver libraries not mounted in container")
                        logger.warning("     Solution: Add to docker run or docker-compose:")
                        logger.warning("       --gpus all")
                        logger.warning("       or")
                        logger.warning("       runtime: nvidia")
                        logger.warning("")
                        logger.warning("  2. FFmpeg not compiled with NVENC support")
                        logger.warning("     (This shouldn't happen with the official image)")
                        logger.warning("")
                        logger.warning("See: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html")
                        logger.info("Will attempt GPU transcoding anyway and fall back to CPU if needed")
                else:
                    logger.warning(f"Library found at: {diag['library_paths'][0]}")
                    logger.warning(f"But {library_dir} is already in LD_LIBRARY_PATH")
                    logger.warning("Common causes on Unraid/Docker:")
                    logger.warning("  1. NVIDIA driver libraries not mounted in container")
                    logger.warning("     Solution: Add to docker run or docker-compose:")
                    logger.warning("       --gpus all")
                    logger.warning("       or")
                    logger.warning("       runtime: nvidia")
                    logger.warning("")
                    logger.warning("  2. FFmpeg not compiled with NVENC support")
                    logger.warning("     (This shouldn't happen with the official image)")
                    logger.warning("")
                    logger.warning("See: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html")
                    logger.info("Will attempt GPU transcoding anyway and fall back to CPU if needed")
            else:
                logger.warning("Common causes on Unraid/Docker:")
                logger.warning("  1. NVIDIA driver libraries not mounted in container")
                logger.warning("     Solution: Add to docker run or docker-compose:")
                logger.warning("       --gpus all")
                logger.warning("       or")
                logger.warning("       runtime: nvidia")
                logger.warning("")
                logger.warning("  2. Missing libnvidia-encode.so.1 library")
                logger.warning("     ✗ Library not found in standard paths")
                logger.warning("     Ensure NVIDIA Container Toolkit is installed on host")
                logger.warning("")
                logger.warning("See: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html")
                logger.info("Will attempt GPU transcoding anyway and fall back to CPU if needed")
        else:
            logger.warning("Common causes:")
            logger.warning("  1. NVIDIA drivers are not installed on the host")
            logger.warning("  2. NVIDIA Container Toolkit is not installed")
            logger.warning("  3. Docker is not configured with the nvidia runtime")
            logger.warning("  4. The GPU does not support NVENC")
            logger.warning("")
            logger.warning("See: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html")
            logger.info("Will attempt GPU transcoding anyway and fall back to CPU if needed")
    
    # Try encoders in priority order with actual transcoding
    # When use_gpu=True, the candidate list includes GPU encoders first, then CPU encoders
    # as fallback, so CPU transcoding will be attempted automatically if GPU fails
    logger.info(f"Detecting working {mode.upper()} encoder by attempting transcode...")
    encoders = _get_encoder_candidates(use_gpu)
    
    last_exception = None
    for encoder in encoders:
        logger.info(f"Trying {encoder['name']}...")
        
        # Build ffmpeg command
        cmd = _build_transcode_command(video_path, out_path, height, encoder)
        
        logger.debug(f"$: {' '.join(cmd)}")
        
        try:
            result = sp.run(cmd, timeout=timeout_seconds)
            if result.returncode == 0:
                # Success! Cache this encoder and return
                logger.info(f"✓ {encoder['name']} works! Using it for all transcodes this session.")
                _working_encoder_cache[mode] = encoder
                e = time.time()
                logger.info(f'Transcoded {str(out_path)} to {height}p in {e-s:.2f}s')
                return True
            else:
                logger.warning(f"✗ {encoder['name']} failed with exit code {result.returncode}")
                last_exception = Exception(f"Transcode failed with exit code {result.returncode}")
                # Clean up failed output file before trying next encoder
                if os.path.exists(out_path_str):
                    try:
                        os.remove(out_path_str)
                        logger.debug(f"Cleaned up failed output file: {out_path_str}")
                    except OSError as cleanup_ex:
                        logger.debug(f"Could not clean up failed output: {cleanup_ex}")
        except sp.TimeoutExpired:
            logger.warning(f"✗ {encoder['name']} timed out after {timeout_seconds} seconds")
            last_exception = Exception(f"Transcode timed out after {timeout_seconds} seconds")
            # Clean up failed output file before trying next encoder
            if os.path.exists(out_path_str):
                try:
                    os.remove(out_path_str)
                    logger.debug(f"Cleaned up timed out output file: {out_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up timed out output: {cleanup_ex}")
        except Exception as ex:
            logger.warning(f"✗ {encoder['name']} failed: {ex}")
            last_exception = ex
            # Clean up failed output file before trying next encoder
            if os.path.exists(out_path_str):
                try:
                    os.remove(out_path_str)
                    logger.debug(f"Cleaned up failed output file: {out_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up failed output: {cleanup_ex}")
    
    # If we get here, no encoder worked
    error_msg = f"No working {mode.upper()} encoder found for video. Tried: {', '.join([e['name'] for e in encoders])}"
    logger.error(error_msg)
    if last_exception:
        logger.error(f"Last error was: {last_exception}")
    
    # Return False to indicate failure instead of raising exception
    # This allows the calling code to continue processing other videos
    return False

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
    logger.info(f"Creating boomerang preview")
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