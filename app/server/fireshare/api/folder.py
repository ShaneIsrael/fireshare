from datetime import datetime

from flask import jsonify, request, Response
from flask_login import login_required, current_user

from .. import db
from ..models import (
    MediaFolder,
    Video,
    VideoInfo,
    VideoTagLink,
    VideoView,
    Image,
    ImageInfo,
    ImageTagLink,
    ImageView,
)
from .. import permissions as P
from . import api


from .helpers import viewer_sees_private
from .decorators import require_perm
def _is_session_unlocked(video_id):
    try:
        from .video import _is_session_unlocked as impl
        return impl(video_id)
    except Exception:
        return False


def _video_summary(v):
    vjson = v.json()
    vjson["view_count"] = VideoView.count(v.video_id)
    vjson["tags"] = [l.tag.json() for l in VideoTagLink.query.filter_by(video_id=v.video_id).all() if l.tag is not None]
    if vjson.get("info", {}).get("has_password"):
        vjson["info"]["session_unlocked"] = _is_session_unlocked(v.video_id)
    return vjson


def _image_summary(img):
    j = img.json()
    j['view_count'] = ImageView.count(img.image_id)
    j['tags'] = [l.tag.json() for l in ImageTagLink.query.filter_by(image_id=img.image_id).all() if l.tag]
    return j


def _videos_query_for_folder(folder, authenticated):
    query = Video.query.join(VideoInfo).filter(
        Video.folder_id == folder.id,
        Video.available == True,
    )
    if not authenticated:
        query = query.filter(VideoInfo.private == False)
    return query


def _images_query_for_folder(folder, authenticated):
    query = Image.query.join(ImageInfo).filter(
        Image.folder_id == folder.id,
        Image.available == True,
    )
    if not authenticated:
        query = query.filter(ImageInfo.private == False)
    return query


def _folder_item_count(folder, authenticated):
    if folder.media_type == "video":
        return _videos_query_for_folder(folder, authenticated).count()
    else:
        return _images_query_for_folder(folder, authenticated).count()


def _folder_recent_items(folder, authenticated, limit=4):
    if folder.media_type == "video":
        videos = (
            _videos_query_for_folder(folder, authenticated)
            .order_by(Video.recorded_at.desc().nullslast(), Video.created_at.desc())
            .limit(limit)
            .all()
        )
        return [v.video_id for v in videos]
    else:
        images = (
            _images_query_for_folder(folder, authenticated)
            .order_by(Image.created_at.desc())
            .limit(limit)
            .all()
        )
        return [img.image_id for img in images]


def _folder_json(folder, authenticated):
    data = folder.json()
    data["item_count"] = _folder_item_count(folder, authenticated)
    data["recent_items"] = _folder_recent_items(folder, authenticated)
    return data


@api.route('/api/folders', methods=['GET'])
def get_folders():
    authenticated = viewer_sees_private()

    query = MediaFolder.query.filter(MediaFolder.available == True)
    if not authenticated:
        query = query.filter(MediaFolder.private == False)

    folders = query.all()
    results = [_folder_json(f, authenticated) for f in folders]
    return jsonify([f for f in results if f["item_count"] > 0])


@api.route('/api/folders/by-path', methods=['GET'])
@login_required
def get_folder_by_path():
    path = request.args.get('path')
    media_type = request.args.get('type')

    if not path or media_type not in ('video', 'image'):
        return Response(status=400, response='path and type (video|image) are required.')

    folder = MediaFolder.query.filter_by(path=path, media_type=media_type).first()
    if not folder:
        return Response(status=404, response='Folder not found.')

    return jsonify(folder.json())


@api.route('/api/folders/<uuid>', methods=['GET'])
def get_folder(uuid):
    folder = MediaFolder.query.filter_by(uuid=uuid).first()
    if not folder:
        return Response(status=404, response='Folder not found.')

    authenticated = viewer_sees_private()

    if not authenticated and (folder.private or not folder.available):
        return Response(status=404, response='Folder not found.')

    if authenticated is False and folder.available is False:
        return Response(status=404, response='Folder not found.')

    return jsonify(_folder_json(folder, authenticated))


@api.route('/api/folders/<uuid>/videos', methods=['GET'])
def get_folder_videos(uuid):
    folder = MediaFolder.query.filter_by(uuid=uuid).first()
    if not folder:
        return Response(status=404, response='Folder not found.')

    authenticated = viewer_sees_private()

    if not authenticated and (folder.private or not folder.available):
        return Response(status=404, response='Folder not found.')

    if folder.media_type != 'video':
        return jsonify([])

    videos = (
        _videos_query_for_folder(folder, authenticated)
        .order_by(Video.recorded_at.desc().nullslast(), Video.created_at.desc())
        .all()
    )
    return jsonify([_video_summary(v) for v in videos])


@api.route('/api/folders/<uuid>/images', methods=['GET'])
def get_folder_images(uuid):
    folder = MediaFolder.query.filter_by(uuid=uuid).first()
    if not folder:
        return Response(status=404, response='Folder not found.')

    authenticated = viewer_sees_private()

    if not authenticated and (folder.private or not folder.available):
        return Response(status=404, response='Folder not found.')

    if folder.media_type != 'image':
        return jsonify([])

    images = (
        _images_query_for_folder(folder, authenticated)
        .order_by(Image.created_at.desc())
        .all()
    )
    return jsonify([_image_summary(img) for img in images])


@api.route('/api/folders/<uuid>', methods=['PUT'])
@require_perm(P.EDIT_ANY)
def update_folder(uuid):
    folder = MediaFolder.query.filter_by(uuid=uuid).first()
    if not folder:
        return Response(status=404, response='Folder not found.')

    data = request.json
    if not data or 'private' not in data:
        return Response(status=400, response='private field is required.')

    folder.private = bool(data['private'])
    folder.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(folder.json())
