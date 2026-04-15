import json
import logging
import os
import signal
import subprocess
import threading

from flask import current_app, jsonify, Response
from flask_login import login_required

from .. import util
from ..models import VideoInfo
from . import api
from .decorators import demo_restrict


# Global transcoding state
_transcoding_process = None
_transcoding_queue = []   # items are (video_id, task_count) tuples; video_id=None means bulk
_queue_lock = threading.Lock()
_queue_thread = None
_completed_tasks = 0      # tasks finished so far in this queue session


def _count_expected_tasks(video_id, data_path):
    """Estimate transcode task count for a video at enqueue time (requires app context).
    Mirrors CLI logic: only counts resolutions strictly below the video's own height."""
    if video_id is None:
        return 0  # bulk: unknown until CLI starts; status.total takes over once running
    config_path = data_path / 'config.json'
    resolutions = []
    if config_path.exists():
        with open(config_path) as f:
            tc = json.load(f).get('transcoding', {})
        if tc.get('enable_1080p', True): resolutions.append(1080)
        if tc.get('enable_720p', True): resolutions.append(720)
        if tc.get('enable_480p', True): resolutions.append(480)
    else:
        resolutions = [1080, 720, 480]
    vi = VideoInfo.query.filter_by(video_id=video_id).first()
    original_height = vi.height or 0 if vi else 0
    count = sum(1 for h in resolutions if original_height > h)
    return count if count > 0 else len(resolutions)  # fallback if height unknown


def _drain_queue(data_path):
    """Background thread: process queued transcode jobs sequentially."""
    global _transcoding_process, _queue_thread, _completed_tasks
    while True:
        with _queue_lock:
            if not _transcoding_queue:
                _queue_thread = None
                _transcoding_process = None
                _completed_tasks = 0
                break
            video_id, task_count = _transcoding_queue.pop(0)
        try:
            cmd = ['fireshare', 'transcode-videos']
            if video_id is not None:
                cmd += ['--video', video_id]
            _transcoding_process = subprocess.Popen(cmd, env=os.environ.copy(), start_new_session=True)
            util.write_transcoding_status(data_path, 0, 0, None, _transcoding_process.pid)
            _transcoding_process.wait()
            _completed_tasks += task_count
        except Exception as e:
            logging.error(f'Transcoding queue failed for video_id={video_id}: {e}')


def _enqueue_transcode(video_id, data_path):
    """Add a job to the queue. Starts the drain thread if not already running."""
    global _queue_thread
    task_count = _count_expected_tasks(video_id, data_path)
    with _queue_lock:
        _transcoding_queue.append((video_id, task_count))
        if _queue_thread is None or not _queue_thread.is_alive():
            _queue_thread = threading.Thread(target=_drain_queue, args=(data_path,), daemon=True)
            _queue_thread.start()
            return 'started'
    return 'queued'


def _is_pid_running(pid):
    """Check if a process with the given PID is still running."""
    if pid is None:
        return False
    try:
        pid = int(pid)
        if pid <= 0:
            return False
    except (TypeError, ValueError):
        return False
    try:
        os.kill(pid, 0)  # Signal 0 doesn't kill, just checks if process exists
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # Process exists but we don't have permission


@api.route('/api/admin/transcoding/status', methods=["GET"])
@login_required
def get_transcoding_status():
    """Get transcoding status and capabilities."""
    global _transcoding_process

    enabled = current_app.config.get('ENABLE_TRANSCODING', False)
    gpu_enabled = current_app.config.get('TRANSCODE_GPU', False)
    paths = current_app.config['PATHS']

    subprocess_running = _transcoding_process is not None and _transcoding_process.poll() is None
    progress = util.read_transcoding_status(paths['data'])

    # Verify the PID from status file is actually still running (handles container restart)
    pid_alive = _is_pid_running(progress.get('pid'))
    is_running = subprocess_running or (progress.get('is_running', False) and pid_alive)

    # Clean up stale status
    if progress.get('is_running') and not is_running:
        util.clear_transcoding_status(paths['data'])
        progress = {"current": 0, "total": 0, "current_video": None}

    if not subprocess_running and _transcoding_process is not None:
        _transcoding_process = None

    return jsonify({
        "enabled": enabled,
        "gpu_enabled": gpu_enabled,
        "is_running": is_running,
        "current": progress.get('current', 0),
        "total": progress.get('total', 0),
        "current_video": progress.get('current_video'),
        "percent": progress.get('percent'),
        "eta_seconds": progress.get('eta_seconds'),
        "resolution": progress.get('resolution'),
        "queue_tasks": sum(c for _, c in _transcoding_queue),
        "completed_tasks": _completed_tasks,
    })


@api.route('/api/admin/transcoding/start', methods=["POST"])
@login_required
@demo_restrict
def start_transcoding():
    """Start bulk transcoding of all videos, or queue it if already running."""
    if not current_app.config.get('ENABLE_TRANSCODING', False):
        return Response(status=400, response='Transcoding is not enabled')
    paths = current_app.config['PATHS']
    status = _enqueue_transcode(None, paths['data'])
    return jsonify({"status": status})


@api.route('/api/admin/transcoding/start/<video_id>', methods=["POST"])
@login_required
@demo_restrict
def start_transcoding_video(video_id):
    """Start transcoding for a single video, or queue it if already running."""
    if not current_app.config.get('ENABLE_TRANSCODING', False):
        return Response(status=400, response='Transcoding is not enabled')
    paths = current_app.config['PATHS']
    status = _enqueue_transcode(video_id, paths['data'])
    return jsonify({"status": status})


@api.route('/api/admin/transcoding/cancel', methods=["POST"])
@login_required
@demo_restrict
def cancel_transcoding():
    """Cancel ongoing transcoding."""
    global _transcoding_process

    paths = current_app.config['PATHS']
    pid_to_kill = None

    # Try to get PID from global variable first
    if _transcoding_process is not None:
        if _transcoding_process.poll() is not None:
            # Process already finished
            _transcoding_process = None
        else:
            pid_to_kill = _transcoding_process.pid

    # If no global process, try to recover PID from status file
    if pid_to_kill is None:
        status = util.read_transcoding_status(paths['data'])
        pid_to_kill = status.get('pid')
        # If status doesn't show running, nothing to cancel
        if not status.get('is_running', False):
            return Response(status=400, response='No transcoding in progress')

    # Try to kill the process if we have a PID
    if pid_to_kill is not None:
        try:
            target_pgid = os.getpgid(pid_to_kill)
            my_pgid = os.getpgid(os.getpid())

            if target_pgid != my_pgid:
                # Safe to kill the process group (won't kill Flask)
                os.killpg(target_pgid, signal.SIGTERM)
            else:
                # Same process group as Flask - only kill the specific process
                os.kill(pid_to_kill, signal.SIGTERM)

            if _transcoding_process is not None:
                _transcoding_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if target_pgid != my_pgid:
                os.killpg(target_pgid, signal.SIGKILL)
            else:
                os.kill(pid_to_kill, signal.SIGKILL)
        except ProcessLookupError:
            pass  # Process already dead
        except OSError:
            pass  # Process group doesn't exist

    # Clear the queue and status file
    with _queue_lock:
        _transcoding_queue.clear()
    util.clear_transcoding_status(paths['data'])

    global _completed_tasks
    _completed_tasks = 0
    _transcoding_process = None
    return jsonify({"status": "cancelled"})
