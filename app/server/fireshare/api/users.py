"""Administrator user management, plus the account self-service endpoints.

Guardrails enforced here, all server-side:

* The last enabled administrator cannot be demoted, disabled, or deleted, so an
  instance can never be locked out of its own settings.
* Nobody can delete, disable, or demote their own account.
* The env-managed account (the one ADMIN_USERNAME / ADMIN_PASSWORD are re-applied
  to on every boot) cannot be demoted or deleted, because startup would simply
  reinstate it and the UI would appear to lie.
* Deleting a user never deletes their media. uploaded_by is cleared instead, so
  the content survives as unattributed.
* Invite tokens are stored as a sha256 hash. The raw token exists only in the
  response that creates it.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app, jsonify, request, Response
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from .. import db, logger
from .. import permissions as perms
from ..models import User, Video, Image
from . import api
from .decorators import demo_restrict, strict_admin_required, json_body
from .profile import _avatar_path, _banner_path

INVITE_TTL = timedelta(days=7)


def _now():
    """Naive UTC, matching the DateTime columns elsewhere in the schema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_invite_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _enabled_admin_count(exclude_id=None):
    query = User.query.filter(User.admin == True, User.disabled == False)
    if exclude_id is not None:
        query = query.filter(User.id != exclude_id)
    return query.count()


def _would_orphan_instance(user, *, becoming_admin=None, becoming_disabled=None, deleting=False):
    """Return an error message if the change would remove the last administrator."""
    if not user.admin:
        return None
    losing_admin = deleting or becoming_admin is False or becoming_disabled is True
    if not losing_admin:
        return None
    if _enabled_admin_count(exclude_id=user.id) == 0:
        return 'This is the only administrator account. Promote another user first.'
    return None


def _clear_invite(user):
    user.invite_token_hash = None
    user.invite_expires_at = None


def _issue_invite(user):
    """Generate a fresh invite token, store its hash, and return the raw token."""
    token = secrets.token_urlsafe(32)
    user.invite_token_hash = _hash_invite_token(token)
    user.invite_expires_at = _now() + INVITE_TTL
    # An account waiting on an invite has no usable password.
    user.password = None
    user.must_change_password = False
    return token


def _invite_url(token):
    domain = f"https://{current_app.config['DOMAIN']}" if current_app.config.get('DOMAIN') else ''
    return f"{domain}/setup-password?token={token}"


# ---------------------------------------------------------------------------
# Admin: list / create / update / delete
# ---------------------------------------------------------------------------

@api.route('/api/admin/users', methods=['GET'])
@strict_admin_required
def list_users():
    users = User.query.order_by(User.id).all()
    # is_self is request-scoped, so it is added here rather than on the model —
    # the client uses it to grey out actions nobody may perform on themselves.
    return jsonify({
        'users': [u.admin_json() | {'is_self': u.id == current_user.id} for u in users],
        'permissions': [
            {'key': k, 'label': perms.PERMISSION_LABELS[k]} for k in perms.GRANTABLE_PERMISSIONS
        ],
        'presets': [
            {'key': k, 'label': perms.PRESET_LABELS[k], 'permissions': list(v)}
            for k, v in perms.PRESETS.items()
        ],
        'ldap_enabled': bool(current_app.config.get('LDAP_ENABLE')),
    })


@api.route('/api/admin/users', methods=['POST'])
@strict_admin_required
@demo_restrict
@json_body
def create_user():
    body = request.json_body

    username = body.get('username')
    error = perms.username_error(username)
    if error:
        return jsonify({'error': error}), 400
    username = perms.normalize_username(username)

    # Case-insensitive: two accounts differing only in case would be
    # indistinguishable in a URL and in the user list.
    existing = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if existing:
        return jsonify({'error': 'That username is already taken.'}), 409

    make_admin = bool(body.get('admin'))
    granted = [] if make_admin else perms.clean_permissions(body.get('permissions'))

    use_invite = bool(body.get('invite'))
    password = body.get('password')

    if not use_invite:
        error = perms.password_error(password)
        if error:
            return jsonify({'error': error}), 400

    user = User(
        username=username,
        admin=make_admin,
        ldap=False,
        permissions=perms.serialize_permissions(granted),
        display_name=perms.clean_display_name(body.get('display_name')),
        profile_public=bool(body.get('profile_public', True)),
        created_at=_now(),
        avatar_version=0,
        disabled=False,
    )

    token = None
    if use_invite:
        token = _issue_invite(user)
    else:
        user.password = generate_password_hash(password, method='pbkdf2:sha256')
        # Default on: an admin who types a password knows it, so the account
        # should not stay reachable with a credential someone else chose.
        user.must_change_password = bool(body.get('require_password_change', True))

    db.session.add(user)
    db.session.commit()

    logger.info(
        f"Admin '{current_user.username}' created user '{user.username}' "
        f"(admin={make_admin}, invite={use_invite})"
    )

    payload = {'user': user.admin_json()}
    if token:
        payload['invite_url'] = _invite_url(token)
    return jsonify(payload), 201


@api.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@strict_admin_required
@demo_restrict
@json_body
def update_user(user_id):
    body = request.json_body
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    is_self = user.id == current_user.id

    if 'admin' in body:
        make_admin = bool(body['admin'])
        if not make_admin:
            if is_self:
                return jsonify({'error': 'You cannot remove your own administrator access.'}), 400
            if user.env_managed:
                return jsonify({
                    'error': 'This account is managed by ADMIN_USERNAME / ADMIN_PASSWORD and '
                             'is reinstated as an administrator on every restart.'
                }), 400
            orphan = _would_orphan_instance(user, becoming_admin=False)
            if orphan:
                return jsonify({'error': orphan}), 400
        user.admin = make_admin

    if 'disabled' in body:
        disabled = bool(body['disabled'])
        if disabled:
            if is_self:
                return jsonify({'error': 'You cannot disable your own account.'}), 400
            orphan = _would_orphan_instance(user, becoming_disabled=True)
            if orphan:
                return jsonify({'error': orphan}), 400
        user.disabled = disabled

    if 'permissions' in body:
        # Admins bypass the permission set entirely; storing one would be
        # misleading, so it is cleared rather than kept in the background.
        user.permissions = perms.serialize_permissions(
            [] if user.admin else body.get('permissions')
        )

    if 'display_name' in body:
        user.display_name = perms.clean_display_name(body.get('display_name'))

    if 'profile_public' in body:
        user.profile_public = bool(body['profile_public'])

    db.session.commit()
    logger.info(f"Admin '{current_user.username}' updated user '{user.username}'")
    return jsonify({'user': user.admin_json()})


@api.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@strict_admin_required
@demo_restrict
def delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    if user.id == current_user.id:
        return jsonify({'error': 'You cannot delete your own account.'}), 400
    if user.env_managed:
        return jsonify({
            'error': 'This account is managed by ADMIN_USERNAME / ADMIN_PASSWORD and would be '
                     'recreated on the next restart. Remove those variables first.'
        }), 400
    orphan = _would_orphan_instance(user, deleting=True)
    if orphan:
        return jsonify({'error': orphan}), 400

    username = user.username

    # Media outlives its uploader. Clearing the link leaves the content in the
    # library as unattributed rather than deleting someone's whole upload history.
    reassigned = (Video.query.filter(Video.uploaded_by == user.id)
                  .update({'uploaded_by': None}, synchronize_session=False))
    reassigned += (Image.query.filter(Image.uploaded_by == user.id)
                   .update({'uploaded_by': None}, synchronize_session=False))

    for artefact in (_avatar_path(user.id), _banner_path(user.id)):
        if artefact.is_file():
            try:
                artefact.unlink()
            except OSError as ex:
                logger.warning(f'Could not remove {artefact}: {ex}')

    db.session.delete(user)
    db.session.commit()

    logger.info(
        f"Admin '{current_user.username}' deleted user '{username}'; "
        f"{reassigned} media item(s) are now unattributed"
    )
    return jsonify({'deleted': True, 'unattributed_media': reassigned})


# ---------------------------------------------------------------------------
# Admin: credentials and recovery
# ---------------------------------------------------------------------------

@api.route('/api/admin/users/<int:user_id>/password', methods=['POST'])
@strict_admin_required
@demo_restrict
@json_body
def set_user_password(user_id):
    body = request.json_body
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    if user.ldap:
        return jsonify({'error': 'LDAP account passwords are managed by the directory.'}), 400

    password = body.get('password')
    error = perms.password_error(password)
    if error:
        return jsonify({'error': error}), 400

    user.password = generate_password_hash(password, method='pbkdf2:sha256')
    user.must_change_password = bool(body.get('require_password_change', True))
    _clear_invite(user)
    db.session.commit()

    logger.info(f"Admin '{current_user.username}' reset the password for '{user.username}'")
    return jsonify({'user': user.admin_json()})


@api.route('/api/admin/users/<int:user_id>/invite', methods=['POST'])
@strict_admin_required
@demo_restrict
def create_user_invite(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    if user.ldap:
        return jsonify({'error': 'LDAP account passwords are managed by the directory.'}), 400
    if user.admin and user.id != current_user.id and user.env_managed:
        return jsonify({'error': 'This account is managed by environment variables.'}), 400

    token = _issue_invite(user)
    db.session.commit()

    logger.info(f"Admin '{current_user.username}' issued a password setup link for '{user.username}'")
    return jsonify({
        'invite_url': _invite_url(token),
        'expires_at': user.invite_expires_at.isoformat(),
        'user': user.admin_json(),
    })


@api.route('/api/admin/users/<int:user_id>/mfa/disable', methods=['POST'])
@strict_admin_required
@demo_restrict
def admin_disable_user_mfa(user_id):
    """Lockout recovery — mirrors the `fireshare disable-mfa` CLI command."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    user.totp_secret = None
    user.mfa_enabled = False
    user.totp_last_used = None
    db.session.commit()

    logger.info(f"Admin '{current_user.username}' disabled two-factor authentication for '{user.username}'")
    return jsonify({'user': user.admin_json()})


# ---------------------------------------------------------------------------
# Self-service
# ---------------------------------------------------------------------------

@api.route('/api/account/password', methods=['POST'])
@login_required
@demo_restrict
@json_body
def change_own_password():
    body = request.json_body

    if current_user.ldap:
        return jsonify({'error': 'Your password is managed by your organization\'s directory.'}), 400

    current_password = body.get('current_password')
    if not current_user.password or not isinstance(current_password, str) or \
            not check_password_hash(current_user.password, current_password):
        return jsonify({'error': 'Your current password is incorrect.'}), 403

    new_password = body.get('new_password')
    error = perms.password_error(new_password)
    if error:
        return jsonify({'error': error}), 400
    if new_password == current_password:
        return jsonify({'error': 'Choose a password different from your current one.'}), 400

    current_user.password = generate_password_hash(new_password, method='pbkdf2:sha256')
    current_user.must_change_password = False
    _clear_invite(current_user)
    db.session.commit()

    logger.info(f"User '{current_user.username}' changed their password")
    return jsonify({'changed': True})


def _user_for_invite_token(token):
    """Resolve a raw invite token to a User with an unexpired invite, or None."""
    if not isinstance(token, str) or not token:
        return None
    # Bounded so an oversized value never reaches the hash function.
    if len(token) > 256:
        return None
    user = User.query.filter_by(invite_token_hash=_hash_invite_token(token)).first()
    if not user or not user.invite_expires_at:
        return None
    if user.invite_expires_at < _now():
        return None
    if user.disabled:
        return None
    return user


@api.route('/api/account/setup-password', methods=['GET'])
def check_setup_password_token():
    """Validate an invite token so the setup page can greet the right account."""
    user = _user_for_invite_token(request.args.get('token'))
    if not user:
        return jsonify({'valid': False, 'error': 'This setup link is invalid or has expired.'}), 404
    return jsonify({'valid': True, 'username': user.username, 'name': user.name})


@api.route('/api/account/setup-password', methods=['POST'])
@json_body
def redeem_setup_password():
    body = request.json_body

    user = _user_for_invite_token(body.get('token'))
    if not user:
        return jsonify({'error': 'This setup link is invalid or has expired.'}), 404

    password = body.get('password')
    error = perms.password_error(password)
    if error:
        return jsonify({'error': error}), 400

    user.password = generate_password_hash(password, method='pbkdf2:sha256')
    user.must_change_password = False
    _clear_invite(user)
    db.session.commit()

    logger.info(f"User '{user.username}' set their password from an invite link")
    # Deliberately no automatic sign-in: the account may have MFA policies and the
    # normal login path is the one place that flow is implemented.
    return jsonify({'ready': True, 'username': user.username})
