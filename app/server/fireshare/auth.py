from flask import Blueprint, redirect, request, Response, jsonify, current_app
from flask_login import login_user, logout_user, current_user, login_required
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User
from . import db
import ldap
import logging

def auth_user_ldap(username, password):
    formatted = current_app.config["LDAP_USER_FILTER"].format(
        input=username,
        basedn=current_app.config["LDAP_BASEDN"]
    )
    current_app.logger.debug("authenticating %s", username)
    current_app.logger.debug("formatted LDAP query: %s", formatted)
    
    try:
        out = current_app.ldap_conn.search_ext_s(
            current_app.config["LDAP_BASEDN"],
            ldap.SCOPE_SUBTREE,
            filterstr=formatted,
            attrlist=['memberOf']
        )
        current_app.logger.debug("LDAP search result: %s", out)

        if out:
            dn = out[0][0]
            attrs = out[0][1]
            admin = True

            if attrs and 'memberOf' in attrs and current_app.config["LDAP_ADMIN_GROUP"]:
                admin_str = '{},{}'.format(
                    current_app.config["LDAP_ADMIN_GROUP"],
                    current_app.config["LDAP_BASEDN"]
                ).encode()
                current_app.logger.debug("matching against admin group: %s", admin_str)
                if admin_str in attrs['memberOf']:
                    current_app.logger.debug("matched admin")
                    admin = True
                else:
                    current_app.logger.debug("matched not admin")
                    admin = False

            current_app.logger.debug("user search yielded result")

            conn2 = ldap.initialize(current_app.config["LDAP_URL"])
            current_app.logger.debug("checking credentials")
            try:
                conn2.bind_s(dn, password)
                current_app.logger.debug("authorized user")
                conn2.unbind_s()
                return True, admin
            except ldap.INVALID_CREDENTIALS:
                current_app.logger.debug("not authorized user")
                return False, False
        else:
            current_app.logger.debug("user search yielded no results")
            return False, False

    except:
        logging.exception('')
        current_app.logger.debug("failure at block1")
        return False, False

    return False, False


auth = Blueprint('auth', __name__)
CORS(auth, supports_credentials=True)

@auth.route('/api/login', methods=['POST'])
def login():
    authenticated = False
    username = request.json['username']
    password = request.json['password']
    user = User.query.filter_by(username=username, ldap=False).first()

    if user and check_password_hash(user.password, password):
        login_user(user, remember=True)
        return Response(status=200)

    if current_app.config["LDAP_ENABLE"]:
        authorised, admin = auth_user_ldap(username, password)
        if authorised:
            userobj = User.query.filter_by(username=username, ldap=True).first()
            if not userobj:
                userobj = User(username=username, ldap=True, admin=admin)
                db.session.add(userobj)
                db.session.commit()
            if userobj.admin != admin:
                row = db.session.query(User).filter_by(id=userobj.id).first()
                row.admin = admin
                db.session.commit()
            login_user(userobj, remember=True)
            return Response(status=200)

    return Response(response="Invalid username or password", status=401)

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
