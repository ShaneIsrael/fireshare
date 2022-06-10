import os, re
import random
from os import path
from subprocess import Popen
from flask import Blueprint, render_template, request, Response, jsonify, current_app, send_file, redirect
from flask_login import logout_user, current_user, login_required
from flask_cors import CORS
import logging
from . import db
from pathlib import Path
from .models import Video, VideoInfo

templates_path = os.environ.get('TEMPLATE_PATH') or 'templates'

api = Blueprint('api', __name__, template_folder=templates_path)

CORS(api, supports_credentials=True)


logger = logging.getLogger('fireshare')
logger.setLevel(logging.DEBUG)

def get_video_path(id, subid=None):
    video = Video.query.filter_by(video_id=id).first()
    if not video:
        raise Exception(f"No video found for {id}")
    paths = current_app.config['PATHS']
    subid_suffix = f"-{subid}" if subid else ""
    ext = ".mp4" if subid else video.extension
    video_path = paths["processed"] / "video_links" / f"{id}{subid_suffix}{ext}"
    return str(video_path)

@api.route('/w/<video_id>')
def video_metadata(video_id):
    video = Video.query.filter_by(video_id=video_id).first()
    if video:
        return render_template('metadata.html', video=video.json())
    else:
        return redirect('/#/w/{}'.format(video_id), code=302)

@api.route('/api/manual/scan')
@login_required
def manual_scan():
    if not current_app.config["ENVIRONMENT"] == 'production':
        return Response(response='You must be running in production for this task to work.', status=400)
    else:
        current_app.logger.info(f"Executed manual scan")
        Popen("fireshare bulk-import", shell=True)
    return Response(status=200)

@api.route('/api/videos')
@login_required
def get_videos():
    return jsonify({"videos": [v.json() for v in Video.query.all()]})

@api.route('/api/video/random')
@login_required
def get_random_video():
    row_count = Video.query.count()
    random_video = Video.query.offset(int(row_count * random.random())).first()
    current_app.logger.info(f"Fetched random video {random_video.video_id}: {random_video.info.title}")
    return jsonify(random_video.json())

@api.route('/api/video/delete/<id>', methods=["DELETE"])
@login_required
def delete_video(id):
    video = Video.query.filter_by(video_id=id).first()
    if video:
        logging.info(f"Deleting video: {video.video_id}")
        VideoInfo.query.filter_by(video_id=id).delete()
        Video.query.filter_by(video_id=id).delete()
        db.session.commit()
        file_path = f"{current_app.config['VIDEO_DIRECTORY']}/{video.path}"
        link_path = f"{current_app.config['PROCESSED_DIRECTORY']}/video_links/{id}.{video.extension}"
        derived_path = f"{current_app.config['PROCESSED_DIRECTORY']}/derived/{id}"
        try:
            if path.exists(file_path):
                os.remove(file_path)
            if path.exists(link_path):
                os.remove(link_path)
            if path.exists(derived_path):
                os.rmdir(derived_path)
        except OSError as e:
            logging.error(f"Error deleting: {e.strerror}")
        return Response(status=200)
        
    else:
        return Response(status=404, response=f"A video with id: {id}, does not exist.")


@api.route('/api/video/public/random')
def get_random_public_video():
    row_count =  Video.query.filter(Video.info.has(private=False)).filter_by(available=True).count()
    random_video = Video.query.filter(Video.info.has(private=False)).filter_by(available=True).offset(int(row_count * random.random())).first()
    current_app.logger.info(f"Fetched public random video {random_video.video_id}: {random_video.info.title}")
    return jsonify(random_video.json())

@api.route('/api/videos/public')
def get_public_videos():
    return jsonify({"videos": [v.json() for v in Video.query.filter(Video.info.has(private=False)).filter_by(available=True)]})

@api.route('/api/video/details/<id>', methods=["GET", "PUT"])
def handle_video_details(id):
    if request.method == 'GET':
        # db lookup and get the details title/views/etc
        # video_id = request.args['id']
        video = Video.query.filter_by(video_id=id).first()
        if video:
            return jsonify(video.json())
        else:
            return jsonify({
                'message': 'Video not found'
            }), 404
    if request.method == 'PUT':
        if not current_user.is_authenticated:
            return Response(response='You do not have access to this resource.', status=401)
        video_info = VideoInfo.query.filter_by(video_id=id).first()
        if video_info:
            db.session.query(VideoInfo).filter_by(video_id=id).update(request.json)
            db.session.commit()
            return Response(status=201)
        else:
            return jsonify({
                'message': 'Video details not found'
            }), 404

@api.route('/api/video/poster', methods=['GET'])
def get_video_poster():
    video_id = request.args['id']
    webm_poster_path = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id, "boomerang-preview.webm")
    jpg_poster_path = Path(current_app.config["PROCESSED_DIRECTORY"], "derived", video_id, "poster.jpg")
    if request.args.get('animated'):
        return send_file(webm_poster_path, mimetype='video/webm')
    else:
        return send_file(jpg_poster_path, mimetype='image/jpg')

@api.route('/api/video')
def get_video():
    # for testing ids are just the name of the sample video until
    # we have the videos added to a db table
    video_id = request.args.get('id')
    subid = request.args.get('subid')
    video_path = get_video_path(video_id, subid)
    file_size = os.stat(video_path).st_size
    start = 0
    length = 10240

    range_header = request.headers.get('Range', None)
    if range_header:
        m = re.search('([0-9]+)-([0-9]*)', range_header)
        g = m.groups()
        byte1, byte2 = 0, None
        if g[0]:
            byte1 = int(g[0])
        if g[1]:
            byte2 = int(g[1])
        if byte1 < file_size:
            start = byte1
        if byte2:
            length = byte2 + 1 - byte1
        else:
            length = file_size - start

    with open(video_path, 'rb') as f:
        f.seek(start)
        chunk = f.read(length)

    rv = Response(chunk, 206, mimetype='video/mp4', content_type='video/mp4', direct_passthrough=True)
    rv.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, file_size))
    return rv

@api.after_request
def after_request(response):
    response.headers.add('Accept-Ranges', 'bytes')
    return response