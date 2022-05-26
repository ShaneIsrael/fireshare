import os
from flask import Blueprint, render_template, current_app, redirect
from flask_login import current_user
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User
from . import db

templates_path = os.environ.get('TEMPLATE_PATH') or 'templates'

main = Blueprint('main', __name__, template_folder=templates_path)

CORS(main, supports_credentials=True)

@main.before_app_first_request
def before_first_request():
    # Create the admin user if it doesn't already exist
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin_user = User(username='admin', password=generate_password_hash(current_app.config['ADMIN_PASSWORD'], method='sha256'))
        db.session.add(admin_user)
        db.session.commit()
    if not check_password_hash(admin.password, current_app.config['ADMIN_PASSWORD']):
        db.session.query(User).filter_by(username='admin').update({'password': generate_password_hash(current_app.config['ADMIN_PASSWORD'], method='sha256')})
        db.session.commit()

@main.route('/', defaults={'path': ''})
@main.route('/#/<path:path>')
def index(path):
    return render_template('index.html')

