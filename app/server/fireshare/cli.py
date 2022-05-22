#!/usr/bin/env python3
import click
from flask import current_app
from fireshare import create_app, db
from fireshare.models import User, Video, VideoInfo
from werkzeug.security import generate_password_hash
from pathlib import Path
from . import util

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
        root = Path(current_app.config["VIDEO_DIRECTORY"])
        video_files = [f for f in root.glob('**/*') if f.is_file() and f.suffix in ['.mp4']]
        for vf in video_files:
            path = str(vf.relative_to(root))
            video_id = util.video_id(vf)
            v = Video(video_id=video_id, extension=vf.suffix, path=path)
            db.session.add(v)
            db.session.commit()
            click.echo(f"Created video {video_id}: {str(path)}")

if __name__=="__main__":
    cli()
