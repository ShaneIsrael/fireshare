from functools import wraps
from flask import current_app, Response, jsonify, request
from flask_login import current_user, login_required


def demo_restrict(f):
    """Block the decorated endpoint when the logged-in user is the demo account."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if (
            current_app.config.get('DEMO_MODE')
            and current_user.is_authenticated
            and current_user.username == 'demo'
        ):
            return Response(status=403, response='This action is disabled in demo mode.')
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Require an administrator.

    Preserves the demo-mode bypass the inline checks in api/admin.py have always
    had, so the read-only demo instance keeps working as it does today. Anything
    that must never be reachable by the demo account uses strict_admin_required.
    """
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.admin and not current_app.config.get('DEMO_MODE'):
            return Response(status=403, response='Admin access required.')
        return f(*args, **kwargs)
    return decorated


def strict_admin_required(f):
    """Require a real administrator, with no demo-mode bypass.

    Used for user management: the demo account is not an admin, and must not be
    able to create accounts or change anyone's permissions.
    """
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.admin:
            return Response(status=403, response='Admin access required.')
        return f(*args, **kwargs)
    return decorated


def require_perm(*permissions):
    """Require that the user holds at least one of the named capabilities.

    Admins satisfy every check via User.can(). Ownership-scoped actions still need
    a per-object test — see require_media_perm and User.can_modify.
    """
    def wrapper(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if not any(current_user.can(p) for p in permissions):
                return Response(status=403, response='Permission denied.')
            return f(*args, **kwargs)
        return decorated
    return wrapper


def json_body(f):
    """Provide a guaranteed-dict JSON body, rejecting anything else with a 400.

    request.get_json() raises on a malformed or absent body and returns bare
    scalars for input like `"x"` or `5`, both of which would otherwise surface as
    a 500 or an AttributeError deeper in the handler.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        body = request.get_json(silent=True)
        if body is None:
            body = {} if not request.data else None
        if not isinstance(body, dict):
            return jsonify({'error': 'Expected a JSON object body.'}), 400
        request.json_body = body
        return f(*args, **kwargs)
    return decorated
