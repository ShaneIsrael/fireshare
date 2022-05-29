from flask import Blueprint, redirect, request, Response, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User
from . import db

auth = Blueprint('auth', __name__)

CORS(auth, supports_credentials=True)

@auth.route('/api/login', methods=['POST'])
def login():
    username = request.json['username']
    password = request.json['password']
    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password, password):
        return Response(response="Invalid username or password", status=401)

    login_user(user, remember=True)
    return Response(status=200)

@auth.route('/api/signup', methods=['POST'])
@login_required
def signup():
    username = request.json['username']
    password = request.json['password']

    user = User.query.filter_by(username=username).first()
    
    if user:
        return Response(response="User already exists.", status=400)
    
    new_user = User(username=username, password=generate_password_hash(password, method='sha256'))

    db.session.add(new_user)
    db.session.commit()

    return Response(status=200)

@auth.route('/api/loggedin', methods=['GET'])
def loggedin():
    if not current_user.is_authenticated:
        return Response(response='false', status=200)
    return Response(response='true', status=200)

@auth.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return Response(status=200)