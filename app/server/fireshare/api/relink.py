"""Relink media that was moved on disk outside Fireshare.

A library scan deliberately does not follow a file that turns up at a new path:
it marks the old record missing and leaves the new file alone, because a file
with the same name somewhere else is not proof it is the same file. This is the
manual, on-request counterpart. It hashes every media file that is not indexed
at its current path, matches those hashes against records marked missing,
reports the plan, and relinks only what the administrator confirms. Nothing on
disk is moved; only the record's path, folder and playback link change, so
posters, transcodes, tags and views stay attached to the same id.
"""
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import current_app, jsonify, request, Response

from .. import db, logger, util
from ..constants import SUPPORTED_FILE_EXTENSIONS
from ..models import Video, Image, MediaFolder
from .. import permissions as P
from . import api
from .decorators import demo_restrict, json_body, require_perm
from .scan import _get_or_create_media_folder

# Same exclusions the library scan applies.
_CHUNK_FILE_PATTERN = re.compile(r'\.part\d{4}$')
_TRANSCODE_PATTERN = re.compile(r'-(?:720p|1080p)\.mp4$', re.IGNORECASE)

_state = {
    'lock': threading.Lock(),
    'is_running': False,
    'current': 0,
    'total': 0,
    'started_at': None,
    'finished_at': None,
    'error': None,
    'result': None,
}


def _is_video_file(f):
    return (f.suffix.lower() in SUPPORTED_FILE_EXTENSIONS
            and not _CHUNK_FILE_PATTERN.search(f.name)
            and not _TRANSCODE_PATTERN.search(f.name))


def _candidate_files(root, is_media, indexed_paths):
    """Media files under root that no available record already points at.

    Files at an indexed path are exactly where the library expects them, so
    hashing them again could only ever confirm what the scan already knows.
    """
    candidates = []
    for f in root.glob('**/*'):
        if not f.is_file() or not is_media(f) or f.name.startswith('._'):
            continue
        rel = str(f.relative_to(root))
        if rel in indexed_paths:
            continue
        candidates.append((rel, f))
    return candidates


def _title_of(record):
    if record.info and record.info.title:
        return record.info.title
    return Path(record.path).stem


def _snapshot():
    with _state['lock']:
        return {k: v for k, v in _state.items() if k != 'lock'}


def _set(**fields):
    with _state['lock']:
        _state.update(fields)


def _run_scan(app):
    started = time.time()
    with app.app_context():
        try:
            paths = app.config['PATHS']
            jobs = []

            missing_videos = {v.video_id: v for v in Video.query.filter_by(available=False).all()}
            if missing_videos:
                indexed = {p for (p,) in db.session.query(Video.path).filter(Video.available.is_(True))}
                jobs.append(('video', missing_videos,
                             _candidate_files(paths['video'], _is_video_file, indexed), util.video_id))

            image_dir = app.config.get('IMAGE_DIRECTORY')
            if image_dir and Path(image_dir).is_dir():
                missing_images = {i.image_id: i for i in Image.query.filter_by(available=False).all()}
                if missing_images:
                    indexed = {p for (p,) in db.session.query(Image.path).filter(Image.available.is_(True))}
                    jobs.append(('image', missing_images,
                                 _candidate_files(Path(image_dir), util.is_image_file, indexed), util.image_id))

            _set(total=sum(len(candidates) for _, _, candidates, _ in jobs))

            matches, unmatched, found = [], [], {}
            folders = set()
            hashed = 0
            for kind, missing_by_id, candidates, hasher in jobs:
                for rel, f in candidates:
                    folders.add(os.path.dirname(rel))
                    try:
                        media_id = hasher(f)
                        hashed += 1
                    except OSError as e:
                        logger.warning(f"Relink: could not hash {f}: {e}")
                        media_id = None
                    _set(current=_state['current'] + 1)
                    record = missing_by_id.get(media_id) if media_id else None
                    if record is None:
                        continue
                    key = (kind, media_id)
                    if key in found:
                        # The same content sits in more than one place. The first
                        # copy wins; the count is surfaced so the operator knows.
                        found[key]['copies'] += 1
                        continue
                    entry = {
                        'kind': kind,
                        'id': media_id,
                        'title': _title_of(record),
                        'old_path': record.path,
                        'new_path': rel,
                        'same_place': rel == record.path,
                        'copies': 1,
                    }
                    found[key] = entry
                    matches.append(entry)
                for media_id, record in missing_by_id.items():
                    if (kind, media_id) not in found:
                        unmatched.append({
                            'kind': kind,
                            'id': media_id,
                            'title': _title_of(record),
                            'old_path': record.path,
                        })

            _set(result={
                'matches': matches,
                'unmatched': unmatched,
                'hashed': hashed,
                'folders': len(folders),
                'seconds': round(time.time() - started, 1),
            })
            logger.info(f"Relink scan: hashed {hashed} file(s), matched {len(matches)}, "
                        f"{len(unmatched)} still missing, {round(time.time() - started, 1)}s")
        except Exception as e:
            logger.error(f"Relink scan failed: {e}")
            _set(error=str(e))
        finally:
            _set(is_running=False, finished_at=datetime.utcnow().isoformat())
            db.session.remove()


@api.route('/api/manual/relink/status')
@require_perm(P.MANAGE_LIBRARY)
def relink_status():
    """Progress of the current or last scan, plus how much is missing right now."""
    snapshot = _snapshot()
    snapshot['missing'] = {
        'videos': Video.query.filter_by(available=False).count(),
        'images': Image.query.filter_by(available=False).count(),
    }
    return jsonify(snapshot)


@api.route('/api/manual/relink/scan', methods=['POST'])
@require_perm(P.MANAGE_LIBRARY)
@demo_restrict
def relink_scan():
    """Start hashing in the background. Poll /api/manual/relink/status for the plan."""
    with _state['lock']:
        if _state['is_running']:
            return jsonify({'started': False, 'message': 'A relink scan is already running.'}), 409
        _state.update(is_running=True, current=0, total=0, error=None, result=None,
                      started_at=datetime.utcnow().isoformat(), finished_at=None)
    app = current_app._get_current_object()
    threading.Thread(target=_run_scan, args=(app,), daemon=True).start()
    return jsonify({'started': True}), 202


@api.route('/api/manual/relink/apply', methods=['POST'])
@require_perm(P.MANAGE_LIBRARY)
@demo_restrict
@json_body
def relink_apply():
    """Point the chosen missing records at the files the scan found for them."""
    items = request.json_body.get('items')
    if not isinstance(items, list) or not items:
        return Response(status=400, response='items must be a non-empty list.')

    paths = current_app.config['PATHS']
    folder_cache = {}
    relinked, errors = [], []

    for item in items:
        kind = item.get('kind') if isinstance(item, dict) else None
        media_id = item.get('id') if isinstance(item, dict) else None
        new_path = item.get('new_path') if isinstance(item, dict) else None
        if kind not in ('video', 'image') or not isinstance(media_id, str) or not isinstance(new_path, str):
            errors.append({'id': media_id, 'error': 'Malformed item.'})
            continue

        if kind == 'video':
            root, model, hasher = paths['video'], Video, util.video_id
            record = Video.query.filter_by(video_id=media_id).first()
            links_dir = paths['processed'] / 'video_links'
        else:
            image_dir = current_app.config.get('IMAGE_DIRECTORY')
            if not image_dir:
                errors.append({'id': media_id, 'error': 'IMAGE_DIRECTORY is not configured.'})
                continue
            root, model, hasher = Path(image_dir), Image, util.image_id
            record = Image.query.filter_by(image_id=media_id).first()
            links_dir = paths['processed'] / 'image_links'

        if not record:
            errors.append({'id': media_id, 'error': 'No such record.'})
            continue

        # The path came from our own plan, but it has been through the browser
        # since, so it is held to the same rule as any client-supplied folder.
        root_str = os.path.normpath(str(root))
        candidate = os.path.normpath(os.path.join(root_str, new_path))
        if not candidate.startswith(root_str + os.sep):
            errors.append({'id': media_id, 'error': 'Path is outside the library.'})
            continue
        new_file = Path(candidate)
        if not new_file.is_file():
            errors.append({'id': media_id, 'error': 'The file is no longer there.'})
            continue
        # The hash is the whole basis of the match, so it is checked again here
        # rather than trusting a plan that may have gone stale.
        try:
            if hasher(new_file) != media_id:
                errors.append({'id': media_id, 'error': 'The file no longer has the same content.'})
                continue
        except OSError as e:
            errors.append({'id': media_id, 'error': f'Could not read the file: {e}'})
            continue

        rel = os.path.relpath(candidate, root_str)
        old_path, old_extension, old_folder_id = record.path, record.extension, record.folder_id
        dirname = os.path.dirname(rel)
        top_level = dirname.split(os.sep)[0] if dirname else None

        try:
            record.path = rel
            record.extension = new_file.suffix
            record.available = True
            folder = _get_or_create_media_folder(folder_cache, top_level, kind) if top_level else None
            record.folder_id = folder.id if folder else None
            if kind == 'image':
                record.source_folder = top_level

            links_dir.mkdir(parents=True, exist_ok=True)
            for link in {links_dir / f"{media_id}{old_extension}", links_dir / f"{media_id}{new_file.suffix}"}:
                if link.exists() or link.is_symlink():
                    link.unlink()
            os.symlink(new_file.absolute(), links_dir / f"{media_id}{new_file.suffix}")

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            errors.append({'id': media_id, 'error': str(e)})
            continue

        if old_folder_id and old_folder_id != record.folder_id:
            MediaFolder.cleanup_if_orphaned(old_folder_id, model)

        logger.info(f"Relinked {kind} {media_id}: {old_path} -> {rel}")
        relinked.append({'kind': kind, 'id': media_id, 'path': rel})

    # The plan is spent once acted on; a fresh scan is the only honest source
    # for what is still missing.
    _set(result=None)

    return jsonify({'relinked': relinked, 'errors': errors})
