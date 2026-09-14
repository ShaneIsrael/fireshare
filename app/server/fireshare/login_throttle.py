"""Throttling for the password step of login.

The MFA step already caps attempts per pending session, but the password check in
front of it had none, so a known username — most usefully the default `admin` this
application itself warns operators to change — could be guessed at as fast as the
server would answer.

Counters live in process memory. Fireshare runs as a single server process per
instance, so that is enough here and keeps both a rate-limiting dependency and the
shared store it would normally want out of the deployment. The cost is that
counters reset if the process restarts, which an attacker cannot force.

Two limits apply together:

* per source IP, which stops the ordinary case of one host working through a
  password list, and also catches it spraying many usernames at once;
* per source IP *and* username, which trips sooner on a single targeted account.

Neither is keyed on the username alone, deliberately. A global per-account lockout
would let anyone on the internet lock a known username — again, most usefully
`admin` — out of their own instance by failing logins on purpose.
"""

import threading
import time

WINDOW_SECONDS = 300
MAX_FAILURES_PER_IP = 30
MAX_FAILURES_PER_ACCOUNT = 10

# Bounds the memory an attacker rotating source addresses can cause us to hold.
# Entries older than the window are dropped first, so this only bites under an
# active distributed attempt.
_MAX_TRACKED_KEYS = 4096

_lock = threading.Lock()
_failures = {}


def _ip_key(ip):
    return f"ip:{ip}"


def _account_key(ip, username):
    return f"account:{ip}|{(username or '').strip().lower()}"


def _recent(key, now):
    """Timestamps for a key inside the window, pruned in place."""
    stamps = [t for t in _failures.get(key, ()) if t > now - WINDOW_SECONDS]
    if stamps:
        _failures[key] = stamps
    else:
        _failures.pop(key, None)
    return stamps


def _evict(now):
    for key in [k for k in _failures if not any(t > now - WINDOW_SECONDS for t in _failures[k])]:
        del _failures[key]
    if len(_failures) > _MAX_TRACKED_KEYS:
        # Keep the most recently active keys; an attacker churning through source
        # addresses should not be able to push a real offender's counter out.
        for key in sorted(_failures, key=lambda k: _failures[k][-1])[: len(_failures) - _MAX_TRACKED_KEYS]:
            del _failures[key]


def retry_after(ip, username):
    """Seconds the caller must wait, or 0 when the attempt may proceed."""
    now = time.time()
    with _lock:
        _evict(now)
        wait = 0
        for key, limit in ((_ip_key(ip), MAX_FAILURES_PER_IP),
                           (_account_key(ip, username), MAX_FAILURES_PER_ACCOUNT)):
            stamps = _recent(key, now)
            if len(stamps) >= limit:
                wait = max(wait, int(stamps[0] + WINDOW_SECONDS - now) + 1)
        return wait


def record_failure(ip, username):
    now = time.time()
    with _lock:
        for key, limit in ((_ip_key(ip), MAX_FAILURES_PER_IP),
                           (_account_key(ip, username), MAX_FAILURES_PER_ACCOUNT)):
            stamps = _recent(key, now)
            stamps.append(now)
            # A blocked caller that keeps hammering should not grow this without
            # bound; everything past the limit tells us nothing extra.
            del stamps[: max(0, len(stamps) - limit)]
            _failures[key] = stamps
        _evict(now)


def clear(ip, username):
    """Forget the failures for an address/account pair after a success."""
    with _lock:
        _failures.pop(_account_key(ip, username), None)
        _failures.pop(_ip_key(ip), None)


def reset():
    """Drop all state. For tests."""
    with _lock:
        _failures.clear()
