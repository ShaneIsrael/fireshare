"""Capability keys, presets, and the validators shared by every user-facing route.

Permissions are stored on User.permissions as a JSON array of *granted* keys, so an
unknown or newly-added key degrades to "not granted" rather than accidentally
authorizing something. The admin flag short-circuits every check.
"""
import json
import re
import unicodedata

# Grantable to a non-admin user.
VIEW_PRIVATE   = 'view_private'
UPLOAD         = 'upload'
EDIT_OWN       = 'edit_own'
DELETE_OWN     = 'delete_own'
EDIT_ANY       = 'edit_any'
DELETE_ANY     = 'delete_any'
MANAGE_TAGS    = 'manage_tags'
MANAGE_GAMES   = 'manage_games'
TRANSCODE      = 'transcode'
MANAGE_LIBRARY = 'manage_library'

GRANTABLE_PERMISSIONS = (
    VIEW_PRIVATE,
    UPLOAD,
    EDIT_OWN,
    DELETE_OWN,
    EDIT_ANY,
    DELETE_ANY,
    MANAGE_TAGS,
    MANAGE_GAMES,
    TRANSCODE,
    MANAGE_LIBRARY,
)

# Everything an admin can do that cannot be handed out individually. Kept as
# named constants so route decorators read the same way as the grantable ones,
# but User.can() always returns False for these unless the user is an admin.
MANAGE_SETTINGS = 'manage_settings'
MANAGE_USERS    = 'manage_users'

ADMIN_ONLY_PERMISSIONS = (MANAGE_SETTINGS, MANAGE_USERS)

# UI presets. These are not persisted — the Add User dialog uses them to tick
# boxes, and the user list labels a permission set with a preset's name when it
# matches exactly. Order matters: most privileged last.
PRESETS = {
    'viewer': (VIEW_PRIVATE,),
    'contributor': (VIEW_PRIVATE, UPLOAD, EDIT_OWN, DELETE_OWN, MANAGE_TAGS),
    'curator': (
        VIEW_PRIVATE, UPLOAD, EDIT_OWN, DELETE_OWN, EDIT_ANY, DELETE_ANY,
        MANAGE_TAGS, MANAGE_GAMES, TRANSCODE, MANAGE_LIBRARY,
    ),
}

PRESET_LABELS = {
    'viewer': 'Viewer',
    'contributor': 'Contributor',
    'curator': 'Curator',
}

PERMISSION_LABELS = {
    VIEW_PRIVATE:   'View private media',
    UPLOAD:         'Upload',
    EDIT_OWN:       'Edit own uploads',
    DELETE_OWN:     'Delete own uploads',
    EDIT_ANY:       'Edit any media',
    DELETE_ANY:     'Delete any media',
    MANAGE_TAGS:    'Manage tags',
    MANAGE_GAMES:   'Manage games',
    TRANSCODE:      'Transcode',
    MANAGE_LIBRARY: 'Manage library',
}


def parse_permissions(raw):
    """Decode a stored permissions column into a set of known, granted keys."""
    if not raw:
        return set()
    try:
        decoded = json.loads(raw)
    except (TypeError, ValueError):
        return set()
    if not isinstance(decoded, list):
        return set()
    return {p for p in decoded if isinstance(p, str) and p in GRANTABLE_PERMISSIONS}


def clean_permissions(values):
    """Reduce caller-supplied permissions to a sorted list of known keys.

    Anything unrecognised is dropped rather than rejected so a client on an older
    build cannot fail the whole request, and so an admin-only key smuggled into
    the list can never be persisted as though it were grantable.
    """
    if not isinstance(values, (list, tuple, set)):
        return []
    return sorted({v for v in values if isinstance(v, str) and v in GRANTABLE_PERMISSIONS})


def serialize_permissions(values):
    return json.dumps(clean_permissions(values))


def preset_for(permissions):
    """Return the preset key whose permission set matches exactly, else None."""
    granted = set(permissions)
    for key, perms in PRESETS.items():
        if granted == set(perms):
            return key
    return None


def describe_permissions(admin, permissions):
    """Human-readable summary used by the admin user list."""
    if admin:
        return 'Administrator'
    granted = set(permissions)
    if not granted:
        return 'No access'
    preset = preset_for(granted)
    if preset:
        return PRESET_LABELS[preset]
    return ' · '.join(PERMISSION_LABELS[p] for p in GRANTABLE_PERMISSIONS if p in granted)


# ---------------------------------------------------------------------------
# Input validators
#
# Usernames appear in URLs (/u/<username>), in generated file paths, and in
# rendered Open Graph metadata, so the accepted character set is deliberately
# narrow: ASCII letters, digits, and the three separators that read naturally in
# a URL. That rules out path traversal, NUL bytes, RTL overrides, homoglyph
# impersonation, and anything needing escaping in HTML, JS, or a shell.
# ---------------------------------------------------------------------------

USERNAME_MIN_LENGTH = 2
USERNAME_MAX_LENGTH = 32
_USERNAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,30}[A-Za-z0-9]$')

# Names that would collide with an existing route segment or read as a system
# account. Compared case-insensitively against the normalized username.
RESERVED_USERNAMES = frozenset({
    'admin', 'administrator', 'root', 'system', 'fireshare', 'api', 'static',
    'login', 'logout', 'signup', 'settings', 'account', 'users', 'user', 'u',
    'watch', 'images', 'image', 'videos', 'video', 'games', 'game', 'tags',
    'tag', 'folders', 'folder', 'files', 'public', 'private', 'null', 'undefined',
    'me', 'anonymous', 'deleted',
})

DISPLAY_NAME_MAX_LENGTH = 64
BIO_MAX_LENGTH = 280


def normalize_username(value):
    """Return the canonical form of a username, or None if it is unusable.

    NFKC folds the compatibility variants that let two visually identical names
    map to different strings; the result still has to satisfy the ASCII-only
    pattern, so this narrows the input rather than widening it.
    """
    if not isinstance(value, str):
        return None
    candidate = unicodedata.normalize('NFKC', value).strip()
    if not _USERNAME_RE.match(candidate):
        return None
    if len(candidate) < USERNAME_MIN_LENGTH or len(candidate) > USERNAME_MAX_LENGTH:
        return None
    return candidate


def is_valid_username(value):
    return normalize_username(value) is not None


def username_error(value):
    """Return a message explaining why a username is unacceptable, or None."""
    normalized = normalize_username(value)
    if normalized is None:
        return (
            f'Usernames must be {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters, '
            'use only letters, numbers, dots, dashes, and underscores, and start and '
            'end with a letter or number.'
        )
    if normalized.lower() in RESERVED_USERNAMES:
        return f'"{normalized}" is reserved and cannot be used as a username.'
    return None


# Stripped from free-text profile fields: C0/C1 control characters, the
# zero-width joiners, and the bidi overrides that can reorder rendered text to
# disguise what a name actually says. Values are escaped at render time by React
# and by Jinja, so this is about storing clean data, not about output safety.
_CONTROL_CHARS = re.compile(
    '['
    '\x00-\x1F'      # C0 controls, incl. NUL
    '\x7F-\x9F'      # DEL and C1 controls
    '\u200B-\u200F'  # zero-width space/joiners, LRM/RLM
    '\u202A-\u202E'  # bidi embedding and overrides
    '\u2060-\u2064'  # word joiner, invisible operators
    '\u2066-\u2069'  # bidi isolates
    '\uFEFF'          # zero-width no-break space / BOM
    ']'
)


def clean_text_field(value, max_length):
    """Normalize and length-cap a free-text profile field. Returns None if empty."""
    if not isinstance(value, str):
        return None
    cleaned = unicodedata.normalize('NFKC', value)
    cleaned = _CONTROL_CHARS.sub('', cleaned).strip()
    if not cleaned:
        return None
    return cleaned[:max_length]


def clean_display_name(value):
    return clean_text_field(value, DISPLAY_NAME_MAX_LENGTH)


def clean_bio(value):
    return clean_text_field(value, BIO_MAX_LENGTH)


PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 1024


def password_error(value):
    """Return a message explaining why a password is unacceptable, or None.

    The upper bound matters: pbkdf2 will happily hash a 10MB string and burn the
    worker doing it, so an unbounded password field is a cheap denial of service.
    """
    if not isinstance(value, str) or not value:
        return 'A password is required.'
    if len(value) < PASSWORD_MIN_LENGTH:
        return f'Passwords must be at least {PASSWORD_MIN_LENGTH} characters.'
    if len(value) > PASSWORD_MAX_LENGTH:
        return f'Passwords cannot be longer than {PASSWORD_MAX_LENGTH} characters.'
    return None
