import json
import time
from datetime import datetime
from pathlib import Path

import requests as http_requests
from flask import current_app, jsonify, request, Response, render_template, redirect
from flask_login import login_required, current_user

from .. import db, logger
from ..models import Video, VideoInfo
from ..cli import send_discord_webhook, send_generic_webhook
from . import api


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
            # Find package.json relative to this file: app/server/fireshare/api/ -> app/client/package.json
            api_dir = Path(__file__).parent
            package_json_path = api_dir.parent.parent.parent / 'client' / 'package.json'

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
        response = http_requests.get(
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

    except http_requests.RequestException as e:
        logger.error(f"Failed to fetch GitHub releases: {e}")
        return None


@api.route('/w/<video_id>')
def video_metadata(video_id):
    video = Video.query.filter_by(video_id=video_id).first()
    domain = f"https://{current_app.config['DOMAIN']}" if current_app.config['DOMAIN'] else ""
    if video:
        derived_dir = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id)
        poster_file = "custom_poster.webp" if (derived_dir / "custom_poster.webp").exists() else "poster.jpg"
        return render_template('metadata.html', video=video.json(), domain=domain, poster_file=poster_file)
    else:
        return redirect('{}/watch/{}'.format(domain, video_id), code=302)


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
        public_config["allow_public_folder_selection"] = config.get("app_config", {}).get("allow_public_folder_selection", False)
        return public_config
    else:
        return jsonify({})


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
                'type': 'video/mp4'  # Or appropriate mimetype
            },
            'media_thumbnail': poster_url
        }
        rss_items.append(item)

    now_str = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

    return Response(
        render_template('rss.xml', items=rss_items, domain=frontend_domain, now=now_str, feed_title=rss_title, feed_description=rss_description),
        mimetype='application/rss+xml'
    )


@api.route('/api/test-discord-webhook', methods=['POST'])
def test_discord_webhook():
    data = request.get_json()
    webhook_url = data.get('webhook_url')
    video_url = data.get('video_url', 'https://fireshare.test.worked')

    if not webhook_url:
        return jsonify({"error": "No Discord Webhook URL provided"}), 400
    try:
        result = send_discord_webhook(webhook_url, video_url)
        if result and isinstance(result, dict):
            if result.get("status") == "success":
                return jsonify({"message": "Discord Webhook sent successfully!"}), 200
            else:
                return jsonify({"error": result.get("message", "Unknown discord error")}), 500
        else:
            return jsonify({"error": "Webhook function did not return a valid response object"}), 500
    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500


@api.route('/api/test-webhook', methods=['POST'])
def test_webhook():
    data = request.get_json()
    webhook_url = data.get('webhook_url')
    video_url = data.get('video_url')
    payload = data.get('payload')

    if not webhook_url:
        return jsonify({"error": "No Webhook URL provided"}), 400
    try:
        result = send_generic_webhook(webhook_url, video_url, payload)
        if result.get("status") == "success":
            return jsonify({"message": "Webhook sent successfully!"}), 200
        else:
            return jsonify({"error": result.get("message")}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.after_request
def after_request(response):
    response.headers.add('Accept-Ranges', 'bytes')
    return response
