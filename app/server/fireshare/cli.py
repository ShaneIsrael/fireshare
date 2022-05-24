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
        paths = current_app.config['PATHS']
        raw_videos = paths["video"]
        video_links = paths["processed"] / "video_links"
        if not video_links.is_dir():
            video_links.mkdir()

        click.echo(f"Scanning {str(raw_videos)} for videos")
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
            src = Path((paths["video"] / nv.path).absolute())
            dst = Path(paths["processed"] / "video_links" / (nv.video_id + nv.extension))
            common_root = Path(*os.path.commonprefix([src.parts, dst.parts]))
            num_up = len(dst.parts)-1 - len(common_root.parts)
            prefix = "../" * num_up
            rel_src = Path(prefix + str(src).replace(str(common_root), ''))
            if not dst.exists():
                click.echo(f"Linking {str(rel_src)} --> {str(dst)}")
                try:
                    os.symlink(src, dst, dir_fd=fd)
                except FileExistsError:
                    click.echo(f"{dst} exists already")
            info = VideoInfo(video_id=nv.video_id, title=Path(nv.path).stem)
            db.session.add(info)
        db.session.commit()

@cli.command()
def sync_metadata():
    with create_app().app_context():
        paths = current_app.config['PATHS']
        videos = VideoInfo.query.filter(VideoInfo.info==None).all()
        if not videos:
            click.echo('Video metadata up to date')
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
                click.echo(f'Scanned {v.video_id} duration={duration}s, resolution={width}x{height}: {v.video.path}')
                v.info = json.dumps(info)
                v.duration = duration
                v.width = width
                v.height = height
                db.session.add(v)
                db.session.commit()
            else:
                click.echo(f"Path to video {v.video_id} is not at symlink {vpath} (original location: {v.video.path})")

@cli.command()
def create_posters():
    with create_app().app_context():
        processed_root = Path(current_app.config['PROCESSED_DIRECTORY'])
        vinfos = VideoInfo.query.all()
        for v in vinfos:
            derived_path = Path(processed_root, "derived", v.video_id)
            video_path = Path(processed_root, "video_links", v.video_id + ".mp4")
            if not Path(derived_path, "poster.jpg").exists():
                print('Creating poster for {}'.format(v.video_id))
                if not derived_path.exists():
                    derived_path.mkdir(parents=True)
                util.create_poster(video_path, derived_path / "poster.jpg")

if __name__=="__main__":
    cli()
