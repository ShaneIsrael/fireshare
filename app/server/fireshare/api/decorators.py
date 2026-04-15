from functools import wraps
from flask import current_app, Response
from flask_login import current_user


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
