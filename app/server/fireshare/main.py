import os
from flask import Blueprint, render_template, current_app, redirect
from flask_login import current_user
from flask_cors import CORS

templates_path = os.environ.get('TEMPLATE_PATH') or 'templates'

main = Blueprint('main', __name__, template_folder=templates_path)

CORS(main, supports_credentials=True)


@main.route('/', defaults={'path': ''})
@main.route('/#/<path:path>')
def index(path):
    return render_template('index.html')
