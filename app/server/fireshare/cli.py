#!/usr/bin/env python3
import os
import json
import click
from datetime import datetime
from flask import current_app
from fireshare import create_app, db, util, logger
from fireshare.models import User, Video, VideoInfo
from werkzeug.security import generate_password_hash
from pathlib import Path
from sqlalchemy import func
import time

from .constants import SUPPORTED_FILE_EXTENSIONS

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
        new_user = User(username=username, password=generate_password_hash(password, method='sha256'))
        db.session.add(new_user)
        db.session.commit()
        click.echo(f"Created user {username}")

@cli.command()
def scan_videos():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        raw_videos = paths["video"]
        video_links = paths["processed"] / "video_links"
        
        config_file = open(paths["data"] / "config.json")
        video_config = json.load(config_file)["app_config"]["video_defaults"]
        config_file.close()
        
        if not video_links.is_dir():
            video_links.mkdir()

        logger.info(f"Scanning {str(raw_videos)} for {', '.join(SUPPORTED_FILE_EXTENSIONS)} video files")
        video_files = [f for f in raw_videos.glob('**/*') if f.is_file() and f.suffix.lower() in SUPPORTED_FILE_EXTENSIONS]
        video_rows = Video.query.all()

        new_videos = []
        for vf in video_files:
            path = str(vf.relative_to(raw_videos))
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
                    created_at = datetime.fromtimestamp(os.path.getctime(f"{raw_videos}/{path}"))
                    logger.info(f"Updating Video {video_id}, created_at={created_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "created_at": created_at })
                if not existing.updated_at:
                    updated_at = datetime.fromtimestamp(os.path.getmtime(f"{raw_videos}/{path}"))
                    logger.info(f"Updating Video {video_id}, updated_at={updated_at}")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "updated_at": updated_at })
            else:
                created_at = datetime.fromtimestamp(os.path.getctime(f"{raw_videos}/{path}"))
                updated_at = datetime.fromtimestamp(os.path.getmtime(f"{raw_videos}/{path}"))
                v = Video(video_id=video_id, extension=vf.suffix, path=path, available=True, created_at=created_at, updated_at=updated_at)
                logger.info(f"Adding new Video {video_id} at {str(path)} (created {created_at.isoformat()}, updated {updated_at.isoformat()})")
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

        existing_videos = Video.query.filter_by(available=True).all()
        logger.info(f"Verifying {len(existing_videos):,} video files still exist...")
        for ev in existing_videos:
            file_path = Path((paths["video"] / ev.path).absolute())
            logger.debug(f"Verifying video {ev.video_id} at {file_path} is available")
            if not file_path.exists():
                logger.warn(f"Video {ev.video_id} at {file_path} was not found")
                db.session.query(Video).filter_by(video_id=ev.video_id).update({ "available": False})
        db.session.commit()

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
def sync_metadata():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        videos = VideoInfo.query.filter(VideoInfo.info==None).all()
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
                        logger.warn(f"[{v.video.path}] - There may be a corrupt file in your video directory. Or, you may be recording to the video directory and haven't finished yet.")
                        logger.warn(f"For more info and to find the offending file, run this command in your container: \"stat {vpath}\"")
                        logger.warn("I'll try to process this file again in 60 seconds...")
                        time.sleep(60)
                
                corruptVideoWarning = "There may be a corrupt video in your video Directory. See your logs for more info!"
                if corruptVideoWarning in current_app.config['WARNINGS']:
                    position = current_app.config['WARNINGS'].index(corruptVideoWarning)
                    current_app.config['WARNINGS'].pop(position)

                vcodec = [i for i in info if i['codec_type'] == 'video'][0]
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
                logger.warn(f"Missing or invalid symlink at {vpath} to video {v.video_id} (original location: {v.video.path})")

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
                logger.warn(f"Missing or invalid symlink at {vpath} to video {v.video_id} (original location: {v.video.path})")
        

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
                logger.warn(f"Skipping creation of poster for video {vi.video_id} because the video at {str(video_path)} does not exist or is not accessible")
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
@click.pass_context
def bulk_import(ctx):
    with create_app().app_context():
        paths = current_app.config['PATHS']
        if util.lock_exists(paths["data"]):
            logger.info(f"A scan process is currently active... Aborting. (Remove {paths['data']/'fireshare.lock'} to continue anyway)")
            return
        util.create_lock(paths["data"])
        
        timing = {}
        s = time.time()
        ctx.invoke(scan_videos)
        timing['scan_videos'] = time.time() - s
        s = time.time()
        ctx.invoke(sync_metadata)
        timing['sync_metadata'] = time.time() - s
        s = time.time()
        ctx.invoke(create_posters)
        timing['create_posters'] = time.time() - s

        logger.info(f"Finished bulk import. Timing info: {json.dumps(timing)}")

        util.remove_lock(paths["data"])

if __name__=="__main__":
    cli()
