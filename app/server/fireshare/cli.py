#!/usr/bin/env python3
import os
import json
import signal
import sys
import click
from datetime import datetime
from flask import current_app, request
from fireshare import create_app, db, util, logger
from fireshare.models import User, Video, VideoInfo, FolderRule, VideoGameLink, VideoTagLink
from werkzeug.security import generate_password_hash
from pathlib import Path
from sqlalchemy import func
import time
import requests
import re

from .constants import SUPPORTED_FILE_EXTENSIONS

# Helper functions for persistent game suggestions storage
def _get_suggestions_file():
    """Get path to the suggestions JSON file"""
    from flask import current_app
    data_dir = Path(current_app.config.get('DATA_DIRECTORY', '/data'))
    return data_dir / 'game_suggestions.json'

def _load_suggestions():
    """Load suggestions from JSON file"""
    suggestions_file = _get_suggestions_file()
    if suggestions_file.exists():
        try:
            with open(suggestions_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def _save_suggestions(suggestions):
    """Save suggestions to JSON file"""
    suggestions_file = _get_suggestions_file()
    suggestions_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(suggestions_file, 'w') as f:
            json.dump(suggestions, f)
    except IOError as e:
        logger.error(f"Failed to save game suggestions: {e}")

def get_game_suggestion(video_id):
    """Get a game suggestion for a video"""
    suggestions = _load_suggestions()
    return suggestions.get(video_id)

def save_game_suggestion(video_id, suggestion):
    """Save a game suggestion for a video"""
    suggestions = _load_suggestions()
    suggestions[video_id] = suggestion
    _save_suggestions(suggestions)

def save_game_suggestions_batch(new_suggestions):
    """Save multiple game suggestions at once"""
    if not new_suggestions:
        return
    suggestions = _load_suggestions()
    suggestions.update(new_suggestions)
    _save_suggestions(suggestions)

def delete_game_suggestion(video_id):
    """Delete a game suggestion for a video"""
    suggestions = _load_suggestions()
    if video_id in suggestions:
        del suggestions[video_id]
        _save_suggestions(suggestions)
        return True
    return False

# Helper functions for persistent corrupt video tracking
def _get_corrupt_videos_file():
    """Get path to the corrupt videos JSON file"""
    from flask import current_app
    data_dir = Path(current_app.config.get('DATA_DIRECTORY', '/data'))
    return data_dir / 'corrupt_videos.json'

def _load_corrupt_videos():
    """Load corrupt videos list from JSON file"""
    corrupt_file = _get_corrupt_videos_file()
    if corrupt_file.exists():
        try:
            with open(corrupt_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []

def _save_corrupt_videos(corrupt_list):
    """Save corrupt videos list to JSON file"""
    corrupt_file = _get_corrupt_videos_file()
    corrupt_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(corrupt_file, 'w') as f:
            json.dump(corrupt_list, f)
    except IOError as e:
        logger.error(f"Failed to save corrupt videos list: {e}")

def is_video_corrupt(video_id):
    """Check if a video is marked as corrupt"""
    corrupt_list = _load_corrupt_videos()
    return video_id in corrupt_list

def mark_video_corrupt(video_id):
    """Mark a video as corrupt"""
    corrupt_list = _load_corrupt_videos()
    if video_id not in corrupt_list:
        corrupt_list.append(video_id)
        _save_corrupt_videos(corrupt_list)
        logger.info(f"Marked video {video_id} as corrupt")

def clear_video_corrupt(video_id):
    """Clear the corrupt status for a video"""
    corrupt_list = _load_corrupt_videos()
    if video_id in corrupt_list:
        corrupt_list.remove(video_id)
        _save_corrupt_videos(corrupt_list)
        logger.info(f"Cleared corrupt status for video {video_id}")
        return True
    return False

def get_all_corrupt_videos():
    """Get list of all corrupt video IDs"""
    return _load_corrupt_videos()

def clear_all_corrupt_videos():
    """Clear all corrupt video statuses"""
    count = len(_load_corrupt_videos())
    _save_corrupt_videos([])
    logger.info(f"Cleared corrupt status for {count} video(s)")
    return count

def send_discord_webhook(webhook_url=None, video_url=None):
    payload = {
        "content": video_url,
        "username": "Fireshare",
        "avatar_url": "https://github.com/ShaneIsrael/fireshare/raw/develop/app/client/src/assets/logo_square.png",
    }

    try:
        response = requests.post(webhook_url, json=payload)
        response.raise_for_status()
        print("Webhook sent successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Failed to send webhook: {e}")

def get_public_watch_url(video_id, config, host):
    shareable_link_domain = config.get("ui_config", {}).get("shareable_link_domain", "")
    if shareable_link_domain:
        if not shareable_link_domain.startswith("https://") and not shareable_link_domain.startswith("http://"):
            shareable_link_domain = f"https://{shareable_link_domain}"
        return f"{shareable_link_domain}/w/{video_id}"
    elif host:
        if not host.startswith("https://") and not host.startswith("http://"):
            host = f"https://{host}"
        return f"{host}/w/{video_id}"
    else:
        return print("--Unable to post to Discord--\nPlease check that your DOMAIN env variable is set correctly or that you have a shareable link domain set in your Admin settings.")
    
@click.group()
def cli():
    pass

@cli.command()
def init_db():
    with create_app().app_context():
        db.create_all()
        logger.info(f"Created database file at {current_app.config['SQLALCHEMY_DATABASE_URI']}")

@cli.command()
@click.option("--username", "-u", help="Username", required=True)
@click.option("--password", "-p", help="Password", prompt=True, hide_input=True)
def add_user(username, password):
    with create_app().app_context():
        new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
        db.session.add(new_user)
        db.session.commit()
        click.echo(f"Created user {username}")

@cli.command()
@click.option("--root", "-r", help="root video path to scan", required=False)
def scan_videos(root):
    with create_app().app_context():
        paths = current_app.config['PATHS']
        domain = current_app.config['DOMAIN']
        videos_path = paths["video"]
        video_links = paths["processed"] / "video_links"

        config_file = open(paths["data"] / "config.json")
        config = json.load(config_file)
        video_config = config["app_config"]["video_defaults"]
        discord_webhook_url = config["integrations"]["discord_webhook_url"]
        config_file.close()
        
        if not video_links.is_dir():
            video_links.mkdir()

        logger.info(f"Scanning {str(videos_path)} for {', '.join(SUPPORTED_FILE_EXTENSIONS)} video files")
        CHUNK_FILE_PATTERN = re.compile(r'\.part\d{4}$')
        TRANSCODE_PATTERN = re.compile(r'-(?:720p|1080p)\.mp4$', re.IGNORECASE)
        
        # Collect all video files and filter out transcoded versions
        all_files = [f for f in (videos_path / root if root else videos_path).glob('**/*') 
                     if f.is_file() and f.suffix.lower() in SUPPORTED_FILE_EXTENSIONS]
        
        video_files = []
        skipped_count = 0
        for f in all_files:
            if CHUNK_FILE_PATTERN.search(f.name):
                continue  # Skip chunk files silently
            elif f.name.startswith('._'):
                continue  # Skip macOS sidecar files silently
            elif TRANSCODE_PATTERN.search(f.name):
                logger.debug(f"Skipping transcoded file: {f.name}")
                skipped_count += 1
            else:
                video_files.append(f)
        
        if skipped_count > 0:
            logger.info(f"Skipped {skipped_count} transcoded video file(s)")
        
        video_rows = Video.query.all()

        new_videos = []
        for vf in video_files:
            path = str(vf.relative_to(videos_path)) 
            video_id = util.video_id(vf)
            existing = next((vr for vr in video_rows if vr.video_id == video_id), None)
            duplicate = next((dvr for dvr in new_videos if dvr.video_id == video_id), None)
            if duplicate:
                logger.info(f"Found duplicate video {video_id} as {str(path)}, skipping...")
            elif existing:
                if not existing.available:
                    logger.info(f"Updating Video {video_id}, available=True")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "available": True })
                if not existing.created_at:
                    created_at = datetime.fromtimestamp(os.path.getctime(f"{videos_path}/{path}"))
                    logger.info(f"Updating Video {video_id}, created_at={created_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "created_at": created_at })
                if not existing.updated_at:
                    updated_at = datetime.fromtimestamp(os.path.getmtime(f"{videos_path}/{path}"))
                    logger.info(f"Updating Video {video_id}, updated_at={updated_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "updated_at": updated_at })
            else:
                created_at = datetime.fromtimestamp(os.path.getctime(f"{videos_path}/{path}"))
                updated_at = datetime.fromtimestamp(os.path.getmtime(f"{videos_path}/{path}"))
                recorded_at = util.extract_date_from_file(vf)
                v = Video(video_id=video_id, extension=vf.suffix, path=path, available=True, created_at=created_at, updated_at=updated_at, recorded_at=recorded_at)
                logger.info(f"Adding new Video {video_id} at {str(path)} (created {created_at.isoformat()}, updated {updated_at.isoformat()}, recorded {recorded_at.isoformat() if recorded_at else 'N/A'})")
                new_videos.append(v)
        
        if new_videos:
            db.session.add_all(new_videos)
        else:
            logger.info(f"No new videos found, checked {len(video_files)} files.")
        db.session.commit()

        fd = os.open(str(video_links.absolute()), os.O_DIRECTORY)
        for nv in new_videos:
            src = Path((paths["video"] / nv.path).absolute())
            dst = Path(paths["processed"] / "video_links" / (nv.video_id + nv.extension))
            common_root = Path(*os.path.commonprefix([src.parts, dst.parts]))
            num_up = len(dst.parts)-1 - len(common_root.parts)
            prefix = "../" * num_up
            rel_src = Path(prefix + str(src).replace(str(common_root), ''))
            if not dst.exists():
                logger.info(f"Linking {str(rel_src)} --> {str(dst)}")
                try:
                    os.symlink(src, dst, dir_fd=fd)
                except FileExistsError:
                    logger.info(f"{dst} exists already")
            info = VideoInfo(video_id=nv.video_id, title=Path(nv.path).stem, private=video_config["private"])
            db.session.add(info)
        db.session.commit()
        if discord_webhook_url:
            for nv in new_videos:
                logger.info(f"Posting to Discord webhook")
                video_url = get_public_watch_url(nv.video_id, config, domain)
                send_discord_webhook(webhook_url=discord_webhook_url, video_url=video_url)

        # Auto-tag new videos based on folder rules
        auto_tagged = set()
        if new_videos:
            folder_rules = {rule.folder_path: rule.game_id for rule in FolderRule.query.all()}
            if folder_rules:
                logger.info(f"Checking {len(new_videos)} new video(s) against {len(folder_rules)} folder rule(s)")
            for nv in new_videos:
                parts = nv.path.split('/')
                if len(parts) > 1:
                    folder = parts[0]
                    if folder in folder_rules:
                        game_id = folder_rules[folder]
                        link = VideoGameLink(video_id=nv.video_id, game_id=game_id, created_at=datetime.utcnow())
                        db.session.add(link)
                        auto_tagged.add(nv.video_id)
                        logger.info(f"[Folder Rule] Auto-tagged {nv.video_id} to game {game_id} (folder: {folder})")
            if auto_tagged:
                db.session.commit()
                logger.info(f"Auto-tagged {len(auto_tagged)} video(s) via folder rules")

        # Automatic game detection for new videos (skip already tagged)
        steamgriddb_api_key = config.get("integrations", {}).get("steamgriddb_api_key")
        if new_videos:
            videos_needing_detection = [nv for nv in new_videos if nv.video_id not in auto_tagged]
            logger.info(f"Running game detection for {len(videos_needing_detection)} new video(s)...")
            pending_suggestions = {}
            for nv in videos_needing_detection:
                filename = Path(nv.path).stem
                logger.info(f"[Game Detection] Video: {nv.video_id}, Path: {nv.path}, Filename: {filename}")
                detected_game = util.detect_game_from_filename(filename, steamgriddb_api_key, path=nv.path)

                if detected_game:
                    logger.info(f"[Game Detection] Result: {detected_game['game_name']} (confidence: {detected_game['confidence']:.2f}, source: {detected_game['source']})")
                    if detected_game['confidence'] >= 0.65:
                        pending_suggestions[nv.video_id] = detected_game
                        logger.info(f"[Game Detection] Queued suggestion for {nv.video_id}")
                    else:
                        logger.info(f"[Game Detection] Confidence too low, skipping suggestion")
                else:
                    logger.info(f"[Game Detection] No match found for {nv.video_id}")
            # Batch save all suggestions at once
            if pending_suggestions:
                save_game_suggestions_batch(pending_suggestions)
                logger.info(f"[Game Detection] Saved {len(pending_suggestions)} suggestion(s) in batch")

        existing_videos = Video.query.filter_by(available=True).all()
        logger.info(f"Verifying {len(existing_videos):,} video files still exist...")
        for ev in existing_videos:
            file_path = Path((paths["video"] / ev.path).absolute())
            logger.debug(f"Verifying video {ev.video_id} at {file_path} is available")
            if not file_path.exists():
                logger.warning(f"Video {ev.video_id} at {file_path} was not found")
                db.session.query(Video).filter_by(video_id=ev.video_id).update({ "available": False})
        db.session.commit()

@cli.command()
@click.pass_context
@click.option("--path", "-p", help="path to video to scan", required=False)
@click.option("--tag-ids", help="comma-separated custom tag IDs to apply", required=False, default=None)
@click.option("--game-id", type=int, help="game ID to apply", required=False, default=None)
@click.option("--title", help="initial title for the video (defaults to filename stem)", required=False, default=None)
def scan_video(ctx, path, tag_ids, game_id, title):
    with create_app().app_context():
        paths = current_app.config['PATHS']
        domain = current_app.config['DOMAIN']
        videos_path = paths["video"]
        video_links = paths["processed"] / "video_links"
        thumbnail_skip = current_app.config['THUMBNAIL_VIDEO_LOCATION'] or 0
        if thumbnail_skip > 0 and thumbnail_skip <= 100:
            thumbnail_skip = thumbnail_skip / 100
        else:
            thumbnail_skip = 0
        
        config_file = open(paths["data"] / "config.json")
        config = json.load(config_file)
        video_config = config["app_config"]["video_defaults"]
        discord_webhook_url = config["integrations"]["discord_webhook_url"]

        config_file.close()
        
        if not video_links.is_dir():
            video_links.mkdir()
        
        CHUNK_FILE_PATTERN = re.compile(r'\.part\d{4}$')
        TRANSCODE_PATTERN = re.compile(r'-(?:720p|1080p)\.mp4$', re.IGNORECASE)
        
        # Check if the file is a transcoded version and skip it
        if (videos_path / path).is_file() and TRANSCODE_PATTERN.search((videos_path / path).name):
            logger.warning(f"Skipping transcoded file: {path}. Transcoded files should not be scanned.")
            return
        
        video_file = ((videos_path / path) if (videos_path / path).is_file()
                     and (videos_path / path).suffix.lower() in SUPPORTED_FILE_EXTENSIONS
                     and not CHUNK_FILE_PATTERN.search((videos_path / path).name)
                     and not TRANSCODE_PATTERN.search((videos_path / path).name)
                     and not (videos_path / path).name.startswith('._') else None)
        if video_file:
            video_rows = Video.query.all()
            logger.info(f"Scanning {str(video_file)}")

            path = str(video_file.relative_to(videos_path)) 
            video_id = util.video_id(video_file)
            existing = next((vr for vr in video_rows if vr.video_id == video_id), None)
            if existing:
                if not existing.available:
                    logger.info(f"Updating Video {video_id}, available=True")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "available": True })
                if not existing.created_at:
                    created_at = datetime.fromtimestamp(os.path.getctime(f"{videos_path}/{path}"))
                    logger.info(f"Updating Video {video_id}, created_at={created_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "created_at": created_at })
                if not existing.updated_at:
                    updated_at = datetime.fromtimestamp(os.path.getmtime(f"{videos_path}/{path}"))
                    logger.info(f"Updating Video {video_id}, updated_at={updated_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "updated_at": updated_at })
            else:
                created_at = datetime.fromtimestamp(os.path.getctime(f"{videos_path}/{path}"))
                updated_at = datetime.fromtimestamp(os.path.getmtime(f"{videos_path}/{path}"))
                recorded_at = util.extract_date_from_file(video_file)
                v = Video(video_id=video_id, extension=video_file.suffix, path=path, available=True, created_at=created_at, updated_at=updated_at, recorded_at=recorded_at)
                logger.info(f"Adding new Video {video_id} at {str(path)} (created {created_at.isoformat()}, updated {updated_at.isoformat()}, recorded {recorded_at.isoformat() if recorded_at else 'N/A'})")
                db.session.add(v)
                fd = os.open(str(video_links.absolute()), os.O_DIRECTORY)
                src = Path((paths["video"] / v.path).absolute())
                dst = Path(paths["processed"] / "video_links" / (video_id + video_file.suffix))
                common_root = Path(*os.path.commonprefix([src.parts, dst.parts]))
                num_up = len(dst.parts)-1 - len(common_root.parts)
                prefix = "../" * num_up
                rel_src = Path(prefix + str(src).replace(str(common_root), ''))
                if not dst.exists():
                    logger.info(f"Linking {str(rel_src)} --> {str(dst)}")
                    try:
                        os.symlink(src, dst, dir_fd=fd)
                    except FileExistsError:
                        logger.info(f"{dst} exists already")
                info = VideoInfo(video_id=v.video_id, title=title or Path(v.path).stem, private=video_config["private"])
                db.session.add(info)
                db.session.commit()

                # Apply pre-upload metadata (tags and game) passed from the upload endpoint
                if tag_ids:
                    for tid in [int(t) for t in tag_ids.split(',') if t.strip().isdigit()]:
                        if not VideoTagLink.query.filter_by(video_id=v.video_id, tag_id=tid).first():
                            db.session.add(VideoTagLink(video_id=v.video_id, tag_id=tid, created_at=datetime.utcnow()))
                    db.session.commit()
                if game_id and not VideoGameLink.query.filter_by(video_id=v.video_id).first():
                    db.session.add(VideoGameLink(video_id=v.video_id, game_id=game_id, created_at=datetime.utcnow()))
                    db.session.commit()

                # Check folder rules for auto-tagging
                auto_tagged = False
                parts = v.path.split('/')
                if len(parts) > 1:
                    folder = parts[0]
                    folder_rule = FolderRule.query.filter_by(folder_path=folder).first()
                    if folder_rule:
                        link = VideoGameLink(video_id=v.video_id, game_id=folder_rule.game_id, created_at=datetime.utcnow())
                        db.session.add(link)
                        db.session.commit()
                        auto_tagged = True
                        logger.info(f"[Folder Rule] Auto-tagged {v.video_id} to game {folder_rule.game_id} (folder: {folder})")

                # Automatic game detection (skip if already auto-tagged)
                if not auto_tagged:
                    logger.info("Attempting automatic game detection...")
                    steamgriddb_api_key = config.get("integrations", {}).get("steamgriddb_api_key")
                    filename = Path(v.path).stem
                    detected_game = util.detect_game_from_filename(filename, steamgriddb_api_key, path=v.path)

                    if detected_game and detected_game['confidence'] >= 0.65:
                        save_game_suggestion(v.video_id, detected_game)
                        logger.info(f"Created game suggestion for video {v.video_id}: {detected_game['game_name']} (confidence: {detected_game['confidence']:.2f}, source: {detected_game['source']})")
                    else:
                        logger.info(f"No confident game match found for video {v.video_id}")

                logger.info("Syncing metadata")
                ctx.invoke(sync_metadata, video=video_id)
                info = VideoInfo.query.filter(VideoInfo.video_id==video_id).one()

                processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
                logger.info(f"Checking for videos with missing posters...")
                derived_path = Path(processed_root, "derived", info.video_id)
                video_path = Path(processed_root, "video_links", info.video_id + video_file.suffix)
                if video_path.exists():
                    
                    poster_path = Path(derived_path, "poster.jpg")
                    should_create_poster = not poster_path.exists()
                    if should_create_poster:
                        if not derived_path.exists():
                            derived_path.mkdir(parents=True)
                        poster_time = int((info.duration or 0) * thumbnail_skip)
                        util.create_poster(video_path, derived_path / "poster.jpg", poster_time)
                    else:
                        logger.debug(f"Skipping creation of poster for video {info.video_id} because it exists at {str(poster_path)}")
                    db.session.commit()
                    
                    if discord_webhook_url:
                        logger.info(f"Posting to Discord webhook")
                        video_url = get_public_watch_url(video_id, config, domain)
                        send_discord_webhook(webhook_url=discord_webhook_url, video_url=video_url)

                    if current_app.config.get('ENABLE_TRANSCODING'):
                        auto_transcode = config.get('transcoding', {}).get('auto_transcode', True)
                        if auto_transcode:
                            logger.info(f"Auto-transcoding uploaded video {video_id}")
                            ctx.invoke(transcode_videos, video=video_id)
                else:
                    logger.warning(f"Skipping creation of poster for video {info.video_id} because the video at {str(video_path)} does not exist or is not accessible")
        else:
            logger.info(f"Invalid video file, unable to scan: {str(videos_path / path)}")

@cli.command()
def repair_symlinks():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        video_links = paths["processed"] / "video_links"

        if not video_links.is_dir():
            video_links.mkdir()

        fd = os.open(str(video_links.absolute()), os.O_DIRECTORY)
        all_videos = Video.query.all()
        for nv in all_videos:
            src = Path((paths["video"] / nv.path).absolute())
            dst = Path(paths["processed"] / "video_links" / (nv.video_id + nv.extension))
            common_root = Path(*os.path.commonprefix([src.parts, dst.parts]))
            num_up = len(dst.parts)-1 - len(common_root.parts)
            prefix = "../" * num_up
            rel_src = Path(prefix + str(src).replace(str(common_root), ''))
            if not dst.exists():
                logger.info(f"Linking {str(rel_src)} --> {str(dst)}")
                try:
                    os.symlink(src, dst, dir_fd=fd)
                except FileExistsError:
                    logger.info(f"{dst} exists already")

@cli.command()
@click.option("--video", "-v", help="The video to sync metadata from", default=None)
def sync_metadata(video):
    with create_app().app_context():
        paths = current_app.config['PATHS']
        videos = VideoInfo.query.filter(VideoInfo.video_id==video).all() if video else VideoInfo.query.filter(VideoInfo.info==None).all()
        logger.info(f'Found {len(videos):,} videos without metadata')
        for v in videos:
            vpath = paths["processed"] / "video_links" / str(v.video_id + v.video.extension)
            if Path(vpath).is_file():
                info = None
                while info == None:
                    info = util.get_media_info(vpath)
                    if info == None:
                        corruptVideoWarning = "There may be a corrupt video in your video Directory. See your logs for more info!"
                        if not corruptVideoWarning in current_app.config['WARNINGS']:
                            current_app.config['WARNINGS'].append(corruptVideoWarning)
                        logger.warning(f"[{v.video.path}] - There may be a corrupt file in your video directory. Or, you may be recording to the video directory and haven't finished yet.")
                        logger.warning(f"For more info and to find the offending file, run this command in your container: \"stat {vpath}\"")
                        logger.warning("I'll try to process this file again in 60 seconds...")
                        time.sleep(60)
                
                corruptVideoWarning = "There may be a corrupt video in your video Directory. See your logs for more info!"
                if corruptVideoWarning in current_app.config['WARNINGS']:
                    position = current_app.config['WARNINGS'].index(corruptVideoWarning)
                    current_app.config['WARNINGS'].pop(position)

                video_codecs = [i for i in info if i['codec_type'] == 'video']
                if not video_codecs:
                    logger.warning(f"No video stream found in {v.video.path} (video_id={v.video_id}). Skipping metadata sync.")
                    mark_video_corrupt(v.video_id)
                    continue
                vcodec = video_codecs[0]
                duration = 0
                if 'duration' in vcodec:
                    duration = float(vcodec['duration'])
                elif 'tags' in vcodec:
                    if 'DURATION' in vcodec['tags']:
                        duration = util.dur_string_to_seconds(vcodec['tags']['DURATION'])
                    else:
                        duration = 0
                width, height = int(vcodec['width']), int(vcodec['height'])
                logger.info(f'Scanned {v.video_id} duration={duration}s, resolution={width}x{height}: {v.video.path}')
                v.info = json.dumps(info)
                v.duration = duration
                v.width = width
                v.height = height
                db.session.add(v)
                db.session.commit()
            else:
                logger.warning(f"Missing or invalid symlink at {vpath} to video {v.video_id} (original location: {v.video.path})")

@cli.command()
def create_web_videos():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        video_links = paths["processed"] / "video_links"
        videos = Video.query.filter(func.lower(Video.extension)=='.mkv').all()
        fd = os.open(str(video_links.absolute()), os.O_DIRECTORY)
        for v in videos:
            vpath = paths["processed"] / "video_links" / str(v.video_id + v.extension)
            if Path(vpath).is_file():
                logger.info(f"Found mkv video to process {v.video_id}: {v.path}")
                out_mp4_fn = paths["processed"] / "derived" / v.video_id / f"{v.video_id}-1.mp4"
                if not out_mp4_fn.exists():
                    # TODO check video codec and if it's h264 already, just do a simple ffmpeg -i input.mkv -c copy output.mp4
                    # Otherwise, transcode it
                    util.transcode_video(vpath, out_mp4_fn)

                    dst = Path(paths["processed"] / "video_links" / f"{v.video_id}-1.mp4")
                    common_root = Path(*os.path.commonprefix([out_mp4_fn.parts, dst.parts]))
                    num_up = len(dst.parts)-1 - len(common_root.parts)
                    prefix = "../" * num_up
                    rel_src = Path(prefix + str(out_mp4_fn).replace(str(common_root), ''))
                    if not dst.exists():
                        logger.info(f"Linking {str(rel_src)} --> {str(dst)}")
                        try:
                            os.symlink(out_mp4_fn, dst, dir_fd=fd)
                        except FileExistsError:
                            logger.info(f"{dst} exists already")
                else:
                    logger.debug(f"Skipping {v.video_id} because {str(out_mp4_fn)} already exists")

            else:
                logger.warning(f"Missing or invalid symlink at {vpath} to video {v.video_id} (original location: {v.video.path})")
        

@cli.command()
@click.option("--regenerate", "-r", help="Overwrite existing posters", is_flag=True)
@click.option("--skip", "-s", help="Amount to skip into the video before extracting a poster image, as a %, e.g. 0.05 for 5%", type=float, default=0)
def create_posters(regenerate, skip):
    with create_app().app_context():
        processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
        vinfos = VideoInfo.query.all()
        logger.info(f"Checking for videos with missing posters...")
        for vi in vinfos:
            derived_path = Path(processed_root, "derived", vi.video_id)
            video_path = Path(processed_root, "video_links", vi.video_id + vi.video.extension)
            if not video_path.exists():
                logger.warning(f"Skipping creation of poster for video {vi.video_id} because the video at {str(video_path)} does not exist or is not accessible")
                continue
            poster_path = Path(derived_path, "poster.jpg")
            should_create_poster = (not poster_path.exists() or regenerate)
            if should_create_poster:
                if not derived_path.exists():
                    derived_path.mkdir(parents=True)
                poster_time = int(vi.duration * skip)
                util.create_poster(video_path, derived_path / "poster.jpg", poster_time)
            else:
                logger.debug(f"Skipping creation of poster for video {vi.video_id} because it exists at {str(poster_path)}")

@cli.command()
@click.option("--regenerate", "-r", help="Overwrite existing posters", is_flag=True)
def create_boomerang_posters(regenerate):
    with create_app().app_context():
        processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
        vinfos = VideoInfo.query.all()
        for vi in vinfos:
            derived_path = Path(processed_root, "derived", vi.video_id)
            video_path = Path(processed_root, "video_links", vi.video_id + vi.video.extension)
            if not video_path.exists():
                logger.info(f"Skipping creation of boomerang poster for video {vi.video_id} because the video at {str(video_path)} does not exist or is not accessible")
                continue
            poster_path = Path(derived_path, "boomerang-preview.webm")
            should_create_poster = (not poster_path.exists() or regenerate)
            if should_create_poster:
                if not derived_path.exists():
                    derived_path.mkdir(parents=True)
                util.create_boomerang_preview(video_path, poster_path)
            else:
                logger.info(f"Skipping creation of boomerang poster for video {vi.video_id} because it exists at {str(poster_path)}")

@cli.command()
@click.option("--regenerate", "-r", help="Overwrite existing transcoded videos", is_flag=True)
@click.option("--video", "-v", help="Transcode a specific video by id", default=None)
@click.option("--include-corrupt", help="Include videos previously marked as corrupt", is_flag=True)
def transcode_videos(regenerate, video, include_corrupt):
    """Transcode videos to enabled resolution variants (1080p, 720p, 480p)"""

    # Store data_path for signal handler access
    _transcode_state = {'data_path': None}

    def handle_cancel(signum, frame):
        logger.info("Transcoding cancelled by user")
        if _transcode_state['data_path']:
            util.clear_transcoding_status(_transcode_state['data_path'])
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_cancel)

    with create_app().app_context():
        if not current_app.config.get('ENABLE_TRANSCODING'):
            logger.info("Transcoding is disabled. Set ENABLE_TRANSCODING=true to enable.")
            return

        paths = current_app.config['PATHS']
        _transcode_state['data_path'] = paths['data']
        processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
        use_gpu = current_app.config.get('TRANSCODE_GPU', False)
        base_timeout = current_app.config.get('TRANSCODE_TIMEOUT', 7200)

        # Read transcoding settings from config
        config_path = paths['data'] / 'config.json'
        transcoding_config = {}
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = json.load(f)
                transcoding_config = config.get('transcoding', {})

        encoder_preference = transcoding_config.get('encoder_preference', 'auto')

        # Build list of enabled resolutions (highest to lowest)
        resolutions = []
        if transcoding_config.get('enable_1080p', True):
            resolutions.append(1080)
        if transcoding_config.get('enable_720p', True):
            resolutions.append(720)
        if transcoding_config.get('enable_480p', True):
            resolutions.append(480)

        # Get videos to transcode
        vinfos = VideoInfo.query.filter(VideoInfo.video_id==video).all() if video else VideoInfo.query.all()

        # Filter out corrupt videos unless explicitly included
        corrupt_videos = set(get_all_corrupt_videos())
        if not include_corrupt and not video:
            original_count = len(vinfos)
            vinfos = [vi for vi in vinfos if vi.video_id not in corrupt_videos]
            skipped_count = original_count - len(vinfos)
            if skipped_count > 0:
                logger.info(f"Skipping {skipped_count} video(s) previously marked as corrupt. Use --include-corrupt to retry them.")

        # Build work queue: list of (video_info, height) tuples that actually need transcoding
        # Also reconcile has_* flags if outputs already exist on disk.
        work_items = []
        skipped_missing_source = 0
        skipped_source_too_small = 0
        skipped_existing_output = 0
        reconciled_flag_updates = 0
        reconciled_videos = set()
        for vi in vinfos:
            video_path = Path(processed_root, "video_links", vi.video_id + vi.video.extension)
            if not video_path.exists():
                skipped_missing_source += 1
                if video:
                    logger.warning(f"Skipping video {vi.video_id}: source file not found at {video_path}")
                continue
            derived_path = Path(processed_root, "derived", vi.video_id)
            original_height = vi.height or 0
            for height in resolutions:
                if original_height > 0 and original_height <= height:
                    skipped_source_too_small += 1
                    if video:
                        logger.info(
                            f"Skipping {vi.video_id} {height}p: source height ({original_height}p) "
                            f"is not greater than target"
                        )
                    continue
                transcode_path = derived_path / f"{vi.video_id}-{height}p.mp4"
                has_attr = f'has_{height}p'
                output_exists = transcode_path.exists()

                if output_exists and getattr(vi, has_attr, False) is not True:
                    setattr(vi, has_attr, True)
                    reconciled_flag_updates += 1
                    reconciled_videos.add(vi.video_id)
                    if video:
                        logger.info(f"Detected existing {height}p output on disk; updating {has_attr}=True for {vi.video_id}")

                if output_exists and not regenerate:
                    skipped_existing_output += 1
                    if video:
                        logger.info(f"Skipping {vi.video_id} {height}p: output already exists at {transcode_path}")
                    continue

                work_items.append((vi, height, video_path, derived_path, transcode_path))

        if reconciled_flag_updates > 0:
            db.session.commit()
            logger.info(
                f"Reconciled transcode flags from disk for {len(reconciled_videos)} video(s), "
                f"updated {reconciled_flag_updates} flag value(s)."
            )

        total_jobs = len(work_items)
        logger.info(f'Processing {total_jobs:,} transcode job(s) (GPU: {use_gpu}, Encoder: {encoder_preference})')

        # Claim ownership of the status file immediately so the SSE poller has a
        # stable is_running=True signal to detect regardless of how we were invoked
        # (upload auto-transcode, bulk-import, or manual queue).  We overwrite any
        # earlier placeholder written by _launch_scan_video or bulk_import so that
        # our own PID is authoritative for the duration of this function.
        util.write_transcoding_status(paths['data'], 0, total_jobs, pid=os.getpid())

        if total_jobs == 0:
            if video:
                vi = vinfos[0] if vinfos else None
                logger.info(
                    f"Single-video planner summary for {video}: "
                    f"found_video_info={bool(vi)}, source_height={vi.height if vi else None}, "
                    f"enabled_targets={','.join(f'{h}p' for h in resolutions) if resolutions else 'none'}, "
                    f"regenerate={regenerate}, include_corrupt={include_corrupt}"
                )
                logger.info(
                    "Single-video planner breakdown: "
                    f"missing_source={skipped_missing_source}, "
                    f"source_too_small={skipped_source_too_small}, "
                    f"already_exists={skipped_existing_output}"
                )
            logger.info("No videos need transcoding")
            util.clear_transcoding_status(paths['data'])
            return

        # Remove any leftover *.mp4.tmp files from a previous run that crashed
        # before the temp file could be renamed to its final location.
        derived_root = Path(processed_root, "derived")
        if derived_root.exists():
            for tmp_file in derived_root.glob('**/*.tmp.mp4'):
                try:
                    tmp_file.unlink()
                    logger.info(f"Removed stale temp transcode file: {tmp_file}")
                except OSError as ex:
                    logger.warning(f"Could not remove stale temp file {tmp_file}: {ex}")

        # Track corrupt videos to skip remaining heights for that video
        corrupt_video_ids = set()

        for idx, (vi, height, video_path, derived_path, transcode_path) in enumerate(work_items, 1):
            # Skip if this video was marked corrupt during this run
            if vi.video_id in corrupt_video_ids:
                continue

            # Update transcoding progress
            util.write_transcoding_status(paths['data'], idx, total_jobs, vi.title, resolution=f"{height}p")

            if not derived_path.exists():
                derived_path.mkdir(parents=True)

            has_attr = f'has_{height}p'

            logger.info(f"[{idx}/{total_jobs}] Transcoding {vi.video_id} to {height}p ({vi.video.path})")
            success, failure_reason = util.transcode_video_quality(
                video_path, transcode_path, height, use_gpu, None, encoder_preference,
                data_path=paths['data']
            )
            if success:
                setattr(vi, has_attr, True)
                if is_video_corrupt(vi.video_id):
                    clear_video_corrupt(vi.video_id)
                db.session.add(vi)
                db.session.commit()
            elif failure_reason == 'corruption':
                logger.warning(f"Skipping video {vi.video_id} {height}p transcode - source file appears corrupt")
                mark_video_corrupt(vi.video_id)
                corrupt_video_ids.add(vi.video_id)
            else:
                logger.warning(f"Skipping video {vi.video_id} {height}p transcode - all encoders failed")

        util.clear_transcoding_status(paths['data'])
        logger.info("Transcoding complete")

@cli.command()
@click.pass_context
@click.option("--root", "-r", help="root video path to scan", required=False)
def bulk_import(ctx, root):
    with create_app().app_context():
        paths = current_app.config['PATHS']
        if util.lock_exists(paths["data"]):
            logger.info(f"A scan process is currently active... Aborting. (Remove {paths['data']/'fireshare.lock'} to continue anyway)")
            return
        util.create_lock(paths["data"])

        thumbnail_skip = current_app.config['THUMBNAIL_VIDEO_LOCATION'] or 0
        if thumbnail_skip > 0 and thumbnail_skip <= 100:
            thumbnail_skip = thumbnail_skip / 100
        else:
            thumbnail_skip = 0

        timing = {}
        s = time.time()
        ctx.invoke(scan_videos, root=root)
        timing['scan_videos'] = time.time() - s
        s = time.time()
        ctx.invoke(sync_metadata)
        timing['sync_metadata'] = time.time() - s
        s = time.time()
        ctx.invoke(create_posters, skip=thumbnail_skip)
        timing['create_posters'] = time.time() - s
        
        # Transcode videos if transcoding is enabled and auto_transcode is on
        if current_app.config.get('ENABLE_TRANSCODING'):
            # Check if auto_transcode is enabled in config.json
            config_path = paths['data'] / 'config.json'
            auto_transcode = True  # Default to True
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    auto_transcode = config.get('transcoding', {}).get('auto_transcode', True)

            if auto_transcode:
                util.write_transcoding_status(paths['data'], 0, 0, None, os.getpid())
                s = time.time()
                ctx.invoke(transcode_videos)
                timing['transcode_videos'] = time.time() - s
            else:
                logger.info("Skipping automatic transcoding (auto_transcode is disabled in settings)")

        logger.info(f"Finished bulk import. Timing info: {json.dumps(timing)}")

        util.clear_transcoding_status(paths['data'])
        util.remove_lock(paths["data"])

if __name__=="__main__":
    cli()
