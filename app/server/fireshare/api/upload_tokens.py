"""Upload tokens: long-lived credentials that let external tools upload media.

The shape of the feature, and why:

* A token is a bearer credential owned by exactly one user. It grants nothing on
  its own — every request re-reads the owner's account, so revoking `upload`,
  disabling the account, or deleting it stops the token on the very next call.
  That is what keeps the token route as tight as the session-authenticated ones
  rather than becoming a way around the permission system.
* Only the sha256 of the secret is stored. A database copy cannot be replayed
  against the API, and a mislaid token can be replaced but never recovered. The
  raw value exists in exactly one response: the one that created or regenerated
  it.
* Tokens never expire. They are ended by deleting or regenerating them, which is
  what an unattended tool needs — an expiry would silently break automation.
* The credential is read from a header only. Query strings land in access logs
  and browser history, so a token in one would leak somewhere the owner cannot
  clean up.

The upload route itself deliberately reuses the helpers behind `/api/upload` and
`/api/upload/image` rather than reimplementing them, so the filename sanitising,
extension allowlist, folder containment, demo size cap, duplicate rejection, and
uploader attribution are all literally the same code paths the browser uses.
"""
import hashlib
import json
import os
import random
import secrets
import string
import threading
import time
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import current_app, jsonify, request, Response
from flask_login import current_user

from .. import db, logger
from .. import permissions as P
from ..constants import SUPPORTED_FILE_TYPES
from ..ip_whitelist import get_client_ip
from ..models import GameMetadata, UploadToken, User
from . import api
from .decorators import json_body, require_perm
from .helpers import sanitize_upload_folder, secure_filename
from .image import SUPPORTED_IMAGE_TYPES, _launch_scan_image
from .upload import _check_upload_size, _launch_scan_video, _parse_upload_metadata, _reject_duplicate

# Identifies a Fireshare upload token on sight, the way `ghp_` does for GitHub.
# Secret scanners and log filters can key on it, and a user who pastes the wrong
# credential into a config file can tell at a glance.
TOKEN_PREFIX = 'fsk_'

# Bytes of randomness behind the prefix: 256 bits, so guessing is not a threat
# model and the throttle below only exists to stop somebody making us do the work.
TOKEN_ENTROPY_BYTES = 32

# How much of the token the UI may show. This is the leading fragment of the real
# secret, which is how the owner recognises it in a config file; the remaining
# ~200 bits are what actually authenticates.
PREFIX_DISPLAY_LENGTH = len(TOKEN_PREFIX) + 8

TOKEN_NAME_MAX_LENGTH = 64
MAX_TOKENS_PER_USER = 20

# Writing last_used_at on every call would mean a database write per upload
# request for a field nobody reads at that resolution.
LAST_USED_WRITE_INTERVAL = 60


# ---------------------------------------------------------------------------
# Failed-token throttle
#
# Kept separate from login_throttle on purpose: sharing its per-IP bucket would
# let a tool looping on a stale token lock real people out of signing in from the
# same address. Counters live in process memory, exactly like the login ones, and
# an attacker cannot force the reset that restarting would give them.
# ---------------------------------------------------------------------------

_THROTTLE_WINDOW_SECONDS = 300
_THROTTLE_MAX_FAILURES = 30
_THROTTLE_MAX_TRACKED_IPS = 4096

_throttle_lock = threading.Lock()
_throttle_failures = {}


def _throttle_recent(ip, now):
    stamps = [t for t in _throttle_failures.get(ip, ()) if t > now - _THROTTLE_WINDOW_SECONDS]
    if stamps:
        _throttle_failures[ip] = stamps
    else:
        _throttle_failures.pop(ip, None)
    return stamps


def _throttle_retry_after(ip):
    """Seconds this address must wait before another token will be checked."""
    now = time.time()
    with _throttle_lock:
        stamps = _throttle_recent(ip, now)
        if len(stamps) >= _THROTTLE_MAX_FAILURES:
            return int(stamps[0] + _THROTTLE_WINDOW_SECONDS - now) + 1
        return 0


def _throttle_record_failure(ip):
    now = time.time()
    with _throttle_lock:
        stamps = _throttle_recent(ip, now)
        stamps.append(now)
        del stamps[: max(0, len(stamps) - _THROTTLE_MAX_FAILURES)]
        _throttle_failures[ip] = stamps
        for key in [k for k in _throttle_failures
                    if not any(t > now - _THROTTLE_WINDOW_SECONDS for t in _throttle_failures[k])]:
            del _throttle_failures[key]
        if len(_throttle_failures) > _THROTTLE_MAX_TRACKED_IPS:
            stale = sorted(_throttle_failures, key=lambda k: _throttle_failures[k][-1])
            for key in stale[: len(_throttle_failures) - _THROTTLE_MAX_TRACKED_IPS]:
                del _throttle_failures[key]


def _throttle_clear(ip):
    with _throttle_lock:
        _throttle_failures.pop(ip, None)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _now():
    """Naive UTC, matching the DateTime columns elsewhere in the schema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_token():
    return TOKEN_PREFIX + secrets.token_urlsafe(TOKEN_ENTROPY_BYTES)


def _hash_token(raw):
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _clean_token_name(value):
    """Reduce a caller-supplied token name to something safe to store and render.

    Control characters are stripped for the same reason as in the profile fields:
    a name containing them would render as something other than what it says.
    """
    if not isinstance(value, str):
        return None
    cleaned = ''.join(ch for ch in value if ch.isprintable()).strip()
    return cleaned[:TOKEN_NAME_MAX_LENGTH] or None


def _token_from_request():
    """The raw token presented by the caller, or None.

    Headers only. A token in a query string would be written to the access log of
    every proxy in front of Fireshare and to the caller's shell history.
    """
    header = request.headers.get('Authorization', '')
    if header[:7].lower() == 'bearer ':
        candidate = header[7:].strip()
        if candidate:
            return candidate
    return (request.headers.get('X-Fireshare-Token') or '').strip() or None


def _resolve_token(raw):
    """Return (token, user) for a presented secret, or (None, None).

    The lookup is by hash, so nothing here compares secrets byte by byte, and an
    unknown token costs one indexed read.
    """
    if not raw or len(raw) > 512:
        return None, None
    token = UploadToken.query.filter_by(token_hash=_hash_token(raw)).first()
    if not token:
        return None, None
    user = db.session.get(User, token.user_id)
    if not user or user.disabled or not user.can(P.UPLOAD):
        return None, None
    return token, user


def _note_token_use(token):
    now = _now()
    if token.last_used_at and (now - token.last_used_at).total_seconds() < LAST_USED_WRITE_INTERVAL:
        return
    token.last_used_at = now
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning(f"Could not record use of upload token {token.id}: {e}")


def upload_token_required(f):
    """Authenticate the caller by upload token, or reject with 401.

    The decorated view receives `token_user` as a keyword argument. It is the live
    User row, re-read on every request, so the owner's current permissions govern
    the call rather than whatever they held when the token was minted.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        client_ip = get_client_ip()
        wait = _throttle_retry_after(client_ip)
        if wait:
            return Response(
                status=429,
                response='Too many invalid upload tokens. Try again later.',
                headers={'Retry-After': str(wait)},
            )

        raw = _token_from_request()
        if not raw:
            return Response(
                status=401,
                response='An upload token is required. Send it as "Authorization: Bearer <token>".',
                headers={'WWW-Authenticate': 'Bearer realm="fireshare-upload"'},
            )

        token, user = _resolve_token(raw)
        if not user:
            # One message for an unknown token, a revoked permission, and a
            # disabled account alike: the difference is not the caller's business
            # and telling them would confirm which tokens exist.
            _throttle_record_failure(client_ip)
            logger.warning(f"Rejected an upload token presented from {client_ip}")
            return Response(status=401, response='Invalid upload token.')

        _throttle_clear(client_ip)
        _note_token_use(token)
        kwargs['token_user'] = user
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Token management (session-authenticated, owner-scoped)
# ---------------------------------------------------------------------------

def _owned_token_or_404(token_id):
    """A token belonging to the signed-in user, or a 404 response.

    Scoped by owner rather than looked up and then checked, so another account's
    token id is indistinguishable from one that does not exist.
    """
    token = UploadToken.query.filter_by(id=token_id, user_id=current_user.id).first()
    if not token:
        return None, (jsonify({'error': 'Upload token not found.'}), 404)
    return token, None


@api.route('/api/account/upload-tokens', methods=['GET'])
@require_perm(P.UPLOAD)
def list_upload_tokens():
    tokens = (UploadToken.query
              .filter_by(user_id=current_user.id)
              .order_by(UploadToken.created_at.desc(), UploadToken.id.desc())
              .all())
    return jsonify({'tokens': [t.json() for t in tokens], 'max_tokens': MAX_TOKENS_PER_USER})


@api.route('/api/account/upload-tokens', methods=['POST'])
@require_perm(P.UPLOAD)
@json_body
def create_upload_token():
    name = _clean_token_name(request.json_body.get('name')) or 'Upload token'

    if UploadToken.query.filter_by(user_id=current_user.id).count() >= MAX_TOKENS_PER_USER:
        return jsonify({
            'error': f'You already have {MAX_TOKENS_PER_USER} upload tokens. '
                     'Delete one before creating another.'
        }), 400

    raw = _generate_token()
    token = UploadToken(
        user_id=current_user.id,
        name=name,
        token_hash=_hash_token(raw),
        prefix=raw[:PREFIX_DISPLAY_LENGTH],
        created_at=_now(),
    )
    db.session.add(token)
    db.session.commit()
    logger.info(f"User '{current_user.username}' created upload token {token.prefix}")

    # The only time the raw token is ever returned.
    return jsonify({'token': {**token.json(), 'secret': raw}}), 201


@api.route('/api/account/upload-tokens/<int:token_id>', methods=['PUT'])
@require_perm(P.UPLOAD)
@json_body
def rename_upload_token(token_id):
    token, error = _owned_token_or_404(token_id)
    if error:
        return error
    name = _clean_token_name(request.json_body.get('name'))
    if not name:
        return jsonify({'error': 'A name is required.'}), 400
    token.name = name
    db.session.commit()
    return jsonify({'token': token.json()})


@api.route('/api/account/upload-tokens/<int:token_id>/regenerate', methods=['POST'])
@require_perm(P.UPLOAD)
def regenerate_upload_token(token_id):
    token, error = _owned_token_or_404(token_id)
    if error:
        return error

    raw = _generate_token()
    token.token_hash = _hash_token(raw)
    token.prefix = raw[:PREFIX_DISPLAY_LENGTH]
    token.created_at = _now()
    # The old secret is gone, so anything it had done is no longer this token's
    # history. Clearing this keeps "last used" honest about the new one.
    token.last_used_at = None
    db.session.commit()
    logger.info(f"User '{current_user.username}' regenerated upload token {token.id} as {token.prefix}")

    return jsonify({'token': {**token.json(), 'secret': raw}})


@api.route('/api/account/upload-tokens/<int:token_id>', methods=['DELETE'])
@require_perm(P.UPLOAD)
def delete_upload_token(token_id):
    token, error = _owned_token_or_404(token_id)
    if error:
        return error
    prefix = token.prefix
    db.session.delete(token)
    db.session.commit()
    logger.info(f"User '{current_user.username}' deleted upload token {prefix}")
    return jsonify({'deleted': True})


# ---------------------------------------------------------------------------
# Token-authenticated upload
# ---------------------------------------------------------------------------

def _resolve_game_id(game_id):
    """The game to link the upload to, from `game_id` or a `game` name.

    A machine usually knows the game as a name, not as a Fireshare row id, so the
    name is accepted as well. It only ever resolves an existing game — creating
    one from an upload would let a token fill the library with typos.
    """
    if game_id is not None:
        return game_id, None
    name = (request.form.get('game') or '').strip()
    if not name:
        return None, None
    game = GameMetadata.query.filter(db.func.lower(GameMetadata.name) == name.lower()).first()
    if not game:
        return None, jsonify({
            'error': 'unknown_game',
            'message': f'No game named "{name}" exists in this library. Add it first, '
                       'or pass game_id.',
        })
    return game.id, None


def _unique_save_path(directory, filename, filetype):
    """A path under `directory` for `filename`, suffixed if something is there."""
    save_path = os.path.join(directory, filename)
    if os.path.exists(save_path):
        stem = '.'.join(filename.split('.')[:-1])
        uid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
        save_path = os.path.join(directory, f"{stem}-{uid}.{filetype}")
    return save_path


@api.route('/api/upload/token', methods=['POST'])
@upload_token_required
def token_upload(token_user):
    """Upload one video or image as the token's owner.

    multipart/form-data:
      file      the media (required); the extension decides video or image
      title     optional title for the item
      folder    optional destination folder under the media root
      game_id   optional Fireshare game id, or
      game      optional game name, resolved against existing games
      tag_ids   optional comma-separated tag ids
    """
    paths = current_app.config['PATHS']
    try:
        with open(paths['data'] / 'config.json', 'r') as configfile:
            config = json.load(configfile)
    except Exception:
        logger.error("Invalid or corrupt config file")
        return Response(status=500, response='Invalid or corrupt config file.')

    if 'file' not in request.files:
        return Response(status=400, response='A "file" part is required.')
    file = request.files['file']
    if not file.filename:
        return Response(status=400, response='The uploaded file has no name.')

    filename = secure_filename(file.filename)
    if not filename:
        return Response(status=400, response='The uploaded file has no usable name.')
    filetype = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if filetype in SUPPORTED_FILE_TYPES:
        media_type = 'video'
    elif filetype in SUPPORTED_IMAGE_TYPES:
        media_type = 'image'
    else:
        supported = ', '.join(sorted(set(SUPPORTED_FILE_TYPES) | SUPPORTED_IMAGE_TYPES))
        return Response(status=400, response=f'Unsupported file type. Supported: {supported}.')

    file.seek(0, 2)
    size_err = _check_upload_size(file.tell())
    file.seek(0)
    if size_err:
        return size_err

    tag_ids, game_id, title = _parse_upload_metadata()
    game_id, game_err = _resolve_game_id(game_id)
    if game_err:
        return game_err, 400

    # Same default as /api/upload and /api/upload/image: a token belongs to a real
    # account with the upload permission, so it files media where that account's
    # own uploads go, not into the public drop folder.
    upload_folder = config['app_config'].get('admin_upload_folder_name', 'uploads')
    requested_folder = sanitize_upload_folder(request.form.get('folder'))
    if requested_folder:
        upload_folder = requested_folder

    if media_type == 'image':
        image_directory = current_app.config.get('IMAGE_DIRECTORY')
        if not image_directory:
            return Response(status=503, response='IMAGE_DIRECTORY is not configured.')
        upload_directory = Path(image_directory) / upload_folder
        upload_directory.mkdir(parents=True, exist_ok=True)
        save_path = _unique_save_path(str(upload_directory), filename, filetype)
        file.save(save_path)
        _launch_scan_image(save_path, config, game_id=game_id, tag_ids=tag_ids,
                           title=title, uploaded_by=token_user.id)
    else:
        upload_directory = paths['video'] / upload_folder
        upload_directory.mkdir(parents=True, exist_ok=True)
        save_path = _unique_save_path(str(upload_directory), filename, filetype)
        file.save(save_path)
        duplicate = _reject_duplicate(save_path)
        if duplicate:
            return duplicate
        _launch_scan_video(save_path, config, tag_ids, game_id, title,
                           uploaded_by=token_user.id)

    logger.info(
        f"Token upload: {media_type} '{os.path.basename(save_path)}' into '{upload_folder}' "
        f"as '{token_user.username}'"
    )
    return jsonify({
        'status': 'accepted',
        'media_type': media_type,
        'filename': os.path.basename(save_path),
        'folder': upload_folder,
    }), 201


@api.route('/api/upload/token', methods=['GET'])
@upload_token_required
def token_upload_check(token_user):
    """Confirm a token works, and report what it may do, without uploading.

    Integrations need a way to validate their configuration that does not involve
    putting a file in somebody's library.
    """
    paths = current_app.config['PATHS']
    try:
        with open(paths['data'] / 'config.json', 'r') as configfile:
            config = json.load(configfile)
        default_folder = config['app_config'].get('admin_upload_folder_name', 'uploads')
    except Exception:
        default_folder = None

    return jsonify({
        'ok': True,
        'username': token_user.username,
        'default_folder': default_folder,
        'images_enabled': bool(current_app.config.get('IMAGE_DIRECTORY')),
        'supported_video_types': sorted(SUPPORTED_FILE_TYPES),
        'supported_image_types': sorted(SUPPORTED_IMAGE_TYPES),
    })
