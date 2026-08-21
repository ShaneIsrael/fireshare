"""Helpers for opening LDAP connections with usable TLS defaults.

python-ldap/OpenLDAP does not fall back to the system trust store the way curl does:
with no CA configured it has nothing to verify a server certificate against, so an
`ldaps://` URL with a perfectly valid publicly-trusted certificate fails the handshake.
OpenLDAP then surfaces that as a bare SERVER_DOWN ("Can't contact LDAP server"), which
reads like a network or DNS problem. This module points OpenLDAP at the system CA
bundle by default and turns its errors into something actionable.
"""

import os
import threading

try:
    import ldap
except ImportError:
    ldap = None

# Where the system CA bundle lives on the distros Fireshare gets run on. The official
# images are Debian/Ubuntu based and install ca-certificates, so the first entry hits.
SYSTEM_CA_BUNDLES = (
    '/etc/ssl/certs/ca-certificates.crt',   # Debian, Ubuntu
    '/etc/pki/tls/certs/ca-bundle.crt',     # RHEL, Fedora
    '/etc/ssl/ca-bundle.pem',               # openSUSE
    '/etc/ssl/cert.pem',                    # Alpine, macOS
)

REQCERT_VALUES = ('never', 'allow', 'try', 'demand', 'hard')

# Without these a bad host, a dropped packet or a wedged server stalls until the OS
# gives up, which means a hung container start or a login request that never answers.
CONNECT_TIMEOUT_SECONDS = 10
OPERATION_TIMEOUT_SECONDS = 30


class LdapConfigError(ValueError):
    """Raised for LDAP settings that are wrong no matter how often we retry."""


def uses_tls(url, starttls=False):
    return bool(starttls) or (url or '').strip().lower().startswith('ldaps://')


def _reqcert_option(value):
    options = {
        'never': ldap.OPT_X_TLS_NEVER,
        'allow': ldap.OPT_X_TLS_ALLOW,
        'try': ldap.OPT_X_TLS_TRY,
        'demand': ldap.OPT_X_TLS_DEMAND,
        'hard': ldap.OPT_X_TLS_HARD,
    }
    if value not in options:
        raise LdapConfigError(
            "LDAP_TLS_REQCERT={!r} is not valid, expected one of: {}".format(
                value, ', '.join(REQCERT_VALUES)))
    return options[value]


def resolve_ca_bundle(configured=None):
    """Return the CA bundle to verify the LDAP server against, or None if none was found."""
    if configured:
        if not os.path.isfile(configured):
            raise LdapConfigError("LDAP_TLS_CACERT={!r} does not exist".format(configured))
        return configured
    for path in SYSTEM_CA_BUNDLES:
        if os.path.isfile(path):
            return path
    return None


def _set_option(conn, option, value):
    """Set a connection option, reporting whether this build of OpenLDAP supports it.

    Not every TLS backend supports every option: python-ldap on macOS links against
    Apple's SecureTransport, which rejects OPT_X_TLS_CACERTFILE because it verifies
    against the system keychain instead. That is a fine outcome, not a reason to refuse
    to start.
    """
    try:
        conn.set_option(option, value)
        return True
    except ValueError:
        return False


def apply_tls_options(conn, config):
    """Configure TLS on `conn`, returning a dict of what was applied (for logging).

    Explicit LDAPTLS_* environment variables are left alone: those are OpenLDAP's own
    escape hatch and anyone who set them meant it.
    """
    if ldap is None or not uses_tls(config.get('LDAP_URL'), config.get('LDAP_STARTLS')):
        return {}

    applied = {}
    unsupported = []

    reqcert = (config.get('LDAP_TLS_REQCERT') or '').strip().lower()
    if reqcert and not os.getenv('LDAPTLS_REQCERT'):
        if _set_option(conn, ldap.OPT_X_TLS_REQUIRE_CERT, _reqcert_option(reqcert)):
            applied['reqcert'] = reqcert
        else:
            unsupported.append('LDAP_TLS_REQCERT')

    if reqcert != 'never' and not os.getenv('LDAPTLS_CACERT'):
        ca_bundle = resolve_ca_bundle(config.get('LDAP_TLS_CACERT'))
        if ca_bundle:
            if _set_option(conn, ldap.OPT_X_TLS_CACERTFILE, ca_bundle):
                applied['cacert'] = ca_bundle
            else:
                unsupported.append('LDAP_TLS_CACERT')

    # Per-connection TLS options only take effect once a fresh TLS context is built.
    if applied:
        _set_option(conn, ldap.OPT_X_TLS_NEWCTX, 0)
    if unsupported:
        applied['unsupported'] = unsupported
    return applied


def connect(config):
    """Open (but do not bind) a connection to the configured LDAP server."""
    url = config["LDAP_URL"]
    conn = ldap.initialize(url)
    conn.protocol_version = ldap.VERSION3
    _set_option(conn, ldap.OPT_NETWORK_TIMEOUT, CONNECT_TIMEOUT_SECONDS)
    _set_option(conn, ldap.OPT_TIMEOUT, OPERATION_TIMEOUT_SECONDS)
    applied = apply_tls_options(conn, config)
    if config.get('LDAP_STARTLS'):
        if url.strip().lower().startswith('ldaps://'):
            raise LdapConfigError(
                "LDAP_STARTLS is set but LDAP_URL uses ldaps://, which is already "
                "TLS from the first byte. Use ldap:// with STARTTLS, or drop LDAP_STARTLS.")
        conn.start_tls_s()
    return conn, applied


def bind(conn, config):
    """Bind as the configured service account."""
    conn.simple_bind_s(
        config["LDAP_BINDDN"] + "," + config["LDAP_BASEDN"],
        config["LDAP_PASSWORD"]
    )


# Guards the shared connection so two concurrent logins cannot each open one and leak
# the loser.
_connect_lock = threading.Lock()


def get_connection(app):
    """Return the app's bound LDAP connection, opening one on first use."""
    conn = getattr(app, 'ldap_conn', None)
    if conn is not None:
        return conn
    with _connect_lock:
        conn = getattr(app, 'ldap_conn', None)
        if conn is None:
            conn, _ = connect(app.config)
            bind(conn, app.config)
            app.ldap_conn = conn
        return conn


def reset_connection(app):
    """Drop the cached connection so the next use reconnects."""
    conn = getattr(app, 'ldap_conn', None)
    app.ldap_conn = None
    if conn is not None:
        try:
            conn.unbind_s()
        except Exception:
            pass


def _host_port(url):
    """Pull host:port out of an LDAP URL, for use in a suggested openssl command."""
    remainder = (url or '').split('://', 1)[-1].split('/', 1)[0]
    if remainder and ':' not in remainder.rsplit(']', 1)[-1]:
        remainder += ':636' if (url or '').strip().lower().startswith('ldaps://') else ':389'
    return remainder or '<host>:<port>'


def describe_error(exc, config):
    """Render an LDAP exception as a message that points at the actual problem."""
    detail = ''
    if getattr(exc, 'args', None) and isinstance(exc.args[0], dict):
        info = exc.args[0]
        detail = ' - '.join(str(p) for p in (info.get('desc'), info.get('info')) if p)
    if not detail:
        # ldap.TIMEOUT and a failed DNS lookup often carry nothing at all.
        detail = str(exc) or 'no details reported by the LDAP library'
    message = "{}: {}".format(type(exc).__name__, detail)

    url = config.get('LDAP_URL')
    if ldap is not None and isinstance(exc, ldap.SERVER_DOWN) and uses_tls(url, config.get('LDAP_STARTLS')):
        try:
            ca_bundle = resolve_ca_bundle(config.get('LDAP_TLS_CACERT'))
        except LdapConfigError:
            ca_bundle = None
        verifying = ("verifying against {}".format(ca_bundle) if ca_bundle
                     else "not verifying against any CA bundle, because none was found")
        message += (
            "\nSERVER_DOWN covers both an unreachable server and a failed TLS handshake: "
            "OpenLDAP reports them identically and rarely says which one happened. If the host "
            "and port are reachable, this is almost certainly the certificate. Fireshare is {}. "
            "The usual causes are a certificate signed by a CA that is not in that bundle, and a "
            "certificate whose name does not match the host in LDAP_URL. Check both with: "
            "openssl s_client -connect {}. If the server uses a private or self-signed CA, point "
            "LDAP_TLS_CACERT at that CA certificate; as a last resort LDAP_TLS_REQCERT=never "
            "skips verification entirely (insecure).".format(verifying, _host_port(url))
        )
    return message
