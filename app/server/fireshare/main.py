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
    admin = User.query.filter_by(admin=True, ldap=False).first()
    
    if not admin and not current_app.config['DISABLE_ADMINCREATE']:
        username = current_app.config['ADMIN_USERNAME'] or 'admin'
        admin_user = User(username=username, password=generate_password_hash(current_app.config['ADMIN_PASSWORD'] or 'admin', method='sha256'), admin=True)
        db.session.add(admin_user)
        db.session.commit()
    if admin and not check_password_hash(admin.password, current_app.config['ADMIN_PASSWORD']):
        row = db.session.query(User).filter_by(admin=True, ldap=False).first()
        row.password = generate_password_hash(current_app.config['ADMIN_PASSWORD'], method='sha256')
        db.session.commit()
    if admin and current_app.config['ADMIN_USERNAME'] and admin.username != current_app.config['ADMIN_USERNAME']:
        row = db.session.query(User).filter_by(admin=True, ldap=False).first()
        row.username = current_app.config['ADMIN_USERNAME'] or admin.username
        db.session.commit()


@main.route('/', defaults={'path': ''})
@main.route('/#/<path:path>')
def index(path):
    return render_template('index.html')

