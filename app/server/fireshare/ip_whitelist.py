import ipaddress
import logging
import sys
from functools import wraps

from flask import current_app, request, Response

logger = logging.getLogger('fireshare')


def parse_ip_whitelist(raw):
    """
    Parse LOGIN_IP_WHITELIST into a list of ip_network objects.

    Returns None when the variable is unset/empty (feature disabled). Exits the
    process on a malformed entry: warn-and-skip could silently allow all IPs or
    silently lock the admin out, so startup fails instead.
    """
    entries = [e.strip() for e in (raw or '').split(',') if e.strip()]
    if not entries:
        return None
    networks = []
    for entry in entries:
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.error(f"FATAL: LOGIN_IP_WHITELIST contains invalid entry '{entry}'")
            sys.exit(1)
    return networks


def get_client_ip():
    """
    Derive the client IP by peeling trusted proxy hops off the right of the
    X-Forwarded-For chain. The bundled nginx appends the true peer address to
    any client-supplied X-Forwarded-For, so with N trusted proxies the
    (N+1)-th entry from the right is the first address a trusted hop actually
    observed; anything further left is client-controlled and never used.
    """
    trusted_proxies = current_app.config.get('LOGIN_IP_WHITELIST_TRUSTED_PROXIES', 0)
    forwarded_for = request.headers.get('X-Forwarded-For', '')
    chain = [entry.strip() for entry in forwarded_for.split(',') if entry.strip()]
    chain.append(request.remote_addr or '')
    return chain[max(0, len(chain) - 1 - trusted_proxies)]


def is_ip_permitted(ip_str):
    whitelist = current_app.config.get('LOGIN_IP_WHITELIST')
    if whitelist is None:
        return True
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    mapped = getattr(addr, 'ipv4_mapped', None)
    if mapped is not None:
        addr = mapped
    return any(addr in network for network in whitelist)


def login_ip_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = get_client_ip()
        if not is_ip_permitted(ip):
            logger.warning(f"Blocked login attempt from non-whitelisted IP {ip}")
            return Response(response="Your IP address is not permitted to log in.", status=403)
        return f(*args, **kwargs)
    return decorated
