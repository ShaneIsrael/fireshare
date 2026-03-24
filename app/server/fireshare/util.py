import os
from pathlib import Path
import json
import subprocess as sp
import xxhash
from fireshare import logger
import time
import glob
import shutil
import re
import threading
from datetime import datetime

# Corruption indicators to detect during video validation
# These are ffmpeg error messages that indicate file corruption
VIDEO_CORRUPTION_INDICATORS = [
    "Corrupt frame detected",
    "No sequence header",
    "Error submitting packet to decoder",
    "Invalid data found when processing input",
    "Decode error rate",
    "moov atom not found",
    "Invalid NAL unit size",
    "non-existing PPS",
    "Could not find codec parameters",
]

# Corruption indicators that are known false positives for AV1 files
# These warnings can occur during initial frame decoding of valid AV1 files
# and should be ignored if the decode test succeeds (returncode 0)
# Note: Values are lowercase for consistent case-insensitive matching
AV1_FALSE_POSITIVE_INDICATORS = frozenset([
    "corrupt frame detected",
    "no sequence header",
    "error submitting packet to decoder",
    "decode error rate",
    "invalid nal unit size",
    "non-existing pps",
])

# Known AV1 codec names as reported by ffprobe (lowercase for matching)
# These are used to detect AV1-encoded source files for special handling
AV1_CODEC_NAMES = frozenset([
    'av1',
    'libaom-av1',
    'libsvtav1',
    'av1_nvenc',
    'av1_qsv',
])

def lock_exists(path: Path):
    """
    Checks if a lockfile exists and the owning process is still alive.
    Automatically removes stale locks left by crashed processes.
    """
    lockfile = path / "fireshare.lock"
    if not lockfile.exists():
        return False
    try:
        with open(lockfile, 'r') as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)  # signal 0 just checks liveness, sends nothing
        return True
    except (ValueError, ProcessLookupError, OSError):
        logger.debug(f"Removing stale lockfile at {str(lockfile)}")
        try:
            os.remove(lockfile)
        except Exception:
            pass
        return False

def create_lock(path: Path):
    """
    Creates the lock file, writing the current PID so stale locks can be detected.
    """
    lockfile = path / "fireshare.lock"
    if not lockfile.exists():
        logger.debug(f"A lockfile has been created at {str(lockfile)}")
        with open(lockfile, 'w') as f:
            f.write(str(os.getpid()))

def remove_lock(path: Path):
    """
    Deletes the lock file
    """
    lockfile = path / "fireshare.lock"
    if lockfile.exists():
        logger.debug(f"A lockfile has been removed at {str(lockfile)}")
        os.remove(lockfile)


# Transcoding status file functions
TRANSCODING_STATUS_FILE = "transcoding_status.json"

def write_transcoding_status(data_path: Path, current: int, total: int, current_video: str = None, pid: int = None, percent: float = None, eta_seconds: float = None, resolution: str = None):
    """
    Writes the current transcoding progress to a status file.
    Called by the CLI during transcoding to report progress.
    If pid is provided, it will be included. Otherwise, uses the current process PID.
    percent and eta_seconds are optional per-video progress info from ffmpeg.
    resolution is the target resolution (e.g., "1080p").
    """
    status_file = data_path / TRANSCODING_STATUS_FILE

    # Always include a concrete PID for liveness checks in SSE/API consumers.
    # CLI calls omit pid, so stamp the current process PID in that case.
    if pid is None:
        pid = os.getpid()

    status = {
        "is_running": True,
        "current": current,
        "total": total,
        "current_video": current_video,
        "pid": pid
    }
    # Include progress data if available
    if percent is not None:
        status["percent"] = round(percent, 1)
    if eta_seconds is not None:
        status["eta_seconds"] = round(eta_seconds)
    if resolution is not None:
        status["resolution"] = resolution
    tmp_file = status_file.with_suffix(f"{status_file.suffix}.tmp")
    try:
        with open(tmp_file, 'w') as f:
            json.dump(status, f)
        # Atomic replace prevents readers from seeing partial JSON.
        os.replace(tmp_file, status_file)
    except Exception as e:
        logger.warning(f"Failed to write transcoding status: {e}")
        try:
            if tmp_file.exists():
                os.remove(tmp_file)
        except Exception:
            pass

def read_transcoding_status(data_path: Path) -> dict:
    """
    Reads the current transcoding progress from the status file.
    Returns default values if file doesn't exist or is invalid.
    """
    status_file = data_path / TRANSCODING_STATUS_FILE
    default_status = {"is_running": False, "current": 0, "total": 0, "current_video": None, "pid": None}

    if not status_file.exists():
        return default_status

    try:
        with open(status_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to read transcoding status: {e}")
        return default_status

def clear_transcoding_status(data_path: Path):
    """
    Removes the transcoding status file when transcoding completes or is cancelled.
    """
    status_file = data_path / TRANSCODING_STATUS_FILE
    if status_file.exists():
        try:
            os.remove(status_file)
        except Exception as e:
            logger.warning(f"Failed to remove transcoding status file: {e}")


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

def get_video_duration(path):
    """
    Get the duration of a video file in seconds.
    
    Args:
        path: Path to the video file
    
    Returns:
        float: Duration in seconds, or None if unable to determine
    """
    try:
        cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_entries', 'format=duration', str(path)]
        logger.debug(f"$ {' '.join(cmd)}")
        data = json.loads(sp.check_output(cmd).decode('utf-8'))
        if 'format' in data and 'duration' in data['format']:
            return float(data['format']['duration'])
    except Exception as ex:
        logger.debug(f'Could not extract video duration: {ex}')
    return None

def validate_video_file(path, timeout=30):
    """
    Validate that a video file is not corrupt and can be decoded.
    
    This function performs a quick decode test on the first few seconds of the video
    to detect corruption issues like missing sequence headers, corrupt frames, etc.
    
    For AV1 files, validation is more lenient as some AV1 encoders produce files
    that generate warnings during initial frame decoding but play back correctly.
    
    Args:
        path: Path to the video file
        timeout: Maximum time in seconds to wait for validation (default: 30)
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
            - (True, None) if the video is valid
            - (False, error_message) if the video is corrupt or unreadable
    """
    # Check if ffprobe and ffmpeg are available using shutil.which
    if not shutil.which('ffprobe'):
        return False, "ffprobe command not found - ensure ffmpeg is installed"
    if not shutil.which('ffmpeg'):
        return False, "ffmpeg command not found - ensure ffmpeg is installed"
    
    try:
        # First, check if ffprobe can read the stream information
        probe_cmd = [
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,width,height',
            '-of', 'json', str(path)
        ]
        logger.debug(f"Validating video file: {' '.join(probe_cmd)}")
        
        probe_result = sp.run(probe_cmd, capture_output=True, text=True, timeout=timeout)
        
        if probe_result.returncode != 0:
            error_msg = probe_result.stderr.strip() if probe_result.stderr else "Unknown error reading video metadata"
            return False, f"ffprobe failed: {error_msg}"
        
        # Check if we got valid stream data
        # Note: -select_streams v:0 in probe_cmd ensures only video streams are returned
        try:
            probe_data = json.loads(probe_result.stdout)
            streams = probe_data.get('streams', [])
            if not streams:
                return False, "No video streams found in file"
        except json.JSONDecodeError:
            return False, "Failed to parse video metadata"
        
        # Get the codec name from the video stream
        # Safe to access streams[0] because we checked for empty streams above
        video_stream = streams[0]
        codec_name = video_stream.get('codec_name', '').lower()
        
        # Detect if the source file is AV1-encoded
        # AV1 files may produce false positive corruption warnings during initial frame decoding
        is_av1_source = codec_name in AV1_CODEC_NAMES
        
        # Now perform a quick decode test by decoding the first 2 seconds
        # This catches issues like "No sequence header" or "Corrupt frame detected"
        decode_cmd = [
            'ffmpeg', '-v', 'error', '-t', '2',
            '-i', str(path), '-f', 'null', '-'
        ]
        logger.debug(f"Decode test: {' '.join(decode_cmd)}")
        
        decode_result = sp.run(decode_cmd, capture_output=True, text=True, timeout=timeout)
        
        # Check for decode errors - only treat as error if return code is non-zero
        # or if stderr contains known corruption indicators
        stderr = decode_result.stderr.strip() if decode_result.stderr else ""
        stderr_lower = stderr.lower()
        
        # For AV1 files, be more lenient about certain error messages
        # Some AV1 encoders produce files that generate warnings/errors during initial
        # frame decoding (e.g., "Corrupt frame detected", "No sequence header") but
        # play back correctly. This is especially common with files that use temporal
        # scalability or have non-standard sequence header placement.
        if is_av1_source:
            # Check if the only errors are known false positives for AV1
            found_real_error = False
            found_false_positive = False
            
            for indicator in VIDEO_CORRUPTION_INDICATORS:
                indicator_lower = indicator.lower()
                if indicator_lower in stderr_lower:
                    if indicator_lower in AV1_FALSE_POSITIVE_INDICATORS:
                        found_false_positive = True
                    else:
                        found_real_error = True
                        # Found a real error, fail immediately
                        return False, f"Video file appears to be corrupt: {indicator}"
            
            # If we only found false positives (no real errors), the file is valid
            if found_false_positive and not found_real_error:
                logger.debug(f"AV1 file had known false positive warnings during validation (ignoring): {stderr[:200]}")
                return True, None
            
            # If returncode is non-zero, fail (either with stderr message or generic failure)
            if decode_result.returncode != 0:
                if stderr:
                    return False, f"Decode test failed: {stderr[:200]}"
                else:
                    return False, "Decode test failed with no error message"
            
            return True, None
        else:
            # For non-AV1 files, use strict validation
            if decode_result.returncode != 0:
                # Decode failed - check for specific corruption indicators
                for indicator in VIDEO_CORRUPTION_INDICATORS:
                    if indicator.lower() in stderr_lower:
                        return False, f"Video file appears to be corrupt: {indicator}"
                # Generic decode failure
                return False, f"Decode test failed: {stderr[:200] if stderr else 'Unknown error'}"
            
            # Return code is 0 (success), but check for corruption indicators in warnings
            for indicator in VIDEO_CORRUPTION_INDICATORS:
                if indicator.lower() in stderr_lower:
                    return False, f"Video file appears to be corrupt: {indicator}"
        
        return True, None
        
    except sp.TimeoutExpired:
        return False, f"Validation timed out after {timeout} seconds"
    except FileNotFoundError:
        return False, "Video file not found"
    except Exception as ex:
        return False, f"Validation error: {str(ex)}"


def calculate_transcode_timeout(video_path, base_timeout=7200):
    """
    Calculate a smart timeout for video transcoding based on video duration.
    
    For CPU encoding, a reasonable estimate is:
    - Real-time encoding takes duration * 1x
    - Slow CPU encoding can take 10-20x the duration
    - We add a safety margin of 3x on top
    
    Args:
        video_path: Path to the video file
        base_timeout: Base timeout in seconds (used if duration can't be determined)
    
    Returns:
        int: Timeout in seconds
    """
    duration = get_video_duration(video_path)
    
    if duration:
        # Use 60x the video duration as timeout (assumes worst case 20x encoding + 3x safety margin)
        # Minimum of 600 seconds (10 minutes) for very short videos
        calculated_timeout = max(int(duration * 60), 600)
        # Cap at 8 hours to prevent truly stuck processes
        calculated_timeout = min(calculated_timeout, 28800)
        logger.debug(f"Calculated transcode timeout: {calculated_timeout}s for video duration {duration}s")
        return calculated_timeout
    else:
        logger.debug(f"Could not determine video duration, using base timeout: {base_timeout}s")
        return base_timeout

def create_video_crop(source_path, out_path, start_time=None, end_time=None):
    """
    Stream-copy a segment of source_path into out_path using FFmpeg.
    start_time / end_time are in seconds (float). None means file start/end.
    Uses -c copy (no re-encode) so this is fast even for large files.
    Returns True on success, False on failure.
    """
    cmd = ['ffmpeg', '-y']
    if start_time:
        cmd += ['-ss', str(start_time)]
    if end_time:
        cmd += ['-to', str(end_time)]
    cmd += ['-i', str(source_path), '-c', 'copy', str(out_path)]
    logger.debug(f"$ {' '.join(cmd)}")
    result = sp.call(cmd)
    if result == 0:
        logger.info(f'Created crop {str(out_path)} (start={start_time}, end={end_time})')
    else:
        logger.error(f'Failed to create crop {str(out_path)} (exit code {result})')
    return result == 0


def create_audio_extract(source_path, out_path):
    """
    Extract a tiny mono audio-only MP3 from source_path for waveform display.
    Low bitrate + mono keeps the file small so WaveSurfer loads/decodes quickly.
    Returns True on success, False on failure.
    """
    cmd = [
        'ffmpeg', '-v', 'quiet', '-y',
        '-i', str(source_path),
        '-vn',           # drop video
        '-ac', '1',      # mono
        '-ar', '22050',  # 22 kHz sample rate (plenty for a waveform visual)
        '-b:a', '32k',   # 32 kbps — keeps file tiny
        str(out_path),
    ]
    logger.debug(f"$ {' '.join(cmd)}")
    result = sp.call(cmd)
    if result == 0:
        logger.info(f'Created audio extract {str(out_path)}')
    else:
        logger.error(f'Failed to create audio extract {str(out_path)} (exit code {result})')
    return result == 0


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

def _get_encoder_candidates(use_gpu=False, encoder_preference='auto'):
    """
    Get the list of encoder configurations to try in priority order.

    Args:
        use_gpu: Whether to include GPU encoders in the list
        encoder_preference: 'auto', 'h264', or 'av1'

    Returns:
        list: List of encoder configurations to try in order
    """
    h264_cpu = {
        'name': 'H.264 CPU',
        'video_codec': 'libx264',
        'audio_codec': 'aac',
        'audio_bitrate': '128k',
        'extra_args': ['-preset', 'fast', '-crf', '23']
    }
    av1_cpu = {
        'name': 'AV1 CPU',
        'video_codec': 'libaom-av1',
        'audio_codec': 'libopus',
        'audio_bitrate': '96k',
        'extra_args': ['-cpu-used', '4', '-crf', '30', '-b:v', '0']
    }
    h264_nvenc = {
        'name': 'H.264 NVENC',
        'video_codec': 'h264_nvenc',
        'audio_codec': 'aac',
        'audio_bitrate': '128k',
        'extra_args': ['-preset', 'p4', '-cq:v', '23']
    }
    av1_nvenc = {
        'name': 'AV1 NVENC',
        'video_codec': 'av1_nvenc',
        'audio_codec': 'libopus',
        'audio_bitrate': '96k',
        'extra_args': ['-preset', 'p4', '-cq:v', '30']
    }

    if encoder_preference == 'h264':
        if use_gpu:
            return [h264_nvenc, h264_cpu]
        return [h264_cpu]
    elif encoder_preference == 'av1':
        if use_gpu:
            return [av1_nvenc, av1_cpu]
        return [av1_cpu]
    else:  # auto - H.264 first (faster), AV1 as fallback
        if use_gpu:
            return [h264_nvenc, av1_nvenc, h264_cpu, av1_cpu]
        return [h264_cpu, av1_cpu]

def run_ffmpeg_with_progress(cmd, total_duration, timeout_seconds=None, data_path=None):
    """
    Run an FFmpeg command with real-time progress tracking via -progress flag.

    If data_path is provided, reads the existing status file and updates it with
    percent/speed. Progress is throttled to every 0.5 seconds to avoid I/O overhead.
    stderr is drained in a background thread to prevent pipe buffer deadlock and
    is logged at warning level if the process exits with a non-zero code.
    """
    # Insert -progress pipe:1 before output file (last arg)
    cmd_with_progress = cmd[:-1] + ['-progress', 'pipe:1'] + [cmd[-1]]

    process = sp.Popen(cmd_with_progress, stdout=sp.PIPE, stderr=sp.PIPE, text=True)
    last_update = 0
    speed = None
    percent = None
    current_seconds = 0

    # Drain stderr in a background thread to prevent pipe buffer from filling
    # and blocking ffmpeg. Collected lines are logged on failure.
    stderr_lines = []
    def _drain_stderr():
        for line in process.stderr:
            stderr_lines.append(line.rstrip())
    stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
    stderr_thread.start()

    # -progress outputs clean key=value lines:
    # out_time_us=83450000
    # speed=1.5x
    # progress=continue
    try:
        for line in process.stdout:
            line = line.strip()
            if '=' not in line:
                continue

            key, value = line.split('=', 1)

            if key == 'out_time_us' and total_duration:
                try:
                    current_us = int(value)
                    current_seconds = current_us / 1_000_000
                    percent = min(100, (current_seconds / total_duration) * 100)
                except ValueError:
                    pass

            elif key == 'speed' and value.endswith('x'):
                try:
                    speed = float(value.rstrip('x'))
                except ValueError:
                    pass

            elif key == 'progress':
                # 'continue' or 'end' - good time to update status
                now = time.time()
                if now - last_update >= 0.5 and data_path and percent is not None:
                    # Calculate ETA: remaining time / encoding speed
                    eta_seconds = None
                    if speed and speed > 0 and total_duration:
                        remaining_seconds = total_duration - current_seconds
                        eta_seconds = remaining_seconds / speed

                    # Read existing status and update with progress
                    existing = read_transcoding_status(data_path)
                    write_transcoding_status(
                        data_path,
                        existing.get('current', 0),
                        existing.get('total', 0),
                        existing.get('current_video'),
                        existing.get('pid'),
                        percent,
                        eta_seconds,
                        existing.get('resolution')
                    )
                    last_update = now

        process.wait(timeout=timeout_seconds)
    except sp.TimeoutExpired:
        process.kill()
        process.wait()
        raise
    finally:
        stderr_thread.join(timeout=5)

    if process.returncode != 0 and stderr_lines:
        logger.warning(f"FFmpeg exited with code {process.returncode}. stderr output:")
        for line in stderr_lines[-100:]:
            logger.warning(f"  ffmpeg: {line}")

    return process


def _build_transcode_command(video_path, out_path, height, encoder):
    """Build an ffmpeg command for transcoding with the given encoder."""
    cmd = ['ffmpeg', '-v', 'warning', '-stats', '-y', '-i', str(video_path)]
    cmd.extend(['-c:v', encoder['video_codec']])
    
    if 'extra_args' in encoder:
        cmd.extend(encoder['extra_args'])
    
    cmd.extend(['-vf', f'scale=-2:{height}'])
    cmd.extend(['-c:a', encoder['audio_codec'], '-b:a', encoder.get('audio_bitrate', '128k')])
    cmd.append(str(out_path))
    
    return cmd

def transcode_video_quality(video_path, out_path, height, use_gpu=False, timeout_seconds=None, encoder_preference='auto', data_path=None):
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
        timeout_seconds: Maximum time allowed for encoding (default: calculated based on video duration)
    
    Returns:
        tuple: (success: bool, failure_reason: str or None)
            - (True, None) if transcoding succeeded
            - (False, 'corruption') if source file appears corrupt
            - (False, 'encoders') if all encoders failed
    """
    global _working_encoder_cache
    s = time.time()
    
    # Validate the source video file before attempting transcoding
    # This catches corrupt files early instead of trying all encoders
    is_valid, error_msg = validate_video_file(video_path)
    if not is_valid:
        logger.error(f"Source video validation failed: {error_msg}")
        logger.warning("Skipping transcoding for this video due to file corruption or read errors")
        return (False, 'corruption')

    # Get video duration for progress logging
    total_duration = get_video_duration(video_path) or 0

    # Calculate smart timeout based on video duration if not provided
    if timeout_seconds is None:
        timeout_seconds = calculate_transcode_timeout(video_path)

    logger.info(f"Using transcode timeout of {timeout_seconds}s ({timeout_seconds/60:.1f} minutes)")
    
    # Determine output container based on codec
    out_path_str = str(out_path)

    # Write to a temp path during transcoding; only rename to the final path on
    # success. This ensures a partially-written file from a crashed ffmpeg process
    # is never picked up and served as a valid transcode output.
    tmp_path = Path(out_path_str + '.tmp')
    tmp_path_str = str(tmp_path)
    if tmp_path.exists():
        try:
            tmp_path.unlink()
            logger.debug(f"Cleaned up leftover temp file: {tmp_path_str}")
        except OSError as ex:
            logger.debug(f"Could not remove leftover temp file: {ex}")

    mode = 'gpu' if use_gpu else 'cpu'

    # Use cached encoder if available to avoid redundant encoder detection during bulk transcoding.
    if _working_encoder_cache[mode] is not None:
        encoder = _working_encoder_cache[mode]
        logger.debug(f"Using cached {mode.upper()} encoder: {encoder['name']}")

        # Build ffmpeg command using the cached encoder
        logger.info(f"Transcoding video to {height}p using {encoder['name']}")
        cmd = _build_transcode_command(video_path, tmp_path, height, encoder)

        logger.debug(f"$: {' '.join(cmd)}")

        try:
            result = run_ffmpeg_with_progress(cmd, total_duration, timeout_seconds, data_path)
            if result.returncode == 0:
                tmp_path.rename(out_path)
                e = time.time()
                logger.info(f'Transcoded {str(out_path)} to {height}p in {e-s:.2f}s')
                return (True, None)
            else:
                # Cached encoder failed - clear cache and fall through to try all encoders
                logger.warning(f"Cached encoder {encoder['name']} failed with exit code {result.returncode}")
                logger.info("Clearing encoder cache and retrying with all available encoders...")
                _working_encoder_cache[mode] = None
                if tmp_path.exists():
                    try:
                        tmp_path.unlink()
                    except OSError as cleanup_ex:
                        logger.debug(f"Could not clean up temp file: {cleanup_ex}")
        except sp.TimeoutExpired:
            logger.warning(f"Cached encoder {encoder['name']} timed out after {timeout_seconds} seconds")
            logger.info("Clearing encoder cache and retrying with all available encoders...")
            _working_encoder_cache[mode] = None
            # Clean up the process and any partial output
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                    logger.debug(f"Cleaned up timed out temp file: {tmp_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up timed out temp file: {cleanup_ex}")
        except Exception as ex:
            # Cached encoder failed - clear cache and fall through to try all encoders
            logger.warning(f"Cached encoder {encoder['name']} failed: {ex}")
            logger.info("Clearing encoder cache and retrying with all available encoders...")
            _working_encoder_cache[mode] = None
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up temp file: {cleanup_ex}")
    
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
    encoders = _get_encoder_candidates(use_gpu, encoder_preference)

    last_exception = None
    for encoder in encoders:
        logger.info(f"Trying {encoder['name']}...")

        # Build ffmpeg command targeting the temp path
        cmd = _build_transcode_command(video_path, tmp_path, height, encoder)

        logger.debug(f"$: {' '.join(cmd)}")

        try:
            result = run_ffmpeg_with_progress(cmd, total_duration, timeout_seconds, data_path)
            if result.returncode == 0:
                # Success! Move temp file to final location, cache encoder, and return.
                tmp_path.rename(out_path)
                logger.info(f"✓ {encoder['name']} works! Using it for all transcodes this session.")
                _working_encoder_cache[mode] = encoder
                e = time.time()
                logger.info(f'Transcoded {str(out_path)} to {height}p in {e-s:.2f}s')
                return (True, None)
            else:
                logger.warning(f"✗ {encoder['name']} failed with exit code {result.returncode}")
                last_exception = Exception(f"Transcode failed with exit code {result.returncode}")
                # Clean up temp file before trying next encoder
                if tmp_path.exists():
                    try:
                        tmp_path.unlink()
                        logger.debug(f"Cleaned up failed temp file: {tmp_path_str}")
                    except OSError as cleanup_ex:
                        logger.debug(f"Could not clean up failed temp file: {cleanup_ex}")
        except sp.TimeoutExpired:
            logger.warning(f"✗ {encoder['name']} timed out after {timeout_seconds} seconds")
            last_exception = Exception(f"Transcode timed out after {timeout_seconds} seconds")
            # Clean up temp file before trying next encoder
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                    logger.debug(f"Cleaned up timed out temp file: {tmp_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up timed out temp file: {cleanup_ex}")
        except Exception as ex:
            logger.warning(f"✗ {encoder['name']} failed: {ex}")
            last_exception = ex
            # Clean up temp file before trying next encoder
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                    logger.debug(f"Cleaned up failed temp file: {tmp_path_str}")
                except OSError as cleanup_ex:
                    logger.debug(f"Could not clean up failed temp file: {cleanup_ex}")
    
    # If we get here, no encoder worked
    error_msg = f"No working {mode.upper()} encoder found for video. Tried: {', '.join([e['name'] for e in encoders])}"
    logger.error(error_msg)
    if last_exception:
        logger.error(f"Last error was: {last_exception}")
    
    # Return failure with 'encoders' reason to indicate encoder failure (not corruption)
    # This allows the calling code to continue processing other videos
    return (False, 'encoders')

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

def detect_game_from_filename(filename: str, steamgriddb_api_key: str = None, path: str = None):
    """
    Fuzzy match a video filename against existing games in database using RapidFuzz.
    Falls back to SteamGridDB search if no local match found.

    Args:
        filename: Video filename without extension
        steamgriddb_api_key: Optional API key for SteamGridDB fallback
        path: Optional relative path (e.g. "Game Name/clip.mp4") - folder name is tried first

    Returns:
        dict with 'game_id', 'game_name', 'steamgriddb_id', 'confidence', 'source' or None
    """
    from rapidfuzz import fuzz, process
    from fireshare.models import GameMetadata
    import re

    # Step 0: Try folder name first (highest confidence source)
    # Skip folder-based detection for upload folders (they're not game names)
    from fireshare.constants import DEFAULT_CONFIG
    upload_folders = {
        DEFAULT_CONFIG['app_config']['admin_upload_folder_name'].lower(),
        DEFAULT_CONFIG['app_config']['public_upload_folder_name'].lower(),
    }

    if path:
        normalized_path = path.replace('\\', '/')
        parts = [part for part in normalized_path.split('/') if part]
        if len(parts) > 1:  # Has at least one folder
            folder_name = parts[0]  # Top-level folder

            # Skip folder-based detection for upload folders
            if folder_name.lower() not in upload_folders:
                # Try matching folder name against local game database
                games = GameMetadata.query.all()
                if games:
                    game_choices = [(game.name, game) for game in games]
                    result = process.extractOne(
                        folder_name,
                        game_choices,
                        scorer=fuzz.token_set_ratio,
                        score_cutoff=80  # Higher threshold for folder match
                    )

                    if result:
                        matched_name, score, matched_game = result[0], result[1], result[2]
                        best_match = {
                            'game_id': matched_game.id,
                            'game_name': matched_game.name,
                            'steamgriddb_id': matched_game.steamgriddb_id,
                            'confidence': score / 100,
                            'source': 'folder_local'
                        }
                        logger.info(f"Folder-based game match: {best_match['game_name']} (confidence: {score:.0f}%)")
                        return best_match

                # Try SteamGridDB with folder name
                if steamgriddb_api_key:
                    logger.info(f"No local folder match, searching SteamGridDB for folder: '{folder_name}'")
                    from fireshare.steamgrid import SteamGridDBClient
                    client = SteamGridDBClient(steamgriddb_api_key)

                    try:
                        results = client.search_games(folder_name)
                        if results and len(results) > 0:
                            top_result = results[0]
                            # Use higher confidence for folder-based SteamGridDB match
                            detected = {
                                'game_id': None,
                                'game_name': top_result.get('name'),
                                'steamgriddb_id': top_result.get('id'),
                                'confidence': 0.85,  # Higher than filename-based
                                'source': 'folder_steamgriddb',
                                'release_date': top_result.get('release_date')
                            }
                            logger.info(f"Folder-based SteamGridDB match: {detected['game_name']} (id: {detected['steamgriddb_id']})")
                            return detected
                    except Exception as ex:
                        logger.warning(f"SteamGridDB folder search failed: {ex}")
            else:
                logger.debug(f"Skipping folder-based detection for upload folder: '{folder_name}'")

    # Clean filename for better matching
    clean_name = filename.lower()
    # Remove common patterns: dates, numbers, "gameplay", etc.
    clean_name = re.sub(r'\d{4}-\d{2}-\d{2}', '', clean_name)  # Remove dates like 2024-01-14
    clean_name = re.sub(r'\d{8}', '', clean_name)  # Remove YYYYMMDD format
    clean_name = re.sub(r'\b(gameplay|clip|highlights?|match|game|recording|video)\b', '', clean_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'[_\-]+', ' ', clean_name)  # Replace _ and - with spaces
    clean_name = re.sub(r'\s+', ' ', clean_name)  # Normalize whitespace
    clean_name = clean_name.strip()

    if not clean_name:
        logger.debug("Filename cleaned to empty string, cannot detect game")
        return None

    # Step 1: Try local database first
    games = GameMetadata.query.all()

    if not games:
        logger.debug("No games in database to match against")
    else:
        # Create list of (game_name, game_object) tuples for rapidfuzz
        game_choices = [(game.name, game) for game in games]

        # Use token_set_ratio - ignores word order and extra words
        result = process.extractOne(
            clean_name,
            game_choices,
            scorer=fuzz.token_set_ratio,
            score_cutoff=65  # Minimum confidence (0-100 scale)
        )

        if result:
            matched_name, score, matched_game = result[0], result[1], result[2]
            best_match = {
                'game_id': matched_game.id,
                'game_name': matched_game.name,
                'steamgriddb_id': matched_game.steamgriddb_id,
                'confidence': score / 100,  # Convert to 0-1 scale
                'source': 'local'
            }
            logger.info(f"Local game match: {best_match['game_name']} (confidence: {score:.0f}%)")
            return best_match

    # Step 2: Fallback to SteamGridDB search
    if steamgriddb_api_key:
        logger.info(f"No local match found, searching SteamGridDB for: '{clean_name}'")
        from fireshare.steamgrid import SteamGridDBClient
        client = SteamGridDBClient(steamgriddb_api_key)

        try:
            results = client.search_games(clean_name)
            if results and len(results) > 0:
                # Take the first result (SteamGridDB returns best matches first)
                top_result = results[0]
                detected = {
                    'game_id': None,  # Not in our DB yet
                    'game_name': top_result.get('name'),
                    'steamgriddb_id': top_result.get('id'),
                    'confidence': 0.75,  # Assume SteamGridDB results are good
                    'source': 'steamgriddb',
                    'release_date': top_result.get('release_date')
                }
                logger.info(f"SteamGridDB match: {detected['game_name']} (id: {detected['steamgriddb_id']})")
                return detected
        except Exception as ex:
            logger.warning(f"SteamGridDB search failed: {ex}")

    logger.debug(f"No game match found for filename: '{clean_name}'")
    return None

def _extract_date_from_filename(filename: str):
    """
    Extract a recording date from a video filename using regex patterns.

    Supports formats from common screen recording software:
    - 2024-01-14, 2024_01_14, 2024.01.14
    - 20240114
    - 01-14-2024, 01_14_2024

    Args:
        filename: Video filename (with or without extension)

    Returns:
        datetime object if a valid date was found, None otherwise
    """
    name = Path(filename).stem

    # Pattern 1: YYYY-MM-DD or YYYY_MM_DD or YYYY.MM.DD (with optional time)
    match = re.search(r'(\d{4})[-_.](\d{2})[-_.](\d{2})(?:[-_.\s]+(\d{2})[-_.](\d{2})[-_.](\d{2}))?', name)
    if match:
        y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
        hr = int(match.group(4)) if match.group(4) else 0
        mi = int(match.group(5)) if match.group(5) else 0
        se = int(match.group(6)) if match.group(6) else 0
        try:
            if 2000 <= y <= datetime.now().year + 1:
                return datetime(y, m, d, hr, mi, se)
        except ValueError:
            pass

    # Pattern 2: YYYYMMDD (compact, with optional time HHMMSS)
    match = re.search(r'(\d{4})(\d{2})(\d{2})(?:[-_]?(\d{2})(\d{2})(\d{2}))?', name)
    if match:
        y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
        hr = int(match.group(4)) if match.group(4) else 0
        mi = int(match.group(5)) if match.group(5) else 0
        se = int(match.group(6)) if match.group(6) else 0
        try:
            if 2000 <= y <= datetime.now().year + 1:
                return datetime(y, m, d, hr, mi, se)
        except ValueError:
            pass

    # Pattern 3: MM-DD-YYYY or MM_DD_YYYY (US format)
    match = re.search(r'(\d{2})[-_](\d{2})[-_](\d{4})', name)
    if match:
        m, d, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
        try:
            if 2000 <= y <= datetime.now().year + 1:
                return datetime(y, m, d)
        except ValueError:
            pass

    return None


def _extract_date_from_metadata(file_path: Path):
    """
    Extract creation date from video file metadata using ffprobe.

    Looks for common metadata tags like creation_time, date, etc.

    Args:
        file_path: Path to the video file

    Returns:
        datetime object if a valid date was found in metadata, None otherwise
    """
    try:
        cmd = f'ffprobe -v quiet -print_format json -show_entries format_tags {file_path}'
        logger.debug(f"$ {cmd}")
        data = json.loads(sp.check_output(cmd.split()).decode('utf-8'))
        
        tags = data.get('format', {}).get('tags', {})
        if not tags:
            return None
        
        # Common metadata date tags (case-insensitive check)
        date_tags = ['creation_time', 'date', 'date_recorded', 'recorded_date', 
                     'com.apple.quicktime.creationdate', 'creation_date']
        
        for tag in date_tags:
            # Try both original case and lowercase
            value = tags.get(tag) or tags.get(tag.upper()) or tags.get(tag.lower())
            if value:
                # Try parsing various date formats
                date_formats = [
                    '%Y-%m-%dT%H:%M:%S.%fZ',  # ISO format with microseconds
                    '%Y-%m-%dT%H:%M:%SZ',      # ISO format
                    '%Y-%m-%dT%H:%M:%S.%f',    # ISO without Z
                    '%Y-%m-%dT%H:%M:%S',       # ISO without Z or microseconds
                    '%Y-%m-%d %H:%M:%S',       # Standard datetime
                    '%Y-%m-%d',                # Date only
                    '%Y:%m:%d %H:%M:%S',       # EXIF style
                ]
                
                for fmt in date_formats:
                    try:
                        # Handle timezone offset (e.g., +00:00)
                        clean_value = re.sub(r'[+-]\d{2}:\d{2}$', '', value)
                        parsed = datetime.strptime(clean_value, fmt)
                        if 2000 <= parsed.year <= datetime.now().year + 1:
                            logger.debug(f"Extracted date {parsed} from metadata tag '{tag}'")
                            return parsed
                    except ValueError:
                        continue
        
        return None
    except Exception as ex:
        logger.debug(f"Failed to extract date from metadata: {ex}")
        return None


def extract_date_from_file(file_path: Path):
    """
    Extract a recording date from a video file.

    Tries the following sources in order:
    1. Video metadata (creation_time, date tags via ffprobe)
    2. Filename patterns (common screen recording software formats)
    3. File creation timestamp

    Args:
        file_path: Path to the video file

    Returns:
        datetime object with the best available date, or None if file doesn't exist
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        logger.warning(f"Cannot extract date from non-existent file: {file_path}")
        return None
    
    # 1. Try metadata first (most accurate)
    metadata_date = _extract_date_from_metadata(file_path)
    if metadata_date:
        logger.debug(f"Using metadata date for {file_path.name}: {metadata_date}")
        return metadata_date
    
    # 2. Try filename patterns
    filename_date = _extract_date_from_filename(file_path.name)
    if filename_date:
        logger.debug(f"Using filename date for {file_path.name}: {filename_date}")
        return filename_date
    
    # 3. Fall back to file creation time
    try:
        # Use ctime on Unix (inode change time, often creation) or creation time on Windows
        created_timestamp = os.path.getctime(file_path)
        created_date = datetime.fromtimestamp(created_timestamp)
        logger.debug(f"Using file creation date for {file_path.name}: {created_date}")
        return created_date
    except Exception as ex:
        logger.warning(f"Failed to get file creation time for {file_path}: {ex}")
        return None
