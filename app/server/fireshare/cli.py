#!/usr/bin/env python3
import os
import json
import click
from flask import current_app
from fireshare import create_app, db, util, logger
from fireshare.models import User, Video, VideoInfo
from werkzeug.security import generate_password_hash
from pathlib import Path
from sqlalchemy import func
import subprocess as sp

@click.group()
def cli():
    pass

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

        if not video_links.is_dir():
            video_links.mkdir()

        logger.info(f"Scanning {str(raw_videos)} for videos")
        video_files = [f for f in raw_videos.glob('**/*') if f.is_file() and f.suffix.lower() in ['.mp4', '.mov', '.mkv']]
        # Get all videos in one query rather than querying multiple on every loop.
        # This speeds up the scan process significantly
        video_rows = Video.query.all()
        
        new_videos = []
        for vf in video_files:
            path = str(vf.relative_to(raw_videos))
            video_id = util.video_id(vf)
            existing = next((vr for vr in video_rows if vr.video_id == video_id), None)
            if existing:
                logger.info(f"Skipping Video {video_id} at {str(path)} because it already exists at {existing.path}")
                if not existing.available:
                    logger.info(f"Setting Video {video_id} as available")
                    db.session.query(Video).filter_by(video_id=existing.video_id).update({ "available": True})
            else:
                v = Video(video_id=video_id, extension=vf.suffix, path=path, available=True)
                logger.info(f"Adding Video {video_id} at {str(path)}")
                new_videos.append(v)
        
        if new_videos:
            db.session.add_all(new_videos)
        else:
            logger.info(f"No new videos found")
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
            info = VideoInfo(video_id=nv.video_id, title=Path(nv.path).stem)
            db.session.add(info)
        db.session.commit()
        # Check that the files still exist
        existing_videos = Video.query.filter_by(available=True).all()
        for ev in existing_videos:
            file_path = Path((paths["video"] / ev.path).absolute())
            logger.info(f"Verifying video at {ev.video_id} is available")
            if not file_path.exists():
                logger.info(f"Video at {ev.video_id} was not found")
                db.session.query(Video).filter_by(video_id=ev.video_id).update({ "available": False})
        db.session.commit()

@cli.command()
def sync_metadata():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        videos = VideoInfo.query.filter(VideoInfo.info==None).all()
        if not videos:
            logger.info('Video metadata up to date')
        for v in videos:
            vpath = paths["processed"] / "video_links" / str(v.video_id + v.video.extension)
            if Path(vpath).is_file():
                info = util.get_media_info(vpath)
                vcodec = [i for i in info if i['codec_type'] == 'video'][0]
                if 'duration' in vcodec:
                    duration = float(vcodec['duration'])
                elif 'tags' in vcodec:
                    duration = util.dur_string_to_seconds(vcodec['tags']['DURATION'])
                width, height = int(vcodec['width']), int(vcodec['height'])
                logger.info(f'Scanned {v.video_id} duration={duration}s, resolution={width}x{height}: {v.video.path}')
                v.info = json.dumps(info)
                v.duration = duration
                v.width = width
                v.height = height
                db.session.add(v)
                db.session.commit()
            else:
                logger.info(f"Path to video {v.video_id} is not at symlink {vpath} (original location: {v.video.path})")

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
                    logger.info(f"Skipping {v.video_id} because {str(out_mp4_fn)} already exists")

            else:
                logger.info(f"Path to video {v.video_id} is not at symlink {vpath} (original location: {v.video.path})")
        

@cli.command()
@click.option("--regenerate", "-r", help="Overwrite existing posters", is_flag=True)
@click.option("--skip", "-s", help="Amount to skip into the video before extracting a poster image, as a %, e.g. 0.05 for 5%", type=float, default=0)
def create_posters(regenerate, skip):
    with create_app().app_context():
        processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
        vinfos = VideoInfo.query.all()
        for vi in vinfos:
            derived_path = Path(processed_root, "derived", vi.video_id)
            video_path = Path(processed_root, "video_links", vi.video_id + vi.video.extension)
            if not video_path.exists():
                logger.info(f"Skipping creation of poster for video {vi.video_id} because the video at {str(video_path)} does not exist or is not accessible")
                continue
            poster_path = Path(derived_path, "poster.jpg")
            should_create_poster = (not poster_path.exists() or regenerate)
            if should_create_poster:
                if not derived_path.exists():
                    derived_path.mkdir(parents=True)
                poster_time = int(vi.duration * skip)
                util.create_poster(video_path, derived_path / "poster.jpg", poster_time)
            else:
                logger.info(f"Skipping creation of poster for video {vi.video_id} because it exists at {str(poster_path)}")

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
            return logger.info("A scan process is currently active... Aborting.")
        util.create_lock(paths["data"])
        
        click.echo("Scanning for videos...")
        ctx.invoke(scan_videos)
        click.echo("Syncing metadata...")
        ctx.invoke(sync_metadata)
        click.echo("Creating posters...")
        ctx.invoke(create_posters)

        util.remove_lock(paths["data"])

if __name__=="__main__":
    cli()
