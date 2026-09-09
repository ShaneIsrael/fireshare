"""Public profile pages, profile editing, and avatars.

Security notes for everything in this module:

* Every username arriving from a URL or body is put through
  permissions.normalize_username() before it reaches the database or the
  filesystem. It only ever matches ``[A-Za-z0-9][A-Za-z0-9_.-]*[A-Za-z0-9]``, so
  path traversal, NUL bytes, and bidi/homoglyph tricks are rejected at the edge
  rather than escaped later.
* Avatar files are named from the integer primary key, never from a username or
  an uploaded filename, so no request can influence the path that gets written.
* Uploaded avatars are decoded and re-encoded through Pillow rather than stored
  as received. That strips EXIF and renders a polyglot file (a valid image whose
  tail is script or archive data) inert, because only the decoded pixels survive.
* Sort parameters are matched against an allowlist before reaching text(), which
  is what keeps them out of the SQL string.
"""
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from flask import current_app, jsonify, request, Response, send_file, render_template, redirect, abort
from flask_login import login_required, current_user
from sqlalchemy import func
from sqlalchemy.sql import text

from .. import db, logger
from .. import permissions as perms
from ..models import (User, Video, VideoInfo, VideoView, VideoTagLink, VideoGameLink,
                      Image, ImageInfo, ImageView, ImageTagLink, ImageGameLink)
from . import api
from .decorators import demo_restrict, strict_admin_required, json_body

# Re-encoded output is a square WebP, so one extension covers every upload.
AVATAR_EXTENSION = 'webp'
AVATAR_SIZE = 256
AVATAR_QUALITY = 82
# Generous for a 256px square, tight enough that a worker never buffers anything
# large. Checked before the body is read, then again against what was read.
AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# A decoded image larger than this is a decompression bomb, not an avatar: a few
# hundred KB of crafted PNG can expand to gigabytes of pixels in memory.
AVATAR_MAX_DECODED_PIXELS = 50_000_000

ALLOWED_VIDEO_SORTS = (
    'updated_at desc',
    'updated_at asc',
    'video_info.title desc',
    'video_info.title asc',
    'views desc',
    'views asc',
)

ALLOWED_IMAGE_SORTS = (
    'updated_at desc',
    'updated_at asc',
    'image_info.title desc',
    'image_info.title asc',
)


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def _avatar_dir():
    return Path(current_app.config['PATHS']['data']) / 'avatars'


def _avatar_path(user_id):
    """Absolute path to a user's avatar file.

    user_id is an integer primary key read back from the database, so this path
    is never influenced by request content.
    """
    return _avatar_dir() / f"{int(user_id)}.{AVATAR_EXTENSION}"


def _lookup_user(username):
    """Resolve a username from a URL to a User, or None.

    Returns None for a malformed username without touching the database, so an
    invalid name and a missing account are indistinguishable to the caller.
    """
    normalized = perms.normalize_username(username)
    if normalized is None:
        return None
    # SQLAlchemy parameterizes this; the normalization above is what keeps the
    # value out of paths and rendered output further down.
    return User.query.filter(func.lower(User.username) == normalized.lower()).first()


def _can_view_profile(user):
    """Whether the current requester may see this profile at all."""
    if user is None or user.disabled:
        return False
    if user.profile_public:
        return True
    # A hidden profile is still reachable by its owner and by administrators.
    if not current_user.is_authenticated:
        return False
    return current_user.id == user.id or current_user.admin


def _can_view_private_media(user):
    """Whether the requester may see this user's private uploads."""
    if not current_user.is_authenticated:
        return False
    if current_user.id == user.id:
        return True  # you always see your own
    return current_user.can(perms.VIEW_PRIVATE)


def _resolve_or_404(username):
    """Return a viewable user, or abort with 404.

    A hidden or disabled profile 404s rather than 403s so the response never
    confirms that the account exists.
    """
    user = _lookup_user(username)
    if not _can_view_profile(user):
        abort(404)
    return user


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@api.route('/api/users/<username>/profile', methods=['GET'])
def get_user_profile(username):
    user = _resolve_or_404(username)
    include_private = _can_view_private_media(user)

    video_q = Video.query.join(VideoInfo).filter(
        Video.uploaded_by == user.id, Video.available == True
    )
    image_q = Image.query.join(ImageInfo).filter(
        Image.uploaded_by == user.id, Image.available == True
    )

    public_videos = video_q.filter(VideoInfo.private == False).count()
    public_images = image_q.filter(ImageInfo.private == False).count()
    total_videos = video_q.count() if include_private else public_videos
    total_images = image_q.count() if include_private else public_images

    visible_video_ids = [
        v.video_id for v in (
            video_q if include_private else video_q.filter(VideoInfo.private == False)
        ).with_entities(Video.video_id).all()
    ]
    visible_image_ids = [
        i.image_id for i in (
            image_q if include_private else image_q.filter(ImageInfo.private == False)
        ).with_entities(Image.image_id).all()
    ]

    total_views = 0
    game_ids = set()
    if visible_video_ids:
        total_views += VideoView.query.filter(VideoView.video_id.in_(visible_video_ids)).count()
        game_ids.update(
            row.game_id for row in VideoGameLink.query
            .filter(VideoGameLink.video_id.in_(visible_video_ids))
            .with_entities(VideoGameLink.game_id).all()
        )
    if visible_image_ids:
        total_views += ImageView.query.filter(ImageView.image_id.in_(visible_image_ids)).count()
        game_ids.update(
            row.game_id for row in ImageGameLink.query
            .filter(ImageGameLink.image_id.in_(visible_image_ids))
            .with_entities(ImageGameLink.game_id).all()
        )

    is_self = current_user.is_authenticated and current_user.id == user.id

    payload = user.profile_json()
    payload.update({
        'stats': {
            'videos': total_videos,
            'images': total_images,
            'public_videos': public_videos,
            'public_images': public_images,
            'private_videos': total_videos - public_videos if include_private else 0,
            'private_images': total_images - public_images if include_private else 0,
            'total_views': total_views,
            'games': len(game_ids),
        },
        'is_self': is_self,
        'can_edit': is_self or (current_user.is_authenticated and current_user.admin),
        'showing_private': include_private,
        'profile_public': bool(user.profile_public),
    })
    return jsonify(payload)


@api.route('/api/users/<username>/videos', methods=['GET'])
def get_user_videos(username):
    user = _resolve_or_404(username)

    sort = request.args.get('sort', 'updated_at desc')
    if sort not in ALLOWED_VIDEO_SORTS:
        return jsonify({'error': 'Invalid sort parameter'}), 400

    query = Video.query.join(VideoInfo).filter(
        Video.uploaded_by == user.id, Video.available == True
    )
    if not _can_view_private_media(user):
        query = query.filter(VideoInfo.private == False)
    # Safe: sort is one of ALLOWED_VIDEO_SORTS, never the raw parameter.
    if 'views' not in sort:
        query = query.order_by(text(sort))

    from .video import _is_session_unlocked

    videos_json = []
    for v in query.all():
        vjson = v.json()
        vjson['view_count'] = VideoView.count(v.video_id)
        vjson['tags'] = [
            l.tag.json() for l in VideoTagLink.query.filter_by(video_id=v.video_id).all()
            if l.tag is not None
        ]
        if vjson.get('info', {}).get('has_password'):
            vjson['info']['session_unlocked'] = _is_session_unlocked(v.video_id)
        videos_json.append(vjson)

    if sort == 'views asc':
        videos_json.sort(key=lambda d: d['view_count'])
    elif sort == 'views desc':
        videos_json.sort(key=lambda d: d['view_count'], reverse=True)

    return jsonify({'videos': videos_json})


@api.route('/api/users/<username>/images', methods=['GET'])
def get_user_images(username):
    user = _resolve_or_404(username)

    sort = request.args.get('sort', 'updated_at desc')
    if sort not in ALLOWED_IMAGE_SORTS:
        return jsonify({'error': 'Invalid sort parameter'}), 400

    query = Image.query.join(ImageInfo).filter(
        Image.uploaded_by == user.id, Image.available == True
    )
    if not _can_view_private_media(user):
        query = query.filter(ImageInfo.private == False)

    result = []
    for img in query.order_by(text(sort)).all():
        j = img.json()
        j['view_count'] = ImageView.count(img.image_id)
        j['tags'] = [
            l.tag.json() for l in ImageTagLink.query.filter_by(image_id=img.image_id).all()
            if l.tag
        ]
        game_link = ImageGameLink.query.filter_by(image_id=img.image_id).first()
        j['game'] = game_link.game.json() if game_link and game_link.game else None
        result.append(j)

    return jsonify({'images': result})


@api.route('/api/account/profile', methods=['PUT'])
@login_required
@demo_restrict
@json_body
def update_own_profile():
    body = request.json_body

    if 'display_name' in body:
        current_user.display_name = perms.clean_display_name(body.get('display_name'))
    if 'bio' in body:
        current_user.bio = perms.clean_bio(body.get('bio'))
    if 'profile_public' in body:
        current_user.profile_public = bool(body.get('profile_public'))

    db.session.commit()
    return jsonify(current_user.profile_json() | {'profile_public': bool(current_user.profile_public)})


# ---------------------------------------------------------------------------
# Avatars
# ---------------------------------------------------------------------------

@api.route('/api/users/<username>/avatar', methods=['GET'])
def get_user_avatar(username):
    """Serve a user's avatar.

    Available for any enabled account, including one whose aggregated profile
    page is hidden: the avatar sits next to that user's public uploads in the
    feed, which is a different surface from the browsable profile.
    """
    user = _lookup_user(username)
    if user is None or user.disabled or not user.has_avatar:
        abort(404)

    path = _avatar_path(user.id)
    if not path.is_file():
        abort(404)

    response = send_file(str(path), mimetype='image/webp', conditional=True)
    # The filename carries a version query param, so the bytes at this URL never
    # change; nosniff keeps a browser from reinterpreting them as anything else.
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self'"
    return response


def _store_avatar(user, file_storage):
    """Validate, re-encode, and persist an uploaded avatar.

    Returns None on success or an error message. Only decoded pixel data is
    written out: the original bytes are never saved, so trailing payloads and
    embedded metadata cannot survive the round trip.
    """
    from PIL import Image as PILImage, ImageOps, UnidentifiedImageError

    # Cheap rejection before reading the body at all.
    if request.content_length and request.content_length > AVATAR_MAX_UPLOAD_BYTES:
        return f'Images must be smaller than {AVATAR_MAX_UPLOAD_BYTES // (1024 * 1024)}MB.'

    # Read one byte past the cap so a body with a missing or lying Content-Length
    # is still bounded.
    raw = file_storage.read(AVATAR_MAX_UPLOAD_BYTES + 1)
    if not raw:
        return 'The uploaded file was empty.'
    if len(raw) > AVATAR_MAX_UPLOAD_BYTES:
        return f'Images must be smaller than {AVATAR_MAX_UPLOAD_BYTES // (1024 * 1024)}MB.'

    import io
    try:
        with PILImage.open(io.BytesIO(raw)) as probe:
            # Pillow reads dimensions from the header without decoding pixels, so
            # a bomb is caught before any large allocation happens.
            width, height = probe.size
            if width <= 0 or height <= 0:
                return 'That image could not be read.'
            if width * height > AVATAR_MAX_DECODED_PIXELS:
                return 'That image is too large to process.'
            probe.verify()
    except (UnidentifiedImageError, PILImage.DecompressionBombError):
        return 'That file is not a supported image.'
    except Exception:
        return 'That image could not be read.'

    # verify() leaves the file object unusable, so decode from a fresh buffer.
    try:
        with PILImage.open(io.BytesIO(raw)) as img:
            if getattr(img, 'n_frames', 1) > 1:
                img.seek(0)  # animated source: keep the first frame only
            # Honour EXIF rotation before the orientation tag is discarded.
            img = ImageOps.exif_transpose(img)
            img = img.convert('RGB')
            # Centre-crop to a square, then downscale to the stored size.
            img = ImageOps.fit(img, (AVATAR_SIZE, AVATAR_SIZE), method=PILImage.LANCZOS)

            target = _avatar_path(user.id)
            target.parent.mkdir(parents=True, exist_ok=True)
            # Write to a temp file in the destination directory and replace, so a
            # concurrent read never observes a partially written avatar.
            fd, tmp_name = tempfile.mkstemp(dir=str(target.parent), suffix='.tmp')
            os.close(fd)
            try:
                img.save(tmp_name, 'WEBP', quality=AVATAR_QUALITY, method=4)
                os.replace(tmp_name, str(target))
            except Exception:
                if os.path.exists(tmp_name):
                    os.remove(tmp_name)
                raise
    except PILImage.DecompressionBombError:
        return 'That image is too large to process.'
    except Exception as ex:
        logger.error(f'Failed to process avatar for user {user.id}: {ex}')
        return 'That image could not be processed.'

    return None


@api.route('/api/account/avatar', methods=['POST'])
@login_required
@demo_restrict
def upload_own_avatar():
    if 'file' not in request.files:
        return jsonify({'error': 'No file was provided.'}), 400

    error = _store_avatar(current_user, request.files['file'])
    if error:
        return jsonify({'error': error}), 400

    current_user.avatar_version = (current_user.avatar_version or 0) + 1
    db.session.commit()
    logger.info(f"User '{current_user.username}' updated their avatar")
    return jsonify({'avatar_url': current_user.avatar_url()})


@api.route('/api/account/avatar', methods=['DELETE'])
@login_required
@demo_restrict
def delete_own_avatar():
    path = _avatar_path(current_user.id)
    if path.is_file():
        try:
            path.unlink()
        except OSError as ex:
            logger.warning(f'Could not remove avatar file {path}: {ex}')

    current_user.avatar_version = 0
    db.session.commit()
    return jsonify({'avatar_url': None})


@api.route('/api/users/<username>/avatar', methods=['DELETE'])
@strict_admin_required
@demo_restrict
def delete_user_avatar(username):
    """Let an administrator remove someone else's avatar (moderation)."""
    user = _lookup_user(username)
    if user is None:
        abort(404)

    path = _avatar_path(user.id)
    if path.is_file():
        try:
            path.unlink()
        except OSError as ex:
            logger.warning(f'Could not remove avatar file {path}: {ex}')

    user.avatar_version = 0
    db.session.commit()
    logger.info(f"Admin '{current_user.username}' removed the avatar for '{user.username}'")
    return jsonify({'avatar_url': None})


# ---------------------------------------------------------------------------
# Shareable profile link (Open Graph shell, mirrors /w/<video_id>)
# ---------------------------------------------------------------------------

@api.route('/u/<username>')
def profile_metadata(username):
    domain = f"https://{current_app.config['DOMAIN']}" if current_app.config.get('DOMAIN') else ''
    user = _lookup_user(username)

    if not _can_view_profile(user):
        # Send unknown or hidden profiles to the SPA, which renders its own
        # not-found state. No signal either way about whether the account exists.
        return redirect(f"{domain}/profile/{perms.normalize_username(username) or ''}", code=302)

    public_videos = (Video.query.join(VideoInfo)
                     .filter(Video.uploaded_by == user.id,
                             Video.available == True,
                             VideoInfo.private == False)
                     .count())
    public_images = (Image.query.join(ImageInfo)
                     .filter(Image.uploaded_by == user.id,
                             Image.available == True,
                             ImageInfo.private == False)
                     .count())

    return render_template(
        'profile_metadata.html',
        domain=domain,
        username=user.username,
        name=user.name,
        bio=user.bio,
        avatar_path=user.avatar_url(),
        public_videos=public_videos,
        public_images=public_images,
    )
