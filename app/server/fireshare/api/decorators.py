from functools import wraps
from flask import current_app, Response


def demo_restrict(f):
    """Block the decorated endpoint when DEMO_MODE is enabled."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if current_app.config.get('DEMO_MODE'):
            return Response(status=403, response='This action is disabled in demo mode.')
        return f(*args, **kwargs)
    return decorated
