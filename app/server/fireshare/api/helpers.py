import json
import os
import re
from functools import wraps
from flask import current_app
from .. import logger
from ..models import Video


def secure_filename(filename):
    clean = re.sub(r"[/\\?%*:|\"<>\x7F\x00-\x1F]", "-", filename)
    return clean


def add_cache_headers(response, cache_key, max_age=604800):
    """Add cache headers for static assets (default: 7 days)."""
    response.headers['Cache-Control'] = f'public, max-age={max_age}, must-revalidate'
    response.headers['ETag'] = f'"{cache_key}"'
    return response


def add_poster_cache_headers(response, etag):
    """Add cache headers for poster images: always revalidate so custom/generated switches are picked up."""
    response.headers['Cache-Control'] = 'no-cache, must-revalidate'
    response.headers['ETag'] = f'"{etag}"'
    return response


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
    from flask_login import current_user

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

    # Handle cropped source quality
    if quality == 'cropped':
        cropped_path = paths["processed"] / "derived" / id / f"{id}-cropped.mp4"
        if cropped_path.exists():
            return str(cropped_path)
        # Fall back to original if crop file doesn't exist yet
        logger.warning(f"Requested cropped version for video {id} not found, falling back to original")

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
