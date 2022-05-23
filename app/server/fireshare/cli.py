#!/usr/bin/env python3
import os
import json
import click
from flask import current_app
from fireshare import create_app, db, util
from fireshare.models import User, Video, VideoInfo
from werkzeug.security import generate_password_hash
from pathlib import Path

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
        data_root = Path(current_app.config["DATA_DIRECTORY"])
        raw_videos = data_root / "raw_videos"
        video_links = data_root / "video_links"
        if not video_links.is_dir():
            video_links.mkdir()

        print(f"Scanning {str(raw_videos)} for videos")
        video_files = [f for f in raw_videos.glob('**/*') if f.is_file() and f.suffix in ['.mp4']]

        new_videos = []
        for vf in video_files:
            path = str(vf.relative_to(raw_videos))
            video_id = util.video_id(vf)

            existing = Video.query.filter_by(video_id=video_id).first()
            if existing:
                click.echo(f"Skipping Video {video_id} at {str(path)} because it already exists at {existing.path}")
            else:
                v = Video(video_id=video_id, extension=vf.suffix, path=path)
                click.echo(f"Adding Video {video_id} at {str(path)}")
                new_videos.append(v)
        
        if new_videos:
            db.session.add_all(new_videos)
            db.session.commit()
        else:
            click.echo(f"No new videos found")

        fd = os.open(str(video_links.absolute()), os.O_DIRECTORY)
        for nv in new_videos:
            src = "../" + str((raw_videos / nv.path).relative_to(data_root))
            dst = Path(nv.video_id + str(Path(nv.path).suffix))
            if not dst.exists():
                print(f"Linking {str(src)} --> {str(dst)}")
                try:
                    os.symlink(src, dst, dir_fd=fd)
                except FileExistsError:
                    print(f"{dst} exists already")
        
            info = VideoInfo(video_id=nv.video_id, title=Path(nv.path).stem)
            db.session.add(info)
        db.session.commit()

@cli.command()
def sync_metadata():
    with create_app().app_context():
        root = Path(current_app.config['DATA_DIRECTORY'])
        videos = VideoInfo.query.filter(VideoInfo.info==None).all()
        if not videos:
            print('Video metadata up to date')
        for v in videos:
            vpath = root / "video_links" / str(v.video_id + v.video.extension)
            info = util.get_media_info(vpath)
            print(v.video_id, vpath)
            vcodec = [i for i in info if i['codec_type'] == 'video'][0]
            if 'duration' in vcodec:
                duration = float(vcodec['duration'])
            elif 'tags' in vcodec:
                duration = util.dur_string_to_seconds(vcodec['tags']['DURATION'])
            width, height = int(vcodec['width']), int(vcodec['height'])
            print('Scanned {} duration={}s, resolution={}x{}'.format(v.video_id, duration, width, height))
            v.info = json.dumps(info)
            v.duration = duration
            v.width = width
            v.height = height
            db.session.add(v)
            db.session.commit()

if __name__=="__main__":
    cli()
