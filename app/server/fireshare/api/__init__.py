import os
from flask import Blueprint
from flask_cors import CORS

templates_path = os.environ.get('TEMPLATE_PATH') or 'templates'
api = Blueprint('api', __name__, template_folder=templates_path)
CORS(api, supports_credentials=True)

from . import transcoding, scan, misc, admin, video, upload, game, tag  # noqa: E402,F401
