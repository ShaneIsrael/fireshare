"""Startup guard for instances that still carry an LDAP configuration.

LDAP authentication was removed in this version. Removing it changes the `user`
table: directory accounts are converted to local accounts by the
`r3m4n5o6p7q8` migration, which is a one-way change to somebody's database.

An operator who still depends on LDAP should get to make that call themselves,
so Fireshare refuses to start while any LDAP setting is still present rather
than migrating and then reporting it afterwards. Clearing the variables is the
operator's acknowledgement that directory logins are going away.

The check has to run before `flask db upgrade`, or the confirmation it asks for
would be requested after the change it guards. It runs from `create_app()`,
which the migration step also goes through (FLASK_APP points at the factory),
so both the migration and the server hit it. `entrypoint.sh` runs under
`set -e`, so exiting non-zero here stops the container before the migration.
"""

import os
import sys

# Every setting Fireshare itself read for LDAP. OpenLDAP's own LDAPTLS_*
# variables are deliberately not included: those belong to the C library, not
# to Fireshare, and may be set in an environment for reasons unrelated to us.
LDAP_ENV_VARS = (
    'LDAP_ENABLE',
    'LDAP_URL',
    'LDAP_STARTLS',
    'LDAP_TLS_CACERT',
    'LDAP_TLS_REQCERT',
    'LDAP_BASEDN',
    'LDAP_BINDDN',
    'LDAP_PASSWORD',
    'LDAP_USER_FILTER',
    'LDAP_ADMIN_GROUP',
)


def detect_ldap_env(environ=None):
    """Return the LDAP variables that are set to a non-empty value.

    An empty value does not count. Compose files routinely pass a variable
    through with nothing behind it (`LDAP_URL=${LDAP_URL}` with the outer
    variable unset), and treating that as an LDAP configuration would block
    instances that never used the feature.

    A falsy `LDAP_ENABLE` does count. The point is to have the operator remove
    the configuration deliberately, and a stale `LDAP_ENABLE=false` in a
    compose file is exactly the case where the removal would otherwise go
    unnoticed.
    """
    env = os.environ if environ is None else environ
    return [name for name in LDAP_ENV_VARS if (env.get(name) or '').strip()]


def format_message(found):
    """Build the operator-facing explanation for `found`, a list of variables."""
    listed = '\n'.join('      - {}'.format(name) for name in found)
    return (
        "\n"
        "  LDAP has been discontinued\n"
        "  ---------------------------------------------------------------------\n"
        "  LDAP authentication has been removed from Fireshare in this version\n"
        "  and all later versions. This instance still has an LDAP\n"
        "  configuration, so Fireshare has not started and your database has\n"
        "  not been modified.\n"
        "\n"
        "  Found the following LDAP settings in the environment:\n"
        "{listed}\n"
        "\n"
        "  To continue the upgrade, remove those variables from your compose\n"
        "  file (or wherever the environment is set) and start Fireshare again.\n"
        "  Removing them confirms that you accept the change below.\n"
        "\n"
        "  What happens when you confirm:\n"
        "      - Each directory account becomes a local account. Its uploads,\n"
        "        profile and permissions are kept.\n"
        "      - Those accounts have no password, so they cannot sign in until\n"
        "        an administrator sets one or sends an invite from\n"
        "        Settings > Users.\n"
        "      - Nothing is deleted.\n"
        "\n"
        "  If you still need LDAP, do not remove the variables. Pin your image\n"
        "  to the release you were running before this upgrade and stay there;\n"
        "  this version cannot authenticate against a directory.\n"
        "  ---------------------------------------------------------------------\n"
    ).format(listed=listed)


def abort_if_ldap_configured(logger=None, environ=None, exit_code=1):
    """Stop startup when an LDAP configuration is still present.

    Returns the variables found, so a caller that wants to inspect rather than
    exit can pass its own `exit_code=None`.
    """
    found = detect_ldap_env(environ)
    if not found:
        return found

    message = format_message(found)
    if logger is not None:
        logger.error(message)
    else:
        # Reached when the guard runs before logging is wired up.
        sys.stderr.write(message)
        sys.stderr.flush()

    if exit_code is not None:
        sys.exit(exit_code)
    return found
