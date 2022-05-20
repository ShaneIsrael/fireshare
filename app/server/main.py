from flask import Blueprint, render_template, current_app, redirect
from flask_login import current_user
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User
from . import db

main = Blueprint('main', __name__)

CORS(main, supports_credentials=True)

@main.before_app_first_request
def before_first_request():
    # Create the admin user if it doesn't already exist
    admin = User.query.filter_by(username='admin').first()
    print(current_app.config['ADMIN_PASSWORD'])
    if not admin:
        admin_user = User(username='admin', password=generate_password_hash(current_app.config['ADMIN_PASSWORD'], method='sha256'))
        db.session.add(admin_user)
        db.session.commit()

@main.route('/', defaults={'path': ''})
@main.route('/#/<path:path>')
def index(path):
    return render_template('index.html')

