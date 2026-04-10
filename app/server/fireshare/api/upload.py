import json
import logging
import os
import random
import re
import string
import threading
from subprocess import Popen

from flask import current_app, jsonify, request, Response
from flask_login import login_required

from .. import logger, util
from ..constants import SUPPORTED_FILE_TYPES
from . import api
from .helpers import secure_filename
from . import transcoding as _transcoding_mod


def _parse_upload_metadata():
    """Return (tag_ids, game_id, title) parsed from current request form data."""
    tag_ids_raw = request.form.get('tag_ids', '')
    tag_ids = [int(t) for t in tag_ids_raw.split(',') if t.strip().isdigit()] or None
    game_id_raw = request.form.get('game_id', '')
    game_id = int(game_id_raw) if game_id_raw.strip().isdigit() else None
    title = request.form.get('title', '').strip() or None
    return tag_ids, game_id, title


def _launch_scan_video(save_path, config, tag_ids=None, game_id=None, title=None):
    """
    Launch scan-video and publish an initial transcoding-running status when
    auto-transcode is enabled so SSE subscribers can reflect upload-triggered work.
    Optionally apply tag_ids and game_id to the video after the scan completes.
    """
    paths = current_app.config['PATHS']
    data_path = paths['data']
    videos_path = paths['video']
    app = current_app._get_current_object()
    cmd = ["fireshare", "scan-video", f"--path={save_path}"]
    if tag_ids:
        cmd.append(f"--tag-ids={','.join(str(t) for t in tag_ids)}")
    if game_id:
        cmd.append(f"--game-id={game_id}")
    if title:
        cmd.append(f"--title={title}")
    scan_proc = Popen(cmd, shell=False, start_new_session=True)

    def reap_and_cleanup():
        try:
            scan_proc.wait()
            status = util.read_transcoding_status(data_path)
            if status.get('pid') == scan_proc.pid:
                util.clear_transcoding_status(data_path)
        except Exception as e:
            logger.debug(f"Scan process cleanup skipped: {e}")

    threading.Thread(target=reap_and_cleanup, daemon=True).start()

    transcoding_enabled = current_app.config.get('ENABLE_TRANSCODING', False)
    auto_transcode = config.get('transcoding', {}).get('auto_transcode', True)
    transcode_already_running = _transcoding_mod._transcoding_process is not None and _transcoding_mod._transcoding_process.poll() is None
    if transcoding_enabled and auto_transcode and not transcode_already_running:
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
    if config['app_config'].get('allow_public_folder_selection', False):
        requested_folder = request.form.get('folder', '').strip()
        if requested_folder and '/' not in requested_folder and '..' not in requested_folder:
            upload_folder = requested_folder

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
    _launch_scan_video(save_path, config, *_parse_upload_metadata())
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
    required_form_fields = ['chunkPart', 'totalChunks', 'checkSum', 'fileSize']
    if not all(key in request.files for key in required_files) or not all(key in request.form for key in required_form_fields):
        return Response(status=400)
    blob = request.files.get('blob')
    chunkPart = int(request.form.get('chunkPart'))
    totalChunks = int(request.form.get('totalChunks'))
    checkSum = re.sub(r'[^a-zA-Z0-9_-]', '', request.form.get('checkSum'))
    fileSize = int(request.form.get('fileSize'))
    if not checkSum:
        return Response(status=400)
    if not blob.filename or blob.filename.strip() == '' or blob.filename == 'blob':
        return Response(status=400)
    filename = secure_filename(blob.filename)
    if not filename:
        return Response(status=400)
    filetype = filename.split('.')[-1]  # TODO, probe filetype with fmpeg instead and remux to supporrted
    if not filetype in SUPPORTED_FILE_TYPES:
        return Response(status=400)

    if config['app_config'].get('allow_public_folder_selection', False):
        requested_folder = request.form.get('folder', '').strip()
        if requested_folder and '/' not in requested_folder and '..' not in requested_folder:
            upload_folder = requested_folder

    upload_directory = paths['video'] / upload_folder
    if not os.path.exists(upload_directory):
        os.makedirs(upload_directory)

    tempPath = os.path.join(upload_directory, f"{checkSum}.part{chunkPart:04d}")
    # Guard against path traversal: ensure the resolved path stays within upload_directory
    if not os.path.realpath(tempPath).startswith(os.path.realpath(upload_directory) + os.sep):
        return Response(status=400)

    with open(tempPath, 'wb') as f:
        f.write(blob.read())

    # Check if we have all chunks
    chunk_files = []
    for i in range(1, totalChunks + 1):
        chunk_path = os.path.join(upload_directory, f"{checkSum}.part{i:04d}")
        if os.path.exists(chunk_path):
            chunk_files.append(chunk_path)

    if len(chunk_files) != totalChunks:
        return Response(status=202)

    save_path = os.path.join(upload_directory, filename)

    if os.path.exists(save_path):
        name_no_type = ".".join(filename.split('.')[0:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(paths['video'], upload_folder, f"{name_no_type}-{uid}.{filetype}")

    try:
        with open(save_path, 'wb') as output_file:
            for i in range(1, totalChunks + 1):
                chunk_path = os.path.join(upload_directory, f"{checkSum}.part{i:04d}")
                with open(chunk_path, 'rb') as chunk_file:
                    output_file.write(chunk_file.read())
                os.remove(chunk_path)

        if os.path.getsize(save_path) != fileSize:
            os.remove(save_path)
            return Response(status=500, response="File size mismatch after reassembly")

    except Exception:
        for chunk_path in chunk_files:
            if os.path.exists(chunk_path):
                os.remove(chunk_path)
        if os.path.exists(save_path):
            os.remove(save_path)
        return Response(status=500, response="Error reassembling file")

    _launch_scan_video(save_path, config, *_parse_upload_metadata())
    return Response(status=201)


@api.route('/api/upload-folders', methods=['GET'])
@login_required
def get_upload_folders():
    paths = current_app.config['PATHS']
    video_path = paths['video']
    folders = []
    try:
        for entry in os.scandir(video_path):
            if entry.is_dir() and not entry.name.startswith('.'):
                folders.append(entry.name)
        folders.sort()
    except Exception:
        pass
    default_folder = None
    try:
        with open(paths['data'] / 'config.json', 'r') as configfile:
            config = json.load(configfile)
        default_folder = config['app_config']['admin_upload_folder_name']
    except Exception:
        pass
    return jsonify({'folders': folders, 'default_folder': default_folder})


@api.route('/api/upload-folders/public', methods=['GET'])
def get_public_upload_folders():
    paths = current_app.config['PATHS']
    try:
        with open(paths['data'] / 'config.json', 'r') as configfile:
            config = json.load(configfile)
    except Exception:
        return jsonify({'folders': [], 'default_folder': None})

    if not config.get('app_config', {}).get('allow_public_folder_selection', False):
        return Response(status=403)

    video_path = paths['video']
    folders = []
    try:
        for entry in os.scandir(video_path):
            if entry.is_dir() and not entry.name.startswith('.'):
                folders.append(entry.name)
        folders.sort()
    except Exception:
        pass

    default_folder = config['app_config'].get('public_upload_folder_name')
    return jsonify({'folders': folders, 'default_folder': default_folder})


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
    requested_folder = request.form.get('folder', '').strip()
    if requested_folder and '/' not in requested_folder and '..' not in requested_folder:
        upload_folder = requested_folder

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
    _launch_scan_video(save_path, config, *_parse_upload_metadata())
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
    requested_folder = request.form.get('folder', '').strip()
    if requested_folder and '/' not in requested_folder and '..' not in requested_folder:
        upload_folder = requested_folder

    required_files = ['blob']
    required_form_fields = ['chunkPart', 'totalChunks', 'checkSum', 'fileName', 'fileSize']

    if not all(key in request.files for key in required_files) or not all(key in request.form for key in required_form_fields):
        return Response(status=400)

    blob = request.files.get('blob')
    chunkPart = int(request.form.get('chunkPart'))
    totalChunks = int(request.form.get('totalChunks'))
    checkSum = re.sub(r'[^a-zA-Z0-9_-]', '', request.form.get('checkSum'))
    fileName = secure_filename(request.form.get('fileName'))
    fileSize = int(request.form.get('fileSize'))

    if not checkSum:
        return Response(status=400)

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
    # Guard against path traversal: ensure the resolved path stays within upload_directory
    if not os.path.realpath(tempPath).startswith(os.path.realpath(upload_directory) + os.sep):
        return Response(status=400)

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

    _launch_scan_video(save_path, config, *_parse_upload_metadata())
    return Response(status=201)
