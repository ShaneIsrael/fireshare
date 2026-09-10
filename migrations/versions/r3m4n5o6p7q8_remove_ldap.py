"""convert LDAP accounts to local accounts and drop the ldap column

Revision ID: r3m4n5o6p7q8
Revises: q2l3m4n5o6p7
Create Date: 2026-09-09 23:40:00.000000

LDAP authentication has been removed. Directory accounts are kept as local
accounts rather than deleted: `video.uploaded_by` and `image.uploaded_by`
reference `user.id`, so deleting the row would orphan everything that account
ever uploaded, with no way to reattribute it. Every row keeps its id.

A converted account has no password, so it cannot sign in until an
administrator sets one or sends an invite from Settings > Users. `create_app()`
refuses to start while an LDAP configuration is still present, so reaching this
migration means the operator has already removed those variables and accepted
the change.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'r3m4n5o6p7q8'
down_revision = 'q2l3m4n5o6p7'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if not column_exists('user', 'ldap'):
        return

    bind = op.get_bind()

    # Convert before dropping the column, while the rows can still be identified.
    #
    # must_change_password is set so that whatever credential an administrator
    # issues has to be replaced by the account holder on first use.
    #
    # An LDAP account's admin flag was re-derived from directory group
    # membership on every sign-in, so the stored value is a cache of the last
    # login rather than a decision anyone made here. It is deliberately left
    # as-is: clearing it could remove the only administrator on an
    # LDAP-only instance, and this migration must not be the thing that locks
    # someone out of their own server. Permissions are likewise untouched.
    #
    # Clearing MFA is belt-and-braces. Enrolment was refused for directory
    # accounts, so these columns should already be empty; if one is not, an
    # account with a stale secret would demand a code its owner never enrolled
    # as soon as an administrator gave it a password.
    converted = bind.execute(sa.text(
        """
        UPDATE "user"
           SET ldap = 0,
               password = NULL,
               must_change_password = 1,
               totp_secret = NULL,
               mfa_enabled = 0,
               totp_last_used = NULL
         WHERE ldap = 1
        """
    )).rowcount

    if converted:
        print("  Converted {} LDAP account(s) to local accounts. Their uploads, "
              "profiles and permissions are unchanged. Set a password or send an "
              "invite from Settings > Users so they can sign in "
              "again.".format(converted))

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('ldap')


def downgrade():
    # Restores the column, not the accounts: the passwords and directory
    # linkage that made those rows LDAP accounts are gone, and every row now
    # looks local. Downgrading gets the schema back so an older Fireshare can
    # boot; those users still need a password set.
    if not column_exists('user', 'ldap'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('ldap', sa.Boolean(), nullable=True, server_default='0')
            )
