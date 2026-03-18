import json
import os, re, signal, string
import shutil
import random
import logging
import threading
import subprocess
import time
from collections import Counter
from datetime import datetime
from functools import wraps
from queue import Queue, Empty
from subprocess import Popen
from textwrap import indent
from flask import Blueprint, render_template, request, Response, jsonify, current_app, send_file, redirect
from flask_login import current_user, login_required
from flask_cors import CORS
from sqlalchemy import func
from sqlalchemy.sql import text
from pathlib import Path
import requests


from . import db, logger, util
from .constants import DEFAULT_CONFIG, SUPPORTED_FILE_TYPES
from .models import User, Video, VideoInfo, VideoView, GameMetadata, VideoGameLink, FolderRule
from .steamgrid import SteamGridDBClient

def secure_filename(filename):
    clean = re.sub(r"[/\\?%*:|\"<>\x7F\x00-\x1F]", "-", filename)
    return clean

def add_cache_headers(response, cache_key, max_age=604800):
    """Add cache headers for static assets (default: 7 days)."""
    response.headers['Cache-Control'] = f'public, max-age={max_age}, must-revalidate'
    response.headers['ETag'] = f'"{cache_key}"'
    return response

templates_path = os.environ.get('TEMPLATE_PATH') or 'templates'
api = Blueprint('api', __name__, template_folder=templates_path)

CORS(api, supports_credentials=True)

# Global state for tracking game scan progress
_game_scan_state = {
    'is_running': False,
    'current': 0,
    'total': 0,
    'suggestions_created': 0,
    'lock': threading.Lock()
}

def get_steamgriddb_api_key():
    """
    Get SteamGridDB API key from config.json first, then fall back to environment variable.
    """
    # First check config.json
    paths = current_app.config['PATHS']
    config_path = paths['data'] / 'config.json'
    if config_path.exists():
        try:
            with open(config_path, 'r') as configfile:
                config = json.load(configfile)
                api_key = config.get('integrations', {}).get('steamgriddb_api_key', '')
                if api_key:
                    return api_key
        except:
            pass

    # Fall back to environment variable
    return os.environ.get('STEAMGRIDDB_API_KEY', '')

def login_required_unless_public_game_tag(func):
    """
    Decorator that requires login unless public game tagging is enabled in config.
    """
    @wraps(func)
    def decorated_view(*args, **kwargs):
        paths = current_app.config['PATHS']
        config_path = paths['data'] / 'config.json'
        allow_public = False
        if config_path.exists():
            try:
                with open(config_path, 'r') as configfile:
                    config = json.load(configfile)
                    allow_public = config.get('app_config', {}).get('allow_public_game_tag', False)
            except:
                pass
        if not current_user.is_authenticated and not allow_public:
            return current_app.login_manager.unauthorized()
        return func(*args, **kwargs)
    return decorated_view

def get_video_path(id, subid=None, quality=None):
    video = Video.query.filter_by(video_id=id).first()
    if not video:
        raise Exception(f"No video found for {id}")
    paths = current_app.config['PATHS']
    
    # Handle quality variants (480p, 720p, 1080p)
    if quality and quality in ['480p', '720p', '1080p']:
        # Check if the transcoded version exists
        derived_path = paths["processed"] / "derived" / id / f"{id}-{quality}.mp4"
        if derived_path.exists():
            return str(derived_path)
        # Fall back to original if quality doesn't exist
        logger.warning(f"Requested quality {quality} for video {id} not found, falling back to original")
    
    subid_suffix = f"-{subid}" if subid else ""
    ext = ".mp4" if subid else video.extension
    video_path = paths["processed"] / "video_links" / f"{id}{subid_suffix}{ext}"
    return str(video_path)

@api.route('/w/<video_id>')
def video_metadata(video_id):
    video = Video.query.filter_by(video_id=video_id).first()
    domain = f"https://{current_app.config['DOMAIN']}" if current_app.config['DOMAIN'] else ""
    if video:
        return render_template('metadata.html', video=video.json(), domain=domain)
    else:
        return redirect('{}/#/w/{}'.format(domain, video_id), code=302)

@api.route('/api/config')
def config():
    paths = current_app.config['PATHS']
    config_path = paths['data'] / 'config.json'
    file = open(config_path)
    config = json.load(file)
    file.close()
    if config_path.exists():
        # Return ui_config plus specific app_config settings that are needed publicly
        public_config = config["ui_config"].copy()
        public_config["allow_public_game_tag"] = config.get("app_config", {}).get("allow_public_game_tag", False)
        public_config["allow_public_upload"] = config.get("app_config", {}).get("allow_public_upload", False)
        return public_config
    else:
        return jsonify({})

# Cache for local app version and release notes (persists until server restart)
_local_version_cache = {'version': None}
_release_cache = {'data': None, 'fetched_at': 0}

def _get_local_version():
    """Get the locally installed app version from package.json. Cached until server restart."""
    if _local_version_cache['version']:
        return _local_version_cache['version']

    try:
        environment = current_app.config['ENVIRONMENT']
        package_json_path = '/app/package.json'
        if environment == "dev":
            # Find package.json relative to this file: app/server/fireshare/api.py -> app/client/package.json
            api_dir = Path(__file__).parent
            package_json_path = api_dir.parent.parent / 'client' / 'package.json'
            
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
            _local_version_cache['version'] = package_data.get('version', '')
            return _local_version_cache['version']
    except Exception as e:
        logger.error(f"Failed to read local version from package.json: {e}")
        return None

def _fetch_release_notes():
    """Fetch and cache the latest GitHub release. Cache expires after 12 hours."""
    cache_ttl = 12 * 60 * 60  # 12 hours
    if _release_cache['data'] and (time.time() - _release_cache['fetched_at']) < cache_ttl:
        return _release_cache['data']

    try:
        response = requests.get(
            'https://api.github.com/repos/ShaneIsrael/fireshare/releases',
            headers={'Accept': 'application/vnd.github.v3+json'},
            timeout=10
        )
        response.raise_for_status()
        releases = response.json()

        if not releases:
            return None

        target_release = releases[0]

        _release_cache['data'] = {
            'version': target_release.get('tag_name', '').lstrip('v'),
            'name': target_release.get('name', ''),
            'body': target_release.get('body', ''),
            'published_at': target_release.get('published_at', ''),
            'html_url': target_release.get('html_url', '')
        }
        _release_cache['fetched_at'] = time.time()
        return _release_cache['data']

    except requests.RequestException as e:
        logger.error(f"Failed to fetch GitHub releases: {e}")
        return None

@api.route('/api/release-notes')
def get_release_notes():
    """
    Fetch latest release notes from GitHub, with 24-hour caching.
    Also returns whether the current user should see the dialog.
    """
    release_data = _fetch_release_notes()

    if not release_data:
        return jsonify({'error': 'No releases found'}), 404

    # Check if user should see the dialog (server-side decision)
    show_dialog = False
    if current_user.is_authenticated:
        show_dialog = current_user.last_seen_version != release_data['version']

    return jsonify({
        **release_data,
        'show_dialog': show_dialog
    })

@api.route('/api/user/last-seen-version', methods=["PUT"])
@login_required
def user_last_seen_version():
    """
    Update the last seen version for the current user.
    Called when user dismisses the release notes dialog.
    """
    data = request.get_json()
    version = data.get('version') if data else None
    if not version:
        return Response(status=400, response='Version is required.')

    old_version = current_user.last_seen_version
    current_user.last_seen_version = version
    db.session.commit()
    logger.info(f"User '{current_user.username}' last_seen_version updated: {old_version} -> {version}")
    return jsonify({'last_seen_version': version})

@api.route('/api/admin/config', methods=["GET", "PUT"])
@login_required
def get_or_update_config():
    paths = current_app.config['PATHS']
    if request.method == 'GET':
        config_path = paths['data'] / 'config.json'
        file = open(config_path)
        config = json.load(file)
        file.close()
        if config_path.exists():
            # Include transcoding status (from env vars, doesn't change at runtime)
            config['transcoding_status'] = {
                'enabled': current_app.config.get('ENABLE_TRANSCODING', False),
                'gpu_enabled': current_app.config.get('TRANSCODE_GPU', False),
            }
            return config
        else:
            return jsonify({})
    if request.method == 'PUT':
        config = request.json["config"]
        config_path = paths['data'] / 'config.json'
        if not config:
            return Response(status=400, response='A config must be provided.')
        if not config_path.exists():
            return Response(status=500, response='Could not find a config to update.')
        config_path.write_text(json.dumps(config, indent=2))

        # Check if SteamGridDB API key was added and remove warning if present
        steamgrid_api_key = config.get('integrations', {}).get('steamgriddb_api_key', '')
        if steamgrid_api_key:
            steamgridWarning = "SteamGridDB API key not configured. Game metadata features are unavailable. Click here to set it up."
            if steamgridWarning in current_app.config['WARNINGS']:
                current_app.config['WARNINGS'].remove(steamgridWarning)

        return Response(status=200)

@api.route('/api/admin/warnings', methods=["GET"])
@login_required
def get_warnings():
    warnings = current_app.config['WARNINGS']
    if request.method == 'GET':
        if len(warnings) == 0:
            return jsonify({})
        else:
            return jsonify(warnings)

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


@api.route('/api/admin/stream')
@login_required
def admin_event_stream():
    """SSE endpoint for real-time admin events (transcoding, etc.)."""

    # Capture config before entering generator (Flask context unavailable inside)
    paths = current_app.config['PATHS']
    enabled = current_app.config.get('ENABLE_TRANSCODING', False)
    gpu_enabled = current_app.config.get('TRANSCODE_GPU', False)

    # Use a queue to communicate between polling thread and generator
    event_queue = Queue()
    stop_event = threading.Event()

    def poll_status():
        last_transcoding_state = None
        last_game_scan_state = None
        while not stop_event.is_set():
            try:
                progress = util.read_transcoding_status(paths['data'])
                pid = progress.get('pid')
                # Trust is_running flag; only verify process if pid present
                is_running = progress.get('is_running', False) and (pid is None or _is_pid_running(pid))

                if progress.get('is_running') and not is_running:
                    util.clear_transcoding_status(paths['data'])
                    progress = {"current": 0, "total": 0, "current_video": None}

                transcoding_state = {
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
                }

                if transcoding_state != last_transcoding_state:
                    event_queue.put(f"event: transcoding\ndata: {json.dumps(transcoding_state)}\n\n")
                    last_transcoding_state = transcoding_state.copy()

                with _game_scan_state['lock']:
                    game_scan_state = {
                        "is_running": _game_scan_state['is_running'],
                        "current": _game_scan_state['current'],
                        "total": _game_scan_state['total'],
                        "suggestions_created": _game_scan_state['suggestions_created'],
                    }

                if game_scan_state != last_game_scan_state:
                    event_queue.put(f"event: gameScan\ndata: {json.dumps(game_scan_state)}\n\n")
                    last_game_scan_state = game_scan_state.copy()

                time.sleep(1.5)
            except Exception as e:
                logger.error(f"SSE poll error: {e}")
                break

    def generate():
        # Start polling in background thread
        poll_thread = threading.Thread(target=poll_status, daemon=True)
        poll_thread.start()

        last_heartbeat = time.time()
        try:
            while True:
                try:
                    # Wait for events with timeout for heartbeat
                    event = event_queue.get(timeout=10)
                    yield event
                    last_heartbeat = time.time()
                except Empty:
                    # Send heartbeat if no events
                    if time.time() - last_heartbeat >= 30:
                        yield ": heartbeat\n\n"
                        last_heartbeat = time.time()
        except GeneratorExit:
            pass
        finally:
            stop_event.set()

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@api.route('/api/admin/transcoding/start', methods=["POST"])
@login_required
def start_transcoding():
    """Start bulk transcoding of all videos, or queue it if already running."""
    if not current_app.config.get('ENABLE_TRANSCODING', False):
        return Response(status=400, response='Transcoding is not enabled')
    paths = current_app.config['PATHS']
    status = _enqueue_transcode(None, paths['data'])
    return jsonify({"status": status})


@api.route('/api/admin/transcoding/start/<video_id>', methods=["POST"])
@login_required
def start_transcoding_video(video_id):
    """Start transcoding for a single video, or queue it if already running."""
    if not current_app.config.get('ENABLE_TRANSCODING', False):
        return Response(status=400, response='Transcoding is not enabled')
    paths = current_app.config['PATHS']
    status = _enqueue_transcode(video_id, paths['data'])
    return jsonify({"status": status})


@api.route('/api/admin/transcoding/cancel', methods=["POST"])
@login_required
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


def get_folder_size(folder_path):
    def _folder_size(directory):
        total = 0
        for entry in os.scandir(directory):
            if entry.is_dir():
                _folder_size(entry.path)
                total += parent_size[entry.path]
            else:
                size = entry.stat().st_size
                total += size
                file_size[entry.path] = size
        parent_size[directory] = total

    file_size = {}
    parent_size = {}
    _folder_size(folder_path)
    return parent_size.get(folder_path, 0)

@api.route('/api/folder-size', methods=['GET'])
@login_required
def folder_size():
    print("Folder size endpoint was hit!")  # Debugging line
    paths = current_app.config['PATHS']
    video_path = str(paths['video'])
    path = request.args.get('path', default=video_path, type=str)
    size_bytes = get_folder_size(path)
    size_mb = size_bytes / (1024 * 1024)

    if size_mb < 1024:
        rounded_mb = round(size_mb)
        size_pretty = f"{rounded_mb} MB"
    elif size_mb < 1024 * 1024:
        size_gb = size_mb / 1024
        size_pretty = f"{round(size_gb, 1)} GB"
    else:
        size_tb = size_mb / (1024 * 1024)
        size_pretty = f"{round(size_tb, 1)} TB"

    return jsonify({
        "folder": path,
        "size_bytes": size_bytes,
        "size_pretty": size_pretty
    })

@api.route('/api/admin/reset-database', methods=["POST"])
@login_required
def reset_database():
    """Reset selected video and game data while preserving config and user settings"""
    try:
        paths = current_app.config['PATHS']
        payload = request.get_json(silent=True) or {}

        if isinstance(payload, dict) and isinstance(payload.get("options"), dict):
            options = payload["options"]
        elif isinstance(payload, dict):
            options = payload
        else:
            options = {}

        if not options:
            options = {
                "game_suggestions": True,
                "game_links": True,
                "game_metadata": True,
                "game_assets": True,
                "video_views": True,
                "video_metadata": True,
                "videos": True,
                "processed_files": True,
            }

        reset_videos = bool(options.get("videos"))
        reset_processed = bool(options.get("processed_files")) or reset_videos
        reset_game_metadata = bool(options.get("game_metadata"))
        reset_game_links = bool(options.get("game_links")) or reset_game_metadata or reset_videos
        reset_game_assets = bool(options.get("game_assets")) or reset_game_metadata
        reset_video_views = bool(options.get("video_views")) or reset_videos
        reset_video_metadata = bool(options.get("video_metadata"))
        reset_game_suggestions = bool(options.get("game_suggestions"))

        if reset_game_suggestions:
            suggestions_file = paths['data'] / 'game_suggestions.json'
            if suggestions_file.exists():
                suggestions_file.unlink()
                current_app.logger.info("Deleted game_suggestions.json")

        if reset_game_links:
            VideoGameLink.query.delete()
            current_app.logger.info("Deleted all video-game links")

        if reset_game_metadata:
            GameMetadata.query.delete()
            current_app.logger.info("Deleted all game metadata")

        if reset_video_views:
            VideoView.query.delete()
            current_app.logger.info("Deleted all video views")

        if reset_video_metadata and not reset_videos:
            videos_with_info = Video.query.join(VideoInfo).all()
            for video in videos_with_info:
                title = Path(video.path).stem
                db.session.query(VideoInfo).filter_by(video_id=video.video_id).update({
                    "title": title,
                    "description": "",
                })
            current_app.logger.info("Reset video titles and descriptions")

        if reset_videos:
            VideoInfo.query.delete()
            current_app.logger.info("Deleted all video info")
            Video.query.delete()
            current_app.logger.info("Deleted all videos")

        db.session.commit()

        if reset_processed:
            video_links_dir = paths['processed'] / 'video_links'
            derived_dir = paths['processed'] / 'derived'

            if video_links_dir.exists():
                shutil.rmtree(video_links_dir)
                video_links_dir.mkdir()
                current_app.logger.info("Cleared video_links directory")

            if derived_dir.exists():
                shutil.rmtree(derived_dir)
                derived_dir.mkdir()
                current_app.logger.info("Cleared derived directory")

        if reset_game_assets:
            game_assets_dir = paths['data'] / 'game_assets'
            if game_assets_dir.exists():
                shutil.rmtree(game_assets_dir)
                game_assets_dir.mkdir()
                current_app.logger.info("Cleared game_assets directory")

        current_app.logger.info("Database reset complete")
        return jsonify({
            'message': 'Database reset successfully',
            'reset': {
                'game_suggestions': reset_game_suggestions,
                'game_links': reset_game_links,
                'game_metadata': reset_game_metadata,
                'game_assets': reset_game_assets,
                'video_views': reset_video_views,
                'video_metadata': reset_video_metadata,
                'videos': reset_videos,
                'processed_files': reset_processed,
            },
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to reset database: {e}")
        return Response(response=f'Failed to reset database: {str(e)}', status=500)

@api.route('/api/manual/scan')
@login_required
def manual_scan():
    current_app.logger.info(f"Executed manual scan")
    Popen(["fireshare", "bulk-import"], shell=False, start_new_session=True)
    return Response(status=200)

@api.route('/api/manual/scan-dates')
@login_required
def manual_scan_dates():
    """Extract recording dates from filenames for videos missing recorded_at"""
    try:
        videos = Video.query.filter(Video.recorded_at.is_(None)).all()
        dates_extracted = 0
        paths = current_app.config['PATHS']
        videos_path = paths["video"]

        for video in videos:
            video_file_path = videos_path / video.path
            recorded_at = util.extract_date_from_file(video_file_path)
            if recorded_at:
                video.recorded_at = recorded_at
                dates_extracted += 1
                logger.info(f"Extracted date {recorded_at.isoformat()} for video {video.video_id}")

        db.session.commit()

        return jsonify({
            'success': True,
            'videos_scanned': len(videos),
            'dates_extracted': dates_extracted
        }), 200

    except Exception as e:
        logger.error(f"Error scanning for dates: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/api/scan-games/status')
@login_required
def get_game_scan_status():
    """Return current game scan progress"""
    return jsonify({
        'is_running': _game_scan_state['is_running'],
        'current': _game_scan_state['current'],
        'total': _game_scan_state['total'],
        'suggestions_created': _game_scan_state['suggestions_created']
    })

@api.route('/api/folder-suggestions')
@login_required
def get_folder_suggestions():
    """Get all pending folder suggestions"""
    from fireshare.cli import _load_suggestions
    suggestions = _load_suggestions()
    logger.info(f"Loaded suggestions file, keys: {len(suggestions.keys())}")
    folders = suggestions.get('_folders', {})
    logger.info(f"Returning {len(folders)} folder suggestions: {list(folders.keys())}")
    return jsonify(folders)

@api.route('/api/folder-suggestions/<path:folder_name>/dismiss', methods=['POST'])
@login_required
def dismiss_folder_suggestion(folder_name):
    """Dismiss a folder suggestion"""
    from fireshare.cli import _load_suggestions, _save_suggestions

    suggestions = _load_suggestions()
    folder_suggestions = suggestions.get('_folders', {})

    if folder_name not in folder_suggestions:
        logger.warning(f"Folder suggestion not found: {folder_name}")
        return jsonify({'error': 'Folder suggestion not found'}), 404

    video_count = len(folder_suggestions[folder_name].get('video_ids', []))
    del folder_suggestions[folder_name]
    suggestions['_folders'] = folder_suggestions
    _save_suggestions(suggestions)

    logger.info(f"Dismissed folder suggestion: {folder_name} ({video_count} videos)")
    return jsonify({'dismissed': True})


@api.route('/api/folder-rules')
@login_required
def get_folder_rules():
    """Get all folders with their rules and suggested games based on linked videos"""

    # Skip upload folders
    upload_folders = {
        DEFAULT_CONFIG['app_config']['admin_upload_folder_name'].lower(),
        DEFAULT_CONFIG['app_config']['public_upload_folder_name'].lower(),
    }

    # Get existing rules keyed by folder
    rules = {rule.folder_path: rule for rule in FolderRule.query.all()}

    # Build folder -> video_ids and video -> game_id maps
    folders = {}
    video_to_game = {link.video_id: link.game_id for link in VideoGameLink.query.all()}
    games = {g.id: g for g in GameMetadata.query.all()}

    for video in Video.query.all():
        parts = video.path.replace('\\', '/').split('/')
        if len(parts) > 1:
            folder = parts[0]
            if folder.lower() in upload_folders:
                continue
            if folder not in folders:
                folders[folder] = []
            folders[folder].append(video.video_id)

    result = []
    for folder in sorted(folders.keys()):
        video_ids = folders[folder]
        rule = rules.get(folder)

        # Find most common game among linked videos in this folder
        game_counts = Counter(video_to_game[vid] for vid in video_ids if vid in video_to_game)
        suggested_game = None
        if game_counts:
            top_game = games.get(game_counts.most_common(1)[0][0])
            if top_game:
                suggested_game = top_game.json()

        result.append({
            'folder_path': folder,
            'rule': rule.json() if rule else None,
            'suggested_game': suggested_game,
            'video_count': len(video_ids)
        })

    return jsonify(result)


@api.route('/api/folder-rules', methods=['POST'])
@login_required
def create_folder_rule():
    """Create a folder rule and backfill existing untagged videos"""
    from .cli import _load_suggestions, _save_suggestions
    data = request.get_json()

    if not data or not data.get('folder_path') or not data.get('game_id'):
        return jsonify({'error': 'folder_path and game_id are required'}), 400

    folder_path = data['folder_path']
    game_id = data['game_id']

    # Check if rule already exists for this folder
    existing = FolderRule.query.filter_by(folder_path=folder_path).first()
    if existing:
        existing.game_id = game_id
        db.session.commit()
        logger.info(f"Updated folder rule: {folder_path} -> game {game_id}")
        rule = existing
        is_new = False
    else:
        rule = FolderRule(
            folder_path=folder_path,
            game_id=game_id
        )
        db.session.add(rule)
        db.session.commit()
        logger.info(f"Created folder rule: {folder_path} -> game {game_id}")
        is_new = True

    # Tag ALL videos in this folder to the new game (update existing + create new)
    videos_in_folder = Video.query.filter(Video.path.like(f"{folder_path}/%")).all()
    video_ids = [v.video_id for v in videos_in_folder]
    existing_links = {link.video_id: link for link in VideoGameLink.query.filter(VideoGameLink.video_id.in_(video_ids)).all()}

    updated = 0
    created = 0

    for video in videos_in_folder:
        if video.video_id in existing_links:
            # Update existing link to new game
            existing_links[video.video_id].game_id = game_id
            updated += 1
        else:
            # Create new link
            link = VideoGameLink(
                video_id=video.video_id,
                game_id=game_id,
                created_at=datetime.utcnow()
            )
            db.session.add(link)
            created += 1

    if updated or created:
        db.session.commit()
        logger.info(f"Folder '{folder_path}': updated {updated}, created {created} link(s) to game {game_id}")

    # Clear individual suggestions for videos in this folder only
    suggestions = _load_suggestions()
    cleared_suggestions = 0
    video_ids_in_folder = {v.video_id for v in videos_in_folder}
    for video_id in list(suggestions.keys()):
        if video_id in video_ids_in_folder and video_id != '_folders':
            del suggestions[video_id]
            cleared_suggestions += 1
            logger.info(f"[Backfill] Cleared suggestion for {video_id}")
    if cleared_suggestions:
        _save_suggestions(suggestions)
        logger.info(f"Cleared {cleared_suggestions} individual suggestion(s) for folder '{folder_path}'")

    response = rule.json()
    response['backfilled'] = updated + created
    response['cleared_suggestions'] = cleared_suggestions
    return jsonify(response), 201 if is_new else 200


@api.route('/api/folder-rules/<int:rule_id>', methods=['DELETE'])
@login_required
def delete_folder_rule(rule_id):
    """Delete a folder rule, optionally unlinking videos"""
    rule = FolderRule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Folder rule not found'}), 404

    unlink_videos = request.args.get('unlink_videos', 'false').lower() == 'true'
    unlinked_count = 0

    if unlink_videos:
        # Batch query: get only video IDs in folder, then delete matching links in one query
        video_ids = [v[0] for v in db.session.query(Video.video_id).filter(Video.path.like(f"{rule.folder_path}/%")).all()]
        if video_ids:
            unlinked_count = VideoGameLink.query.filter(
                VideoGameLink.video_id.in_(video_ids),
                VideoGameLink.game_id == rule.game_id
            ).delete(synchronize_session=False)

    folder_path = rule.folder_path
    db.session.delete(rule)
    db.session.commit()

    logger.info(f"Deleted folder rule: {folder_path} (unlinked {unlinked_count} videos)")
    return jsonify({'deleted': True, 'unlinked_count': unlinked_count})


@api.route('/api/manual/scan-games')
@login_required
def manual_scan_games():
    """Start game scan in background thread"""
    from fireshare.cli import save_game_suggestions_batch, _load_suggestions

    # Check if already running
    with _game_scan_state['lock']:
        if _game_scan_state['is_running']:
            return jsonify({'already_running': True}), 409
        _game_scan_state['is_running'] = True
        _game_scan_state['current'] = 0
        _game_scan_state['total'] = 0
        _game_scan_state['suggestions_created'] = 0

    # Get app context for background thread
    app = current_app._get_current_object()

    def run_scan():
        with app.app_context():
            try:
                steamgriddb_api_key = get_steamgriddb_api_key()
                logger.info(f"Starting game scan, API key configured: {bool(steamgriddb_api_key)}")

                # Get all videos
                videos = Video.query.join(VideoInfo).all()
                logger.info(f"Found {len(videos)} total videos in database")

                # Load existing suggestions and linked videos upfront (single queries)
                existing_suggestions = _load_suggestions()
                linked_video_ids = {link.video_id for link in VideoGameLink.query.all()}
                existing_folder_suggestions = existing_suggestions.get('_folders', {})
                logger.info(f"Existing suggestions: {len(existing_suggestions) - 1 if '_folders' in existing_suggestions else len(existing_suggestions)} individual, {len(existing_folder_suggestions)} folders")
                logger.info(f"Already linked videos: {len(linked_video_ids)}")

                # Get all unlinked videos for folder grouping
                unlinked_videos = [v for v in videos if v.video_id not in linked_video_ids]
                logger.info(f"Unlinked videos for folder grouping: {len(unlinked_videos)}")

                # Videos needing individual suggestions (not linked and no existing suggestion)
                videos_needing_suggestions = [
                    video for video in unlinked_videos
                    if video.video_id not in existing_suggestions
                ]
                logger.info(f"Videos needing individual suggestions: {len(videos_needing_suggestions)}")

                # Set total for progress tracking
                _game_scan_state['total'] = len(unlinked_videos)

                # If nothing unlinked, we're done
                if not unlinked_videos:
                    logger.info("Game scan complete: no unlinked videos to process")
                    return
                suggestions_created = 0

                # Group ALL unlinked videos by folder (not just those without suggestions)
                folder_videos = {}
                for video in unlinked_videos:
                    normalized_path = video.path.replace('\\', '/')
                    parts = [part for part in normalized_path.split('/') if part]
                    folder = parts[0] if len(parts) > 1 else None
                    if folder:
                        if folder not in folder_videos:
                            folder_videos[folder] = []
                        folder_videos[folder].append(video)

                logger.info(f"Grouped videos into {len(folder_videos)} folders")
                for folder, vids in folder_videos.items():
                    logger.info(f"  Folder '{folder}': {len(vids)} videos")

                # Process folder suggestions (folders with 2+ videos)
                folder_suggestions = existing_suggestions.get('_folders', {})
                processed_video_ids = set()

                # Skip upload folders
                upload_folders = {
                    DEFAULT_CONFIG['app_config']['admin_upload_folder_name'].lower(),
                    DEFAULT_CONFIG['app_config']['public_upload_folder_name'].lower(),
                }

                for folder, folder_vids in folder_videos.items():
                    # Skip upload folders
                    if folder.lower() in upload_folders:
                        logger.info(f"Skipping upload folder '{folder}' for game detection")
                        continue
                    logger.info(f"Processing folder '{folder}': {len(folder_vids)} videos, already in suggestions: {folder in folder_suggestions}")
                    if len(folder_vids) >= 2 and folder not in folder_suggestions:
                        logger.info(f"Attempting game detection for folder: '{folder}'")
                        detected_game = util.detect_game_from_filename(folder, steamgriddb_api_key, path=f"{folder}/")

                        if detected_game:
                            logger.info(f"Detection result for '{folder}': {detected_game['game_name']} (confidence: {detected_game['confidence']:.2f})")
                        else:
                            logger.info(f"No game detected for folder '{folder}'")

                        if detected_game and detected_game['confidence'] >= 0.65:
                            video_ids = [v.video_id for v in folder_vids]
                            folder_suggestions[folder] = {
                                'game_name': detected_game['game_name'],
                                'steamgriddb_id': detected_game.get('steamgriddb_id'),
                                'game_id': detected_game.get('game_id'),
                                'confidence': detected_game['confidence'],
                                'source': detected_game['source'],
                                'video_ids': video_ids,
                                'video_count': len(video_ids)
                            }
                            processed_video_ids.update(video_ids)
                            suggestions_created += 1
                            _game_scan_state['suggestions_created'] = suggestions_created
                            logger.info(f"Created folder suggestion: {folder} -> {detected_game['game_name']} ({len(video_ids)} videos)")
                        elif detected_game:
                            logger.info(f"Skipping folder '{folder}' - confidence {detected_game['confidence']:.2f} below threshold 0.65")

                # Save folder suggestions
                if folder_suggestions:
                    existing_suggestions['_folders'] = folder_suggestions
                    from fireshare.cli import _save_suggestions
                    _save_suggestions(existing_suggestions)

                # Process remaining individual videos (not in folder suggestions and no existing suggestion)
                pending_suggestions = {}
                for i, video in enumerate(videos_needing_suggestions):
                    _game_scan_state['current'] = i + 1

                    if video.video_id in processed_video_ids:
                        continue

                    filename = Path(video.path).stem
                    detected_game = util.detect_game_from_filename(filename, steamgriddb_api_key, path=video.path)

                    if detected_game and detected_game['confidence'] >= 0.65:
                        pending_suggestions[video.video_id] = detected_game
                        suggestions_created += 1
                        _game_scan_state['suggestions_created'] = suggestions_created
                        logger.info(f"Queued game suggestion for video {video.video_id}: {detected_game['game_name']} (confidence: {detected_game['confidence']:.2f}, source: {detected_game['source']})")

                # Batch save all suggestions at once
                if pending_suggestions:
                    save_game_suggestions_batch(pending_suggestions)
                    logger.info(f"Saved {len(pending_suggestions)} suggestion(s) in batch")

                logger.info(f"Game scan complete: {suggestions_created} suggestions created from {len(unlinked_videos)} unlinked videos")

            except Exception as e:
                logger.error(f"Error scanning videos for games: {e}")
            finally:
                # Brief delay so frontend can display the completed status before hiding
                time.sleep(2)
                _game_scan_state['is_running'] = False

    thread = threading.Thread(target=run_scan)
    thread.daemon = True
    thread.start()

    return jsonify({'started': True}), 202

@api.route('/api/videos')
@login_required
def get_videos():
    sort = request.args.get('sort')
    # Check that the sort parameter is one of the allowed values 
    allowed_sorts = [
        'updated_at desc',
        'updated_at asc',
        'video_info.title desc',
        'video_info.title asc',
        'views desc',
        'views asc'
    ]
    if sort not in allowed_sorts:
        return jsonify({"error": "Invalid sort parameter"}), 400      

    if "views" in sort:
        videos = Video.query.join(VideoInfo).all()
    else:
        videos = Video.query.join(VideoInfo).order_by(text(sort)).all()

    videos_json = []
    for v in videos:
        vjson = v.json()
        vjson["view_count"] = VideoView.count(v.video_id)
        videos_json.append(vjson)

    if sort == "views asc":
        videos_json = sorted(videos_json, key=lambda d: d['view_count'])
    if sort == 'views desc':
        videos_json = sorted(videos_json, key=lambda d: d['view_count'], reverse=True)

    return jsonify({"videos": videos_json})

@api.route('/api/video/random')
@login_required
def get_random_video():
    row_count = Video.query.count()
    random_video = Video.query.offset(int(row_count * random.random())).first()
    current_app.logger.info(f"Fetched random video {random_video.video_id}: {random_video.info.title}")
    vjson = random_video.json()
    vjson["view_count"] = VideoView.count(random_video.video_id)
    return jsonify(vjson)

@api.route('/api/video/public/random')
def get_random_public_video():
    row_count =  Video.query.filter(Video.info.has(private=False)).filter_by(available=True).count()
    random_video = Video.query.filter(Video.info.has(private=False)).filter_by(available=True).offset(int(row_count * random.random())).first()
    current_app.logger.info(f"Fetched public random video {random_video.video_id}: {random_video.info.title}")
    vjson = random_video.json()
    vjson["view_count"] = VideoView.count(random_video.video_id)
    return jsonify(vjson)

@api.route('/api/videos/public')
def get_public_videos():
    sort = request.args.get('sort')

    # Check that the sort parameter is one of the allowed values 
    allowed_sorts = [
        'updated_at desc',
        'updated_at asc',
        'video_info.title desc',
        'video_info.title asc',
        'views desc',
        'views asc'
    ]
    if sort not in allowed_sorts:
        return jsonify({"error": "Invalid sort parameter"}), 400        

    if "views" in sort:
        videos = Video.query.join(VideoInfo).filter_by(private=False)
    else:
        videos = Video.query.join(VideoInfo).filter_by(private=False).order_by(text(sort))
    
    videos_json = []
    for v in videos:
        vjson = v.json()
        if (not vjson["available"]):
            continue
        vjson["view_count"] = VideoView.count(v.video_id)
        videos_json.append(vjson)

    if sort == "views asc":
        videos_json = sorted(videos_json, key=lambda d: d['view_count'])
    if sort == 'views desc':
        videos_json = sorted(videos_json, key=lambda d: d['view_count'], reverse=True)

    return jsonify({"videos": videos_json})

@api.route('/api/videos/dates')
def get_video_dates():
    """Get all unique dates that have videos recorded on them"""

    query = db.session.query(func.date(Video.recorded_at)).join(VideoInfo).filter(
        Video.recorded_at.isnot(None),
        Video.available.is_(True)
    )

    if not current_user.is_authenticated:
        query = query.filter(VideoInfo.private.is_(False))

    dates = query.distinct().order_by(func.date(Video.recorded_at).desc()).all()
    return jsonify([str(d[0]) for d in dates if d[0]])

@api.route('/api/videos/by-date/<date>')
def get_videos_by_date(date):
    """Get all videos recorded on a specific date (YYYY-MM-DD)"""

    try:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    query = Video.query.join(VideoInfo).filter(
        func.date(Video.recorded_at) == target_date,
        Video.available.is_(True)
    )

    if not current_user.is_authenticated:
        query = query.filter(VideoInfo.private.is_(False))

    videos = query.order_by(Video.recorded_at.desc()).all()
    videos_json = [{"view_count": VideoView.count(v.video_id), **v.json()} for v in videos]
    return jsonify({"videos": videos_json, "date": date})

@api.route('/api/video/delete/<id>', methods=["DELETE"])
@login_required
def delete_video(id):
    video = Video.query.filter_by(video_id=id).first()
    if video:
        logging.info(f"Deleting video: {video.video_id}")
        
        paths = current_app.config['PATHS']
        file_path = paths['video'] / video.path
        link_path = paths['processed'] / 'video_links' / f"{id}{video.extension}"
        derived_path = paths['processed'] / 'derived' / id
        
        VideoInfo.query.filter_by(video_id=id).delete()
        Video.query.filter_by(video_id=id).delete()
        db.session.commit()
        
        try:
            if file_path.exists():
                file_path.unlink()
                logging.info(f"Deleted video file: {file_path}")
            if link_path.exists() or link_path.is_symlink():
                link_path.unlink()
                logging.info(f"Deleted link file: {link_path}")
            if derived_path.exists():
                shutil.rmtree(derived_path)
                logging.info(f"Deleted derived directory: {derived_path}")
        except OSError as e:
            logging.error(f"Error deleting files for video {id}: {e}")
            logging.error(f"Attempted to delete: file={file_path}, link={link_path}, derived={derived_path}")
        return Response(status=200)
        
    else:
        return Response(status=404, response=f"A video with id: {id}, does not exist.")

@api.route('/api/video/details/<id>', methods=["GET", "PUT"])
def handle_video_details(id):
    if request.method == 'GET':
        # db lookup and get the details title/views/etc
        # video_id = request.args['id']
        video = Video.query.filter_by(video_id=id).first()
        if video:
            vjson = video.json()
            vjson["view_count"] = VideoView.count(video.video_id)
            return jsonify(vjson)
        else:
            return jsonify({
                'message': 'Video not found'
            }), 404
    if request.method == 'PUT':
        if not current_user.is_authenticated:
            return Response(response='You do not have access to this resource.', status=401)
        video_info = VideoInfo.query.filter_by(video_id=id).first()
        if video_info:
            # Handle recorded_at separately since it's on Video model, not VideoInfo
            data = request.json.copy()
            recorded_at = data.pop('recorded_at', None)

            # Update VideoInfo fields
            if data:
                db.session.query(VideoInfo).filter_by(video_id=id).update(data)

            # Update Video.recorded_at if provided
            if recorded_at is not None:
                video = Video.query.filter_by(video_id=id).first()
                if video:
                    if recorded_at == '' or recorded_at is None:
                        video.recorded_at = None
                    else:
                        try:
                            video.recorded_at = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
                        except (ValueError, AttributeError):
                            video.recorded_at = None

            db.session.commit()
            return Response(status=201)
        else:
            return jsonify({
                'message': 'Video details not found'
            }), 404

@api.route('/api/video/poster', methods=['GET'])
def get_video_poster():
    video_id = request.args['id']
    webm_poster_path = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id, "boomerang-preview.webm")
    jpg_poster_path = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id, "poster.jpg")

    if request.args.get('animated'):
        response = send_file(webm_poster_path, mimetype='video/webm')
    else:
        response = send_file(jpg_poster_path, mimetype='image/jpg')

    return add_cache_headers(response, video_id)

@api.route('/api/video/view', methods=['POST'])
def add_video_view():
    video_id = request.json['video_id']
    if request.headers.getlist("X-Forwarded-For"):
        ip_address = request.headers.getlist("X-Forwarded-For")[0].split(",")[0]
    else:
        ip_address = request.remote_addr
    VideoView.add_view(video_id, ip_address)
    return Response(status=200)

@api.route('/api/video/<video_id>/views', methods=['GET'])
def get_video_views(video_id):
    views = VideoView.count(video_id)
    return str(views)


def _launch_scan_video(save_path, config):
    """
    Launch scan-video and publish an initial transcoding-running status when
    auto-transcode is enabled so SSE subscribers can reflect upload-triggered work.
    """
    paths = current_app.config['PATHS']
    data_path = paths['data']
    scan_proc = Popen(["fireshare", "scan-video", f"--path={save_path}"], shell=False, start_new_session=True)

    def reap_and_cleanup():
        try:
            scan_proc.wait()
            status = util.read_transcoding_status(data_path)
            # Clear stale placeholder/status written for this upload process.
            if status.get('pid') == scan_proc.pid:
                util.clear_transcoding_status(data_path)
        except Exception as e:
            logger.debug(f"Scan process cleanup skipped: {e}")

    threading.Thread(target=reap_and_cleanup, daemon=True).start()

    transcoding_enabled = current_app.config.get('ENABLE_TRANSCODING', False)
    auto_transcode = config.get('transcoding', {}).get('auto_transcode', True)
    if transcoding_enabled and auto_transcode:
        try:
            util.write_transcoding_status(data_path, 0, 0, None, scan_proc.pid)
        except Exception as e:
            logger.warning(f"Failed to write initial upload transcoding status: {e}")

    return scan_proc

@api.route('/api/upload/public', methods=['POST'])
def public_upload_video():
    paths = current_app.config['PATHS']
    with open(paths['data'] / 'config.json', 'r') as configfile:
        try:
            config = json.load(configfile)
        except:
            logging.error("Invalid or corrupt config file")
            return Response(status=400)
        configfile.close()
        
    if not config['app_config']['allow_public_upload']:
        logging.warn("A public upload attempt was made but public uploading is disabled")
        return Response(status=401)
    
    upload_folder = config['app_config']['public_upload_folder_name']

    if 'file' not in request.files:
        return Response(status=400)
    file = request.files['file']
    if file.filename == '':
        return Response(status=400)
    filename = secure_filename(file.filename)
    if not filename:
        return Response(status=400)
    filetype = filename.split('.')[-1]
    if not filetype in SUPPORTED_FILE_TYPES:
        return Response(status=400)
    upload_directory = paths['video'] / upload_folder
    if not os.path.exists(upload_directory):
        os.makedirs(upload_directory)
    save_path = os.path.join(upload_directory, filename)
    if (os.path.exists(save_path)):
        name_no_type = ".".join(filename.split('.')[0:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(paths['video'], upload_folder, f"{name_no_type}-{uid}.{filetype}")
    file.save(save_path)
    _launch_scan_video(save_path, config)
    return Response(status=201)

@api.route('/api/uploadChunked/public', methods=['POST'])
def public_upload_videoChunked():
    paths = current_app.config['PATHS']
    with open(paths['data'] / 'config.json', 'r') as configfile:
        try:
            config = json.load(configfile)
        except:
            logging.error("Invalid or corrupt config file")
            return Response(status=400)
        configfile.close()
        
    if not config['app_config']['allow_public_upload']:
        logging.warn("A public upload attempt was made but public uploading is disabled")
        return Response(status=401)
    
    upload_folder = config['app_config']['public_upload_folder_name']

    required_files = ['blob']
    required_form_fields = ['chunkPart', 'totalChunks', 'checkSum']
    if not all(key in request.files for key in required_files) or not all(key in request.form for key in required_form_fields):
        return Response(status=400)   
    blob = request.files.get('blob')
    chunkPart = int(request.form.get('chunkPart'))
    totalChunks = int(request.form.get('totalChunks'))
    checkSum = request.form.get('checkSum')
    if not blob.filename or blob.filename.strip() == '' or blob.filename == 'blob':
        return Response(status=400)
    filename = secure_filename(blob.filename)
    if not filename:
        return Response(status=400)
    filetype = filename.split('.')[-1] # TODO, probe filetype with fmpeg instead and remux to supporrted
    if not filetype in SUPPORTED_FILE_TYPES:
        return Response(status=400)
     
    upload_directory = paths['video'] / upload_folder
    if not os.path.exists(upload_directory):
        os.makedirs(upload_directory) 
    tempPath = os.path.join(upload_directory, f"{checkSum}.{filetype}")
    with open(tempPath, 'ab') as f:
        f.write(blob.read())
    if chunkPart < totalChunks:
        return Response(status=202)
    
    save_path = os.path.join(upload_directory, filename)

    if (os.path.exists(save_path)):
        name_no_type = ".".join(filename.split('.')[0:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(paths['video'], upload_folder, f"{name_no_type}-{uid}.{filetype}")
    
    os.rename(tempPath, save_path)
    _launch_scan_video(save_path, config)
    return Response(status=201)

@api.route('/api/upload', methods=['POST'])
@login_required
def upload_video():
    paths = current_app.config['PATHS']
    with open(paths['data'] / 'config.json', 'r') as configfile:
        try:
            config = json.load(configfile)
        except:
            return Response(status=500, response="Invalid or corrupt config file")
        configfile.close()
    
    upload_folder = config['app_config']['admin_upload_folder_name']

    if 'file' not in request.files:
        return Response(status=400)
    file = request.files['file']
    if file.filename == '':
        return Response(status=400)
    filename = secure_filename(file.filename)
    if not filename:
        return Response(status=400)
    filetype = filename.split('.')[-1]
    if not filetype in SUPPORTED_FILE_TYPES:
        return Response(status=400)
    upload_directory = paths['video'] / upload_folder
    if not os.path.exists(upload_directory):
        os.makedirs(upload_directory)
    save_path = os.path.join(upload_directory, filename)
    if (os.path.exists(save_path)):
        name_no_type = ".".join(filename.split('.')[0:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(paths['video'], upload_folder, f"{name_no_type}-{uid}.{filetype}")
    file.save(save_path)
    _launch_scan_video(save_path, config)
    return Response(status=201)

@api.route('/api/uploadChunked', methods=['POST'])
@login_required
def upload_videoChunked():
    paths = current_app.config['PATHS']
    with open(paths['data'] / 'config.json', 'r') as configfile:
        try:
            config = json.load(configfile)
        except:
            return Response(status=500, response="Invalid or corrupt config file")
        configfile.close()
    
    upload_folder = config['app_config']['admin_upload_folder_name']

    required_files = ['blob']
    required_form_fields = ['chunkPart', 'totalChunks', 'checkSum', 'fileName', 'fileSize']

    if not all(key in request.files for key in required_files) or not all(key in request.form for key in required_form_fields):
        return Response(status=400)
        
    blob = request.files.get('blob')
    chunkPart = int(request.form.get('chunkPart'))
    totalChunks = int(request.form.get('totalChunks'))
    checkSum = request.form.get('checkSum')
    fileName = secure_filename(request.form.get('fileName'))
    fileSize = int(request.form.get('fileSize'))
    
    if not fileName:
        return Response(status=400)
    
    filetype = fileName.split('.')[-1]
    if not filetype in SUPPORTED_FILE_TYPES:
        return Response(status=400)
    
    upload_directory = paths['video'] / upload_folder
    if not os.path.exists(upload_directory):
        os.makedirs(upload_directory)
    
    # Store chunks with part number to ensure proper ordering
    tempPath = os.path.join(upload_directory, f"{checkSum}.part{chunkPart:04d}")
    
    # Write this specific chunk
    with open(tempPath, 'wb') as f:
        f.write(blob.read())

    # Check if we have all chunks
    chunk_files = []
    for i in range(1, totalChunks + 1):
        chunk_path = os.path.join(upload_directory, f"{checkSum}.part{i:04d}")
        if os.path.exists(chunk_path):
            chunk_files.append(chunk_path)
    
    # If we don't have all chunks yet, return 202
    if len(chunk_files) != totalChunks:
        return Response(status=202)

    # All chunks received, reassemble the file
    save_path = os.path.join(upload_directory, fileName)
    
    if os.path.exists(save_path):
        name_no_type = ".".join(fileName.split('.')[0:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(upload_directory, f"{name_no_type}-{uid}.{filetype}")

    # Reassemble chunks in correct order
    try:
        with open(save_path, 'wb') as output_file:
            for i in range(1, totalChunks + 1):
                chunk_path = os.path.join(upload_directory, f"{checkSum}.part{i:04d}")
                with open(chunk_path, 'rb') as chunk_file:
                    output_file.write(chunk_file.read())
                # Clean up chunk file
                os.remove(chunk_path)
        
        # Verify file size
        if os.path.getsize(save_path) != fileSize:
            os.remove(save_path)
            return Response(status=500, response="File size mismatch after reassembly")
            
    except Exception as e:
        # Clean up on error
        for chunk_path in chunk_files:
            if os.path.exists(chunk_path):
                os.remove(chunk_path)
        if os.path.exists(save_path):
            os.remove(save_path)
        return Response(status=500, response="Error reassembling file")

    _launch_scan_video(save_path, config)
    return Response(status=201)

@api.route('/api/video')
def get_video():
    video_id = request.args.get('id')
    subid = request.args.get('subid')
    quality = request.args.get('quality')  # Support quality parameter (720p, 1080p)
    video_path = get_video_path(video_id, subid, quality)
    file_size = os.stat(video_path).st_size
    start = 0
    length = 10240

    range_header = request.headers.get('Range', None)
    if range_header:
        m = re.search('([0-9]+)-([0-9]*)', range_header)
        g = m.groups()
        byte1, byte2 = 0, None
        if g[0]:
            byte1 = int(g[0])
        if g[1]:
            byte2 = int(g[1])
        if byte1 < file_size:
            start = byte1
        if byte2:
            length = byte2 + 1 - byte1
        else:
            length = file_size - start

    with open(video_path, 'rb') as f:
        f.seek(start)
        chunk = f.read(length)

    rv = Response(chunk, 206, mimetype='video/mp4', content_type='video/mp4', direct_passthrough=True)
    rv.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, file_size))
    return rv

@api.route('/api/steamgrid/search', methods=["GET"])
def search_steamgrid():
    query = request.args.get('query')
    if not query:
        return Response(status=400, response='Query parameter is required.')

    api_key = get_steamgriddb_api_key()
    if not api_key:
        return Response(status=503, response='SteamGridDB API key not configured.')

    client = SteamGridDBClient(api_key)

    results = client.search_games(query)
    return jsonify(results)

@api.route('/api/steamgrid/game/<int:game_id>/assets', methods=["GET"])
def get_steamgrid_assets(game_id):
    api_key = get_steamgriddb_api_key()
    if not api_key:
        return Response(status=503, response='SteamGridDB API key not configured.')

    client = SteamGridDBClient(api_key)

    assets = client.get_game_assets(game_id)
    return jsonify(assets)

@api.route('/api/steamgrid/game/<int:game_id>/assets/options', methods=["GET"])
def get_steamgrid_asset_options(game_id):
    api_key = get_steamgriddb_api_key()
    if not api_key:
        return Response(status=503, response='SteamGridDB API key not configured.')

    client = SteamGridDBClient(api_key)
    options = client.get_all_asset_options(game_id)
    return jsonify(options)

@api.route('/api/games/<int:steamgriddb_id>/assets', methods=["PUT"])
@login_required
def update_game_asset(steamgriddb_id):
    import tempfile

    data = request.get_json()
    if not data:
        return Response(status=400, response='Request body required.')

    asset_type = data.get('asset_type')
    url = data.get('url')

    if asset_type not in ('hero', 'banner', 'logo', 'icon'):
        return Response(status=400, response='asset_type must be hero, banner, logo, or icon.')
    if not url:
        return Response(status=400, response='url is required.')

    game = GameMetadata.query.filter_by(steamgriddb_id=steamgriddb_id).first()
    if not game:
        return Response(status=404, response='Game not found.')

    api_key = get_steamgriddb_api_key()
    if not api_key:
        return Response(status=503, response='SteamGridDB API key not configured.')

    client = SteamGridDBClient(api_key)
    ext = client._get_extension_from_url(url)
    slot_map = {'hero': 'hero_1', 'banner': 'hero_2', 'logo': 'logo_1', 'icon': 'icon_1'}
    base_name = slot_map[asset_type]

    paths = current_app.config['PATHS']
    asset_dir = paths['data'] / 'game_assets' / str(steamgriddb_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    # Remove existing files for this slot (any extension)
    for existing in asset_dir.glob(f'{base_name}.*'):
        try:
            existing.unlink()
        except OSError as e:
            current_app.logger.warning(f'Could not remove old asset {existing}: {e}')

    dest_path = asset_dir / f'{base_name}{ext}'

    # Download to temp file first, then move to final location
    temp_dir = Path(tempfile.mkdtemp())
    try:
        temp_path = temp_dir / f'{base_name}{ext}'
        success = client._download_asset(url, temp_path)
        if not success:
            return Response(status=502, response='Failed to download asset from SteamGridDB.')
        import shutil
        shutil.move(str(temp_path), str(dest_path))
    finally:
        if temp_dir.exists():
            import shutil
            shutil.rmtree(temp_dir)

    return Response(status=200)

@api.route('/api/games', methods=["GET"])
def get_games():

    # If user is authenticated, show games that have at least one linked video
    if current_user.is_authenticated:
        games = (
            db.session.query(GameMetadata)
            .join(VideoGameLink)
            .join(Video)
            .distinct()
            .order_by(GameMetadata.name)
            .all()
        )
    else:
        # For public users, only show games that have at least one public (available) video
        games = (
            db.session.query(GameMetadata)
            .join(VideoGameLink)
            .join(Video)
            .join(VideoInfo)
            .filter(
                Video.available.is_(True),
                VideoInfo.private.is_(False),
            )
            .distinct()
            .order_by(GameMetadata.name)
            .all()
        )

    paths = current_app.config['PATHS']
    result = []
    for game in games:
        data = game.json()
        if game.steamgriddb_id:
            asset_dir = paths['data'] / 'game_assets' / str(game.steamgriddb_id)
            for base, key in [('hero_1', 'hero_url'), ('hero_2', 'banner_url'), ('logo_1', 'logo_url'), ('icon_1', 'icon_url')]:
                found = find_asset_with_extensions(asset_dir, base)
                if found and data.get(key):
                    data[key] = data[key] + f'?v={int(found.stat().st_mtime)}'
        result.append(data)
    resp = jsonify(result)
    resp.headers['Cache-Control'] = 'no-store'
    return resp

@api.route('/api/games', methods=["POST"])
@login_required_unless_public_game_tag
def create_game():
    data = request.json

    if not data or not data.get('name'):
        return Response(status=400, response='Game name is required.')

    if not data.get('steamgriddb_id'):
        return Response(status=400, response='SteamGridDB ID is required.')

    existing_game = GameMetadata.query.filter_by(steamgriddb_id=data['steamgriddb_id']).first()
    if existing_game:
        updated = False
        if data.get('name') and data['name'] != existing_game.name:
            existing_game.name = data['name']
            updated = True
        if data.get('release_date') and data.get('release_date') != existing_game.release_date:
            existing_game.release_date = data['release_date']
            updated = True
        if updated:
            existing_game.updated_at = datetime.utcnow()
            db.session.commit()
        return jsonify(existing_game.json()), 200

    # Get API key and initialize client
    api_key = get_steamgriddb_api_key()
    if not api_key:
        return Response(status=503, response='SteamGridDB API key not configured.')

    client = SteamGridDBClient(api_key)

    # Download and save assets
    paths = current_app.config['PATHS']
    game_assets_dir = paths['data'] / 'game_assets'

    result = client.download_and_save_assets(data['steamgriddb_id'], game_assets_dir)

    if not result['success']:
        current_app.logger.error(f"Failed to download assets for game {data['name']}: {result['error']}")
        return Response(
            status=500,
            response=f"Failed to download game assets: {result['error']}"
        )

    # Re-check for existing game after asset download (handles race condition)
    existing_game = GameMetadata.query.filter_by(steamgriddb_id=data['steamgriddb_id']).first()
    if existing_game:
        current_app.logger.info(f"Game {data['name']} was created by another request, returning existing")
        return jsonify(existing_game.json()), 200

    # Create game metadata (without URL fields - they will be constructed dynamically)
    game = GameMetadata(
        steamgriddb_id=data['steamgriddb_id'],
        name=data['name'],
        release_date=data.get('release_date'),
        # Do NOT set hero_url, logo_url, icon_url - they will be constructed dynamically
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.session.add(game)
    db.session.commit()

    current_app.logger.info(f"Created game {data['name']} with assets: {result['assets']}")

    response_data = game.json()
    missing = [k for k, v in result['assets'].items() if v == 0]
    if missing:
        response_data['missing_assets'] = missing

    return jsonify(response_data), 201

@api.route('/api/videos/<video_id>/game', methods=["POST"])
@login_required_unless_public_game_tag
def link_video_to_game(video_id):
    data = request.json

    if not data or not data.get('game_id'):
        return Response(status=400, response='Game ID is required.')

    video = Video.query.filter_by(video_id=video_id).first()
    if not video:
        return Response(status=404, response='Video not found.')

    game = GameMetadata.query.get(data['game_id'])
    if not game:
        return Response(status=404, response='Game not found.')

    existing_link = VideoGameLink.query.filter_by(video_id=video_id).first()
    if existing_link:
        existing_link.game_id = data['game_id']
        existing_link.created_at = datetime.utcnow()
    else:
        link = VideoGameLink(
            video_id=video_id,
            game_id=data['game_id'],
            created_at=datetime.utcnow()
        )
        db.session.add(link)

    db.session.commit()

    return jsonify({"video_id": video_id, "game_id": data['game_id']}), 201

@api.route('/api/videos/<video_id>/game', methods=["GET"])
def get_video_game(video_id):
    link = VideoGameLink.query.filter_by(video_id=video_id).first()
    if not link:
        return jsonify(None)
    data = link.game.json()
    if link.game.steamgriddb_id:
        paths = current_app.config['PATHS']
        asset_dir = paths['data'] / 'game_assets' / str(link.game.steamgriddb_id)
        for base, key in [('hero_1', 'hero_url'), ('hero_2', 'banner_url'), ('logo_1', 'logo_url'), ('icon_1', 'icon_url')]:
            found = find_asset_with_extensions(asset_dir, base)
            if found and data.get(key):
                data[key] = data[key] + f'?v={int(found.stat().st_mtime)}'
    resp = jsonify(data)
    resp.headers['Cache-Control'] = 'no-store'
    return resp

@api.route('/api/videos/<video_id>/game', methods=["DELETE"])
@login_required_unless_public_game_tag
def unlink_video_from_game(video_id):
    link = VideoGameLink.query.filter_by(video_id=video_id).first()
    if not link:
        return Response(status=404, response='Video is not linked to any game.')

    db.session.delete(link)
    db.session.commit()

    return Response(status=204)

def find_asset_with_extensions(asset_dir, base_name):
    """Try to find an asset file with any supported extension."""
    for ext in ['.png', '.jpg', '.jpeg', '.webp']:
        path = asset_dir / f'{base_name}{ext}'
        if path.exists():
            return path
    return None

@api.route('/api/game/assets/<int:steamgriddb_id>/<filename>')
def get_game_asset(steamgriddb_id, filename):
    # Validate filename to prevent path traversal
    if not re.match(r'^(hero_[12]|logo_1|icon_1)\.(png|jpg|jpeg|webp)$', filename):
        return Response(status=400, response='Invalid filename.')

    paths = current_app.config['PATHS']
    asset_dir = paths['data'] / 'game_assets' / str(steamgriddb_id)
    base_name = filename.rsplit('.', 1)[0]

    # Optional fallback parameter (e.g., ?fallback=hero_1)
    fallback = request.args.get('fallback')
    if fallback and not re.match(r'^(hero_[12]|logo_1|icon_1)$', fallback):
        fallback = None  # Invalid fallback, ignore it

    asset_path = paths['data'] / 'game_assets' / str(steamgriddb_id) / filename

    # Try exact filename first
    if not asset_path.exists():
        # Try other extensions for the requested asset
        if asset_dir.exists():
            found = find_asset_with_extensions(asset_dir, base_name)
            if found:
                asset_path = found

    # If still not found and fallback is specified, try the fallback asset
    if not asset_path.exists() and fallback:
        logger.info(f"{base_name} not found for game {steamgriddb_id}, trying fallback: {fallback}")
        if asset_dir.exists():
            found = find_asset_with_extensions(asset_dir, fallback)
            if found:
                asset_path = found

    # If asset still doesn't exist, try to re-download from SteamGridDB
    if not asset_path.exists():
        logger.warning(f"{filename} missing for game {steamgriddb_id}")
        api_key = get_steamgriddb_api_key()
        if api_key:
            client = SteamGridDBClient(api_key)
            game_assets_dir = paths['data'] / 'game_assets'

            logger.info(f"Downloading assets for game {steamgriddb_id}")
            result = client.download_and_save_assets(steamgriddb_id, game_assets_dir)

            if result.get('success'):
                logger.info(f"Assets downloaded for game {steamgriddb_id}: {result.get('assets')}")
                # Try to find the requested file after re-download
                found = find_asset_with_extensions(asset_dir, base_name)
                if found:
                    asset_path = found
                    logger.info(f"Found {asset_path.name}")
                # If still not found, try fallback after re-download
                elif fallback:
                    found = find_asset_with_extensions(asset_dir, fallback)
                    if found:
                        asset_path = found
                        logger.info(f"Found fallback {asset_path.name}")
            else:
                logger.error(f"Download failed for game {steamgriddb_id}: {result.get('error')}")
        else:
            logger.warning(f"Download failed for game {steamgriddb_id}: No SteamGridDB API key configured")

    if not asset_path.exists():
        return Response(status=404, response='Asset not found.')

    # Determine MIME type from extension
    ext = asset_path.suffix.lower()
    mime_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
    }
    mime_type = mime_types.get(ext, 'image/png')

    response = send_file(asset_path, mimetype=mime_type)
    stat = asset_path.stat()
    etag = f"{steamgriddb_id}-{filename}-{int(stat.st_mtime)}-{stat.st_size}"
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['ETag'] = f'"{etag}"'
    return response

@api.route('/api/games/<int:steamgriddb_id>/videos', methods=["GET"])
def get_game_videos(steamgriddb_id):

    game = GameMetadata.query.filter_by(steamgriddb_id=steamgriddb_id).first()
    if not game:
        return Response(status=404, response='Game not found.')

    videos_json = []
    for link in game.videos:
        if not link.video:
            continue

        if not current_user.is_authenticated:
            # Only show available, non-private videos to public users
            if not link.video.available:
                continue
            if not link.video.info or link.video.info.private:
                continue

        vjson = link.video.json()
        vjson["view_count"] = VideoView.count(link.video_id)
        videos_json.append(vjson)

    return jsonify(videos_json)

@api.route('/api/games/<int:steamgriddb_id>', methods=["DELETE"])
@login_required
def delete_game(steamgriddb_id):
    """
    Delete a game and optionally all associated videos.
    Query param: delete_videos (boolean) - if true, also delete all videos linked to this game
    """
    game = GameMetadata.query.filter_by(steamgriddb_id=steamgriddb_id).first()
    if not game:
        return Response(status=404, response='Game not found.')

    delete_videos = request.args.get('delete_videos', 'false').lower() == 'true'

    logger.info(f"Deleting game {game.name} (steamgriddb_id: {steamgriddb_id}), delete_videos={delete_videos}")

    # Get all video links for this game
    video_links = VideoGameLink.query.filter_by(game_id=game.id).all()

    if delete_videos and video_links:
        # Delete all associated videos
        paths = current_app.config['PATHS']
        for link in video_links:
            video = link.video
            if video is None:
                # Orphaned link - just delete it
                db.session.delete(link)
                continue
            logger.info(f"Deleting video: {video.video_id}")

            file_path = paths['video'] / video.path
            link_path = paths['processed'] / 'video_links' / f"{video.video_id}{video.extension}"
            derived_path = paths['processed'] / 'derived' / video.video_id

            # Delete from database
            VideoGameLink.query.filter_by(video_id=video.video_id).delete()
            VideoView.query.filter_by(video_id=video.video_id).delete()
            VideoInfo.query.filter_by(video_id=video.video_id).delete()
            Video.query.filter_by(video_id=video.video_id).delete()

            # Delete files
            try:
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Deleted video file: {file_path}")
                if link_path.exists() or link_path.is_symlink():
                    link_path.unlink()
                    logger.info(f"Deleted link file: {link_path}")
                if derived_path.exists():
                    shutil.rmtree(derived_path)
                    logger.info(f"Deleted derived directory: {derived_path}")
            except OSError as e:
                logger.error(f"Error deleting files for video {video.video_id}: {e}")
    else:
        # Just unlink videos from the game
        for link in video_links:
            db.session.delete(link)

    # Delete game assets
    paths = current_app.config['PATHS']
    game_assets_dir = paths['data'] / 'game_assets' / str(steamgriddb_id)
    if game_assets_dir.exists():
        try:
            shutil.rmtree(game_assets_dir)
            logger.info(f"Deleted game assets directory: {game_assets_dir}")
        except OSError as e:
            logger.error(f"Error deleting game assets for {steamgriddb_id}: {e}")

    # Delete game from database
    db.session.delete(game)
    db.session.commit()

    logger.info(f"Successfully deleted game {game.name}")
    return Response(status=200)

@api.route('/api/videos/<video_id>/game/suggestion', methods=["GET"])
def get_video_game_suggestion(video_id):
    """Get automatic game detection suggestion for a video"""
    from fireshare.cli import get_game_suggestion

    # Check if video is already linked to a game
    existing_link = VideoGameLink.query.filter_by(video_id=video_id).first()
    if existing_link:
        return jsonify(None)

    suggestion = get_game_suggestion(video_id)
    if not suggestion:
        return jsonify(None)

    return jsonify({
        'video_id': video_id,
        'game_id': suggestion.get('game_id'),
        'game_name': suggestion.get('game_name'),
        'steamgriddb_id': suggestion.get('steamgriddb_id'),
        'confidence': suggestion.get('confidence'),
        'source': suggestion.get('source')
    })

@api.route('/api/videos/<video_id>/game/suggestion', methods=["DELETE"])
@login_required_unless_public_game_tag
def reject_game_suggestion(video_id):
    """User rejected the game suggestion - remove from storage"""
    from fireshare.cli import delete_game_suggestion

    if delete_game_suggestion(video_id):
        logger.info(f"User rejected game suggestion for video {video_id}")

    return Response(status=204)

@api.route('/api/videos/corrupt', methods=["GET"])
@login_required
def get_corrupt_videos():
    """Get a list of all videos marked as corrupt"""
    from fireshare.cli import get_all_corrupt_videos
    
    corrupt_video_ids = get_all_corrupt_videos()
    
    # Get video details for all corrupt videos in a single query
    video_info_map = {}
    if corrupt_video_ids:
        video_infos = VideoInfo.query.filter(VideoInfo.video_id.in_(corrupt_video_ids)).all()
        video_info_map = {vi.video_id: vi for vi in video_infos}
    
    corrupt_videos = []
    for video_id in corrupt_video_ids:
        vi = video_info_map.get(video_id)
        if vi:
            corrupt_videos.append({
                'video_id': video_id,
                'title': vi.title,
                'path': vi.video.path if vi.video else None
            })
        else:
            # Video may have been deleted but still in corrupt list
            corrupt_videos.append({
                'video_id': video_id,
                'title': None,
                'path': None
            })
    return jsonify(corrupt_videos)

@api.route('/api/videos/<video_id>/corrupt', methods=["DELETE"])
@login_required
def clear_corrupt_status(video_id):
    """Clear the corrupt status for a specific video so it can be retried"""
    from fireshare.cli import clear_video_corrupt, is_video_corrupt
    
    if not is_video_corrupt(video_id):
        return Response(status=400, response="Video is not marked as corrupt")
    
    clear_video_corrupt(video_id)
    return Response(status=204)

@api.route('/api/videos/corrupt/clear-all', methods=["DELETE"])
@login_required
def clear_all_corrupt_status():
    """Clear the corrupt status for all videos so they can be retried"""
    from fireshare.cli import clear_all_corrupt_videos
    
    count = clear_all_corrupt_videos()
    return jsonify({'cleared': count})

@api.route('/api/feed/rss')
def rss_feed():
    # Base URL for API calls (backend)
    backend_domain = f"https://{current_app.config['DOMAIN']}" if current_app.config['DOMAIN'] else request.host_url.rstrip('/')
    
    # URL for viewing (frontend)
    # If we are on localhost:5000, the user wants both the link and video to point to the public dev port (3000)
    frontend_domain = backend_domain
    if "localhost:3001" in frontend_domain:
        frontend_domain = frontend_domain.replace("localhost:3001", "localhost:3000")
    elif "127.0.0.1:3001" in frontend_domain:
        frontend_domain = frontend_domain.replace("127.0.0.1:3001", "localhost:3000")

    # Load custom RSS config if it exists
    paths = current_app.config['PATHS']
    config_path = paths['data'] / 'config.json'
    rss_title = "Fireshare Feed"
    rss_description = "Latest videos from Fireshare"
    if config_path.exists():
        try:
            with config_path.open() as f:
                config = json.load(f)
                rss_title = config.get("rss_config", {}).get("title", rss_title)
                rss_description = config.get("rss_config", {}).get("description", rss_description)
        except:
            pass

    # Only show public and available videos
    videos = Video.query.join(VideoInfo).filter(
        VideoInfo.private.is_(False),
        Video.available.is_(True)
    ).order_by(Video.created_at.desc()).limit(50).all()
    
    rss_items = []
    for video in videos:
        # Construct URLs
        link = f"{frontend_domain}/#/w/{video.video_id}"
        # Point both player link and video stream to the frontend port (3000) as requested
        video_url = f"{frontend_domain}/api/video?id={video.video_id}"
        poster_url = f"{frontend_domain}/api/video/poster?id={video.video_id}"
        
        # XML escaping for description and title is handled by Jinja2 by default, 
        # but we should ensure dates are in RFC 822 format.
        item = {
            'title': video.info.title if video.info else video.video_id,
            'link': link,
            'description': video.info.description if video.info and video.info.description else f"Video: {video.info.title if video.info else video.video_id}",
            'pubDate': video.created_at.strftime('%a, %d %b %Y %H:%M:%S +0000') if video.created_at else '',
            'guid': video.video_id,
            'enclosure': {
                'url': video_url,
                'type': 'video/mp4' # Or appropriate mimetype
            },
            'media_thumbnail': poster_url
        }
        rss_items.append(item)
    
    now_str = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')
    
    return Response(
        render_template('rss.xml', items=rss_items, domain=frontend_domain, now=now_str, feed_title=rss_title, feed_description=rss_description),
        mimetype='application/rss+xml'
    )

@api.after_request
def after_request(response):
    response.headers.add('Accept-Ranges', 'bytes')
    return response
