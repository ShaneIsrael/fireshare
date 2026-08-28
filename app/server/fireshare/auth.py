import base64
import io
import time

import pyotp
import qrcode
from flask import Blueprint, redirect, request, Response, jsonify, current_app, session
from flask_login import login_user, logout_user, current_user, login_required
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User
from . import db
from .api.misc import _get_local_version, _fetch_release_notes
from .api.decorators import demo_restrict
from .ip_whitelist import login_ip_required, get_client_ip, is_ip_permitted
from datetime import datetime, timezone
try:
    import ldap, ldap.filter
except ImportError:
    ldap = None
from . import ldap_util

def _ldap_search(app, formatted):
    """Search for the user, reopening the connection once if the cached one went stale.

    The service bind is made at startup and reused, so an LDAP server restart or an idle
    timeout would otherwise break every login until Fireshare itself was restarted.
    """
    for attempt in (1, 2):
        try:
            conn = ldap_util.get_connection(app)
            return conn.search_ext_s(
                app.config["LDAP_BASEDN"],
                ldap.SCOPE_SUBTREE,
                filterstr=formatted,
                attrlist=['memberOf']
            )
        except ldap.SERVER_DOWN:
            ldap_util.reset_connection(app)
            if attempt == 2:
                raise


def auth_user_ldap(username, password):
    app = current_app._get_current_object()
    formatted = app.config["LDAP_USER_FILTER"].format(
        input=ldap.filter.escape_filter_chars(username),
        basedn=app.config["LDAP_BASEDN"]
    )
    current_app.logger.debug("authenticating %s", username)
    current_app.logger.debug("formatted LDAP query: %s", formatted)
    
    try:
        out = _ldap_search(app, formatted)
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

            # Same TLS setup as the service connection, otherwise the user bind would
            # be the one connection with no CA configured.
            conn2, _ = ldap_util.connect(app.config)
            current_app.logger.debug("checking credentials")
            try:
                conn2.bind_s(dn, password)
                current_app.logger.debug("authorized user")
                return True, admin
            except ldap.INVALID_CREDENTIALS:
                current_app.logger.debug("not authorized user")
                return False, False
            finally:
                # Including the wrong-password path, which used to leak the connection.
                try:
                    conn2.unbind_s()
                except Exception:
                    pass
        else:
            current_app.logger.debug("user search yielded no results")
            return False, False

    except ldap.LDAPError as e:
        current_app.logger.error('LDAP authentication error: %s', ldap_util.describe_error(e, app.config))
        current_app.logger.debug("failure at block1", exc_info=True)
        return False, False
    except Exception:
        current_app.logger.exception('LDAP authentication error')
        current_app.logger.debug("failure at block1")
        return False, False


auth = Blueprint('auth', __name__)
CORS(auth, supports_credentials=True)

MFA_PENDING_MAX_AGE = 300
MFA_MAX_ATTEMPTS = 5

def _clear_mfa_pending():
    session.pop('mfa_pending_user_id', None)
    session.pop('mfa_pending_at', None)
    session.pop('mfa_attempts', None)

def _verify_totp(user, code):
    """
    Return the 30s timestep the code matches (with one step of clock drift
    tolerance either way), or None. Each code is only accepted once (RFC 6238):
    a code at or before the last accepted timestep is rejected as a replay.
    """
    code = str(code or '').strip()
    if not code:
        return None
    totp = pyotp.TOTP(user.totp_secret)
    now_step = int(time.time() // 30)
    for offset in (0, -1, 1):
        step = now_step + offset
        if pyotp.utils.strings_equal(totp.at(step * 30), code):
            if user.totp_last_used is not None and step <= user.totp_last_used:
                return None
            return step
    return None

@auth.route('/api/login', methods=['POST'])
@login_ip_required
def login():
    username = request.json['username']
    password = request.json['password']
    user = User.query.filter_by(username=username, ldap=False).first()

    if user and check_password_hash(user.password, password):
        if user.mfa_enabled and user.totp_secret:
            session['mfa_pending_user_id'] = user.id
            session['mfa_pending_at'] = time.time()
            session['mfa_attempts'] = 0
            return jsonify({'mfa_required': True})
        _clear_mfa_pending()
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
            _clear_mfa_pending()
            login_user(userobj, remember=True)
            return Response(status=200)

    return Response(response="Invalid username or password", status=401)

@auth.route('/api/login/mfa', methods=['POST'])
@login_ip_required
def login_mfa():
    pending_user_id = session.get('mfa_pending_user_id')
    pending_at = session.get('mfa_pending_at', 0)
    attempts = session.get('mfa_attempts', 0)

    expired = time.time() - pending_at > MFA_PENDING_MAX_AGE
    if not pending_user_id or expired or attempts >= MFA_MAX_ATTEMPTS:
        _clear_mfa_pending()
        return jsonify({'error': 'Login session expired. Please sign in again.', 'restart': True}), 401

    user = db.session.get(User, pending_user_id)
    if not user or not user.mfa_enabled or not user.totp_secret:
        _clear_mfa_pending()
        return jsonify({'error': 'Login session expired. Please sign in again.', 'restart': True}), 401

    session['mfa_attempts'] = attempts + 1

    matched_step = _verify_totp(user, (request.json or {}).get('code'))
    if matched_step is None:
        return jsonify({'error': 'Invalid authentication code.'}), 401

    user.totp_last_used = matched_step
    db.session.commit()
    _clear_mfa_pending()
    login_user(user, remember=True)
    return jsonify({'authenticated': True})

@auth.route('/api/mfa/status', methods=['GET'])
@login_required
def mfa_status():
    is_demo = current_app.config.get('DEMO_MODE') and current_user.username == 'demo'
    return jsonify({
        'enabled': bool(current_user.mfa_enabled),
        'supported': not current_user.ldap and not is_demo,
    })

@auth.route('/api/mfa/setup', methods=['POST'])
@login_required
@demo_restrict
def mfa_setup():
    if current_user.ldap:
        return jsonify({'error': 'Two-factor authentication is not available for LDAP accounts.'}), 400
    if current_user.mfa_enabled:
        return jsonify({'error': 'Two-factor authentication is already enabled.'}), 400

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.session.commit()

    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(name=current_user.username, issuer_name='Fireshare')
    png = io.BytesIO()
    qrcode.make(otpauth_url).save(png, format='PNG')
    qr_data_uri = 'data:image/png;base64,' + base64.b64encode(png.getvalue()).decode('ascii')

    return jsonify({'secret': secret, 'otpauth_url': otpauth_url, 'qr': qr_data_uri})

@auth.route('/api/mfa/confirm', methods=['POST'])
@login_required
@demo_restrict
def mfa_confirm():
    if current_user.mfa_enabled:
        return jsonify({'error': 'Two-factor authentication is already enabled.'}), 400
    if not current_user.totp_secret:
        return jsonify({'error': 'Two-factor authentication setup has not been started.'}), 400

    matched_step = _verify_totp(current_user, (request.json or {}).get('code'))
    if matched_step is None:
        return jsonify({'error': 'Invalid authentication code.'}), 400

    current_user.mfa_enabled = True
    current_user.totp_last_used = matched_step
    db.session.commit()
    return jsonify({'enabled': True})

@auth.route('/api/mfa/disable', methods=['POST'])
@login_required
@demo_restrict
def mfa_disable():
    if not current_user.mfa_enabled or not current_user.totp_secret:
        return jsonify({'error': 'Two-factor authentication is not enabled.'}), 400

    # A valid, unused current code is required so a hijacked session (or a
    # just-observed code) alone cannot strip MFA.
    if _verify_totp(current_user, (request.json or {}).get('code')) is None:
        return jsonify({'error': 'Invalid authentication code.'}), 400

    current_user.totp_secret = None
    current_user.mfa_enabled = False
    current_user.totp_last_used = None
    db.session.commit()
    return jsonify({'enabled': False})

@auth.route('/api/signup', methods=['POST'])
@login_required
@demo_restrict
def signup():
    username = request.json['username']
    password = request.json['password']

    user = User.query.filter_by(username=username).first()
    
    if user:
        return Response(response="User already exists.", status=400)

    new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
    db.session.add(new_user)
    db.session.commit()

    return Response(status=200)

@auth.route('/api/loggedin', methods=['GET'])
def loggedin():
    login_allowed = is_ip_permitted(get_client_ip())
    if not current_user.is_authenticated:
        return jsonify({'authenticated': False, 'login_allowed': login_allowed})

    release_data = _fetch_release_notes()
    local_version = _get_local_version()

    latest_release = None
    if release_data and local_version:
        latest_version = release_data['version']
        update_available = tuple(int(x) for x in latest_version.split('.')) > tuple(int(x) for x in local_version.split('.'))
        if update_available:
            current_app.logger.info(f"A new version of Fireshare is available! You have v{local_version}, latest is v{latest_version}.")
            is_dev = current_app.config.get('ENVIRONMENT') == 'dev'
            release_is_old_enough = is_dev
            if not is_dev:
                try:
                    published_dt = datetime.fromisoformat(release_data.get('published_at', '').replace('Z', '+00:00'))
                    release_is_old_enough = (datetime.now(timezone.utc) - published_dt).total_seconds() >= 86400
                except (ValueError, TypeError):
                    pass
            if release_is_old_enough:
                latest_release = release_data
        else:
            pass

    return jsonify({
        'authenticated': True,
        'admin': current_user.admin,
        'latest_release': latest_release,
        'login_allowed': login_allowed,
    })

@auth.route('/api/logout', methods=['POST'])
def logout():
    _clear_mfa_pending()
    logout_user()
    return Response(status=200)
