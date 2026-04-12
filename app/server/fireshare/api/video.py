import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path

from flask import current_app, jsonify, request, Response, send_file
from flask_login import login_required, current_user
from sqlalchemy import func
from sqlalchemy.sql import text

from .. import db, logger, util
from ..models import Video, VideoInfo, VideoView, VideoGameLink, VideoTagLink, FolderRule
from . import api
from .helpers import get_video_path, add_cache_headers, add_poster_cache_headers
from .decorators import demo_restrict


def _stream_video_file(video_path):
    """Shared range-request streaming logic for video endpoints."""
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


def _delete_if_exists(path):
    if path.exists():
        path.unlink()


def _clear_crop(video, video_info, paths, had_480p, had_720p, had_1080p):
    """Delete all crop-related files and reset DB flags, then re-transcode from original."""
    derived_dir = paths["processed"] / "derived" / video.video_id
    _delete_if_exists(derived_dir / f"{video.video_id}-cropped.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-480p.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-720p.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-1080p.mp4")

    video_info.has_crop = False
    video_info.has_480p = False
    video_info.has_720p = False
    video_info.has_1080p = False
    db.session.commit()

    # Regenerate thumbnail from the original video
    original_path = paths["processed"] / "video_links" / f"{video.video_id}{video.extension}"
    thumbnail_skip = current_app.config.get('THUMBNAIL_VIDEO_LOCATION') or 0
    if thumbnail_skip > 0 and thumbnail_skip <= 100:
        thumbnail_skip = thumbnail_skip / 100
    else:
        thumbnail_skip = 0
    poster_time = int((video_info.duration or 0) * thumbnail_skip)
    util.create_poster(original_path, derived_dir / "poster.jpg", poster_time)

    # Re-transcode quality variants from the original if they existed before
    if had_480p or had_720p or had_1080p:
        _retranscode_async(video.video_id, original_path, paths, had_480p, had_720p, had_1080p)


def _apply_crop_async(video, video_info, start_time, end_time, paths):
    """Clear old crop files, then create new crop and re-transcode in a background thread."""
    had_480p = video_info.has_480p
    had_720p = video_info.has_720p
    had_1080p = video_info.has_1080p

    derived_dir = paths["processed"] / "derived" / video.video_id
    derived_dir.mkdir(parents=True, exist_ok=True)

    # Remove old files and mark flags as pending
    _delete_if_exists(derived_dir / f"{video.video_id}-cropped.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-480p.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-720p.mp4")
    _delete_if_exists(derived_dir / f"{video.video_id}-1080p.mp4")

    video_info.has_crop = False
    video_info.has_480p = False
    video_info.has_720p = False
    video_info.has_1080p = False
    db.session.commit()

    original_path = paths["processed"] / "video_links" / f"{video.video_id}{video.extension}"
    cropped_path = derived_dir / f"{video.video_id}-cropped.mp4"
    video_id = video.video_id

    app = current_app._get_current_object()

    thumbnail_skip = current_app.config.get('THUMBNAIL_VIDEO_LOCATION') or 0
    if thumbnail_skip > 0 and thumbnail_skip <= 100:
        thumbnail_skip = thumbnail_skip / 100
    else:
        thumbnail_skip = 0

    def run():
        success = util.create_video_crop(original_path, cropped_path, start_time, end_time)
        with app.app_context():
            vi = VideoInfo.query.filter_by(video_id=video_id).first()
            if not vi:
                return
            if success:
                vi.has_crop = True
                db.session.commit()
                # Regenerate thumbnail from the cropped video
                crop_duration = (end_time or vi.duration) - (start_time or 0)
                poster_time = int(crop_duration * thumbnail_skip)
                util.create_poster(cropped_path, derived_dir / "poster.jpg", poster_time)
                if had_480p or had_720p or had_1080p:
                    _retranscode_async(video_id, cropped_path, paths, had_480p, had_720p, had_1080p)
            else:
                logger.error(f"Crop failed for video {video_id}")

    import threading
    t = threading.Thread(target=run, daemon=True)
    t.start()


def _retranscode_async(video_id, source_path, paths, do_480p, do_720p, do_1080p):
    """Transcode quality variants from source_path in a background thread."""
    derived_dir = paths["processed"] / "derived" / video_id
    app = current_app._get_current_object()

    heights = []
    if do_480p:
        heights.append(480)
    if do_720p:
        heights.append(720)
    if do_1080p:
        heights.append(1080)

    def run():
        for height in heights:
            out_path = derived_dir / f"{video_id}-{height}p.mp4"
            success, _ = util.transcode_video_quality(source_path, out_path, height)
            with app.app_context():
                vi = VideoInfo.query.filter_by(video_id=video_id).first()
                if vi and success:
                    setattr(vi, f'has_{height}p', True)
                    db.session.commit()

    import threading
    t = threading.Thread(target=run, daemon=True)
    t.start()


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
        vjson["tags"] = [l.tag.json() for l in VideoTagLink.query.filter_by(video_id=v.video_id).all() if l.tag is not None]
        videos_json.append(vjson)

    if sort == "views asc":
        videos_json = sorted(videos_json, key=lambda d: d['view_count'])
    if sort == 'views desc':
        videos_json = sorted(videos_json, key=lambda d: d['view_count'], reverse=True)

    return jsonify({"videos": videos_json})


@api.route('/api/video/random')
@login_required
def get_random_video():
    import random
    row_count = Video.query.count()
    random_video = Video.query.offset(int(row_count * random.random())).first()
    current_app.logger.info(f"Fetched random video {random_video.video_id}: {random_video.info.title}")
    vjson = random_video.json()
    vjson["view_count"] = VideoView.count(random_video.video_id)
    return jsonify(vjson)


@api.route('/api/video/public/random')
def get_random_public_video():
    import random
    row_count = Video.query.filter(Video.info.has(private=False)).filter_by(available=True).count()
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
        vjson["tags"] = [l.tag.json() for l in VideoTagLink.query.filter_by(video_id=v.video_id).all() if l.tag is not None]
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
@demo_restrict
def delete_video(id):
    video = Video.query.filter_by(video_id=id).first()
    if video:
        logging.info(f"Deleting video: {video.video_id}")

        paths = current_app.config['PATHS']
        file_path = paths['video'] / video.path
        link_path = paths['processed'] / 'video_links' / f"{id}{video.extension}"
        derived_path = paths['processed'] / 'derived' / id

        VideoInfo.query.filter_by(video_id=id).delete()
        VideoGameLink.query.filter_by(video_id=id).delete()
        VideoTagLink.query.filter_by(video_id=id).delete()
        VideoView.query.filter_by(video_id=id).delete()
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


@api.route('/api/video/move/<id>', methods=['POST'])
@login_required
def move_video(id):
    video = Video.query.filter_by(video_id=id).first()
    if not video:
        return Response(status=404, response=f"A video with id: {id}, does not exist.")

    data = request.json
    target_folder = (data.get('folder') or '').strip()
    if not target_folder:
        return Response(status=400, response='A target folder must be provided.')

    paths = current_app.config['PATHS']
    video_path = paths['video']

    target_folder_path = video_path / target_folder
    if not target_folder_path.is_dir():
        return Response(status=400, response=f"Folder '{target_folder}' does not exist.")

    old_file_path = video_path / video.path
    filename = Path(video.path).name
    new_path = f"{target_folder}/{filename}"
    new_file_path = video_path / new_path

    if old_file_path.resolve() == new_file_path.resolve():
        return Response(status=400, response='Video is already in that folder.')

    if new_file_path.exists():
        return Response(status=409, response=f"A file named '{filename}' already exists in '{target_folder}'.")

    try:
        shutil.move(str(old_file_path), str(new_file_path))

        link_path = paths['processed'] / 'video_links' / f"{id}{video.extension}"
        if link_path.exists() or link_path.is_symlink():
            link_path.unlink()
        os.symlink(new_file_path.absolute(), link_path)

        video.path = new_path

        folder_rule = FolderRule.query.filter_by(folder_path=target_folder).first()
        if folder_rule:
            existing_link = VideoGameLink.query.filter_by(video_id=id).first()
            if existing_link:
                existing_link.game_id = folder_rule.game_id
            else:
                db.session.add(VideoGameLink(video_id=id, game_id=folder_rule.game_id, created_at=datetime.utcnow()))

        db.session.commit()

        logging.info(f"Moved video {id} from {old_file_path} to {new_file_path}")
        return Response(status=200)
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error moving video {id}: {e}")
        return Response(status=500, response=str(e))


@api.route('/api/video/details/<id>', methods=["GET", "PUT"])
def handle_video_details(id):
    if request.method == 'GET':
        # db lookup and get the details title/views/etc
        video = Video.query.filter_by(video_id=id).first()
        if video:
            vjson = video.json()
            vjson["view_count"] = VideoView.count(video.video_id)
            derived_dir = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video.video_id)
            vjson["has_custom_poster"] = (derived_dir / "custom_poster.webp").exists()
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

            # Extract crop fields before the generic VideoInfo update so they don't
            # get written directly (we handle them via the crop pipeline below)
            _UNSET = object()
            new_start = data.pop('start_time', _UNSET)
            new_end   = data.pop('end_time',   _UNSET)

            # Update remaining VideoInfo fields generically
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
                            # Strip any timezone suffix and store as naive local datetime.
                            # The frontend sends a naive local ISO string; treating it as
                            # UTC (via the old Z→+00:00 replacement) caused a timezone
                            # offset to be baked in on every save.
                            dt = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
                            video.recorded_at = dt.replace(tzinfo=None)
                        except (ValueError, AttributeError):
                            video.recorded_at = None

            db.session.commit()

            # Handle crop pipeline if start_time / end_time were included in the payload
            crop_changed = new_start is not _UNSET or new_end is not _UNSET
            if crop_changed:
                resolved_start = new_start if new_start is not _UNSET else video_info.start_time
                resolved_end   = new_end   if new_end   is not _UNSET else video_info.end_time

                # Persist the new crop time values
                video_info.start_time = resolved_start
                video_info.end_time   = resolved_end
                db.session.commit()

                paths = current_app.config['PATHS']
                video = Video.query.filter_by(video_id=id).first()

                if resolved_start is None and resolved_end is None:
                    # Clearing the crop — delete crop files and re-transcode from original
                    had_480p  = video_info.has_480p
                    had_720p  = video_info.has_720p
                    had_1080p = video_info.has_1080p
                    _clear_crop(video, video_info, paths, had_480p, had_720p, had_1080p)
                else:
                    # Creating / replacing the crop
                    _apply_crop_async(video, video_info, resolved_start, resolved_end, paths)

            return Response(status=201)
        else:
            return jsonify({
                'message': 'Video details not found'
            }), 404


@api.route('/api/video/poster', methods=['GET'])
def get_video_poster():
    video_id = request.args['id']
    derived_dir = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id)
    custom_poster_path = derived_dir / "custom_poster.webp"
    jpg_poster_path = derived_dir / "poster.jpg"

    if request.args.get('animated'):
        mp4_path = derived_dir / "boomerang-preview.mp4"
        webm_path = derived_dir / "boomerang-preview.webm"
        if mp4_path.exists():
            response = send_file(mp4_path, mimetype='video/mp4')
        else:
            response = send_file(webm_path, mimetype='video/webm')
        return add_cache_headers(response, video_id)
    elif custom_poster_path.exists():
        response = send_file(custom_poster_path, mimetype='image/webp')
        return add_poster_cache_headers(response, f'{video_id}-custom')
    else:
        response = send_file(jpg_poster_path, mimetype='image/jpg')
        return add_poster_cache_headers(response, f'{video_id}-generated')


@api.route('/api/video/<video_id>/poster/custom', methods=['POST'])
@login_required
def upload_custom_poster(video_id):
    if 'file' not in request.files:
        return jsonify({'message': 'No file provided'}), 400
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'message': 'No file selected'}), 400

    allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
    if file.content_type not in allowed_types:
        return jsonify({'message': 'Invalid file type. Allowed: JPEG, PNG, WebP'}), 400

    derived_dir = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id)
    if not derived_dir.exists():
        return jsonify({'message': 'Video derived directory not found'}), 404

    ext_map = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}
    suffix = ext_map.get(file.content_type, '.jpg')

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(tmp_fd)
    try:
        file.save(tmp_path)
        custom_poster_path = derived_dir / "custom_poster.webp"
        cmd = ['ffmpeg', '-y', '-i', tmp_path, str(custom_poster_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            current_app.logger.error("ffmpeg failed for custom poster: %s", result.stderr)
    finally:
        os.unlink(tmp_path)

    if not custom_poster_path.exists():
        return jsonify({'message': 'Failed to process image'}), 500

    return Response(status=200)


@api.route('/api/video/<video_id>/poster/custom', methods=['DELETE'])
@login_required
def delete_custom_poster(video_id):
    derived_dir = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id)
    custom_poster_path = derived_dir / "custom_poster.webp"
    if custom_poster_path.exists():
        custom_poster_path.unlink()
    return Response(status=200)


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


@api.route('/api/video/original')
def get_original_video():
    """Serves the original unmodified video file, bypassing any crop. Used by the waveform editor."""
    video_id = request.args.get('id')
    subid = request.args.get('subid')
    try:
        video_path = get_video_path(video_id, subid, quality=None)
        return send_file(video_path, mimetype='video/mp4', conditional=True)
    except Exception as e:
        logger.error(f"Error serving original video {video_id}: {e}")
        return Response(status=404)


@api.route('/api/video/audio')
def get_video_audio():
    """
    Serves a tiny mono MP3 extract of the original video, used by the waveform editor.
    The extract is created on first request and cached at derived/{id}/{id}-audio.mp3.
    Much smaller than the full video, so WaveSurfer loads and decodes it much faster.
    """
    video_id = request.args.get('id')
    if not video_id:
        return Response(status=400)
    try:
        paths = current_app.config['PATHS']
        derived_dir = paths['processed'] / 'derived' / video_id
        audio_path = derived_dir / f'{video_id}-audio.mp3'

        if not audio_path.exists():
            video_path = get_video_path(video_id, subid=None, quality=None)
            derived_dir.mkdir(parents=True, exist_ok=True)
            if not util.create_audio_extract(video_path, audio_path):
                return Response(status=500)

        return send_file(audio_path, mimetype='audio/mpeg', conditional=True)
    except Exception as e:
        logger.error(f"Error serving audio extract for {video_id}: {e}")
        return Response(status=404)


@api.route('/api/video')
def get_video():
    video_id = request.args.get('id')
    subid = request.args.get('subid')
    quality = request.args.get('quality')  # Support quality parameter (720p, 1080p, cropped)
    video_path = get_video_path(video_id, subid, quality)
    return _stream_video_file(video_path)


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
