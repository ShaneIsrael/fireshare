"""add user permissions, profile fields, and media ownership

Revision ID: p1k2l3m4n5o6
Revises: o0j1k2l3m4n5
Create Date: 2026-09-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'p1k2l3m4n5o6'
down_revision = 'o0j1k2l3m4n5'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def index_exists(table_name, index_name):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in [ix['name'] for ix in inspector.get_indexes(table_name)]


USER_COLUMNS = (
    ('permissions', lambda: sa.Column('permissions', sa.Text(), nullable=True)),
    ('disabled', lambda: sa.Column('disabled', sa.Boolean(), nullable=False, server_default='0')),
    ('env_managed', lambda: sa.Column('env_managed', sa.Boolean(), nullable=False, server_default='0')),
    ('must_change_password', lambda: sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='0')),
    ('invite_token_hash', lambda: sa.Column('invite_token_hash', sa.String(length=64), nullable=True)),
    ('invite_expires_at', lambda: sa.Column('invite_expires_at', sa.DateTime(), nullable=True)),
    ('created_at', lambda: sa.Column('created_at', sa.DateTime(), nullable=True)),
    ('last_login_at', lambda: sa.Column('last_login_at', sa.DateTime(), nullable=True)),
    ('display_name', lambda: sa.Column('display_name', sa.String(length=64), nullable=True)),
    ('bio', lambda: sa.Column('bio', sa.String(length=280), nullable=True)),
    ('profile_public', lambda: sa.Column('profile_public', sa.Boolean(), nullable=False, server_default='1')),
    ('avatar_version', lambda: sa.Column('avatar_version', sa.Integer(), nullable=False, server_default='0')),
)


def upgrade():
    for name, factory in USER_COLUMNS:
        if not column_exists('user', name):
            with op.batch_alter_table('user', schema=None) as batch_op:
                batch_op.add_column(factory())

    if not index_exists('user', 'ix_user_invite_token_hash'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.create_index('ix_user_invite_token_hash', ['invite_token_hash'], unique=False)

    # Media ownership. Nullable with no backfill: everything that already exists
    # was scanned off disk or uploaded anonymously and genuinely has no owner.
    for table in ('video', 'image'):
        if not column_exists(table, 'uploaded_by'):
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.add_column(sa.Column('uploaded_by', sa.Integer(), nullable=True))
        index_name = f'ix_{table}_uploaded_by'
        if not index_exists(table, index_name):
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.create_index(index_name, ['uploaded_by'], unique=False)

    bind = op.get_bind()

    # Older rows could carry a NULL admin flag, which now has to read as a
    # definite "not an administrator" rather than an absent value.
    #
    # The column's DB-level DEFAULT '1' (from 9ebc039c5b99) is deliberately left
    # in place. Changing it means rebuilding the whole user table in batch mode,
    # and it cannot actually mint an admin: User.admin carries a Python-side
    # default of False, so SQLAlchemy names the column in every INSERT it emits
    # and the DB default is never reached. A fresh schema built by
    # `fireshare init-db` has no default on the column at all.
    bind.execute(sa.text('UPDATE "user" SET admin = 0 WHERE admin IS NULL'))

    # Existing accounts predate created_at; give them a stable, non-null value so
    # the profile and user list don't render an empty "joined" date.
    bind.execute(sa.text(
        'UPDATE "user" SET created_at = :ts WHERE created_at IS NULL'
    ), {'ts': '2020-01-01 00:00:00.000000'})

    # Pin the env-managed account. ADMIN_USERNAME / ADMIN_PASSWORD are re-applied
    # on every boot, and that logic used to target "the first local admin" — once
    # a second admin exists, an unpinned query could rewrite the wrong account's
    # credentials. The lowest-id local admin is the one the bootstrap created.
    bootstrap_id = bind.execute(
        sa.text('SELECT id FROM "user" WHERE env_managed = 1 ORDER BY id LIMIT 1')
    ).scalar()
    if bootstrap_id is None:
        bootstrap_id = bind.execute(sa.text(
            'SELECT id FROM "user" WHERE admin = 1 AND (ldap = 0 OR ldap IS NULL) '
            'ORDER BY id LIMIT 1'
        )).scalar()
        if bootstrap_id is not None:
            bind.execute(
                sa.text('UPDATE "user" SET env_managed = 1 WHERE id = :id'),
                {'id': bootstrap_id},
            )

    # Adopt the existing library on behalf of that account. Nothing in the old
    # schema recorded who uploaded what, so there is no per-item answer to
    # recover: on the single-admin install this upgrade path describes, the
    # administrator is the accurate owner, and leaving everything unattributed
    # would mean an empty profile and a library outside the reach of the
    # edit_own / delete_own permissions.
    #
    # This only ever affects an install that already has both an administrator
    # and media. A fresh install runs this migration against empty tables and
    # creates its admin afterwards, so there is nothing to attribute.
    #
    # Where content really came from several people, an administrator can
    # reassign it in bulk from File Manager > Uploader.
    if bootstrap_id is not None:
        adopted_videos = bind.execute(
            sa.text('UPDATE video SET uploaded_by = :id WHERE uploaded_by IS NULL'),
            {'id': bootstrap_id},
        ).rowcount
        adopted_images = bind.execute(
            sa.text('UPDATE image SET uploaded_by = :id WHERE uploaded_by IS NULL'),
            {'id': bootstrap_id},
        ).rowcount
        if adopted_videos or adopted_images:
            username = bind.execute(
                sa.text('SELECT username FROM "user" WHERE id = :id'), {'id': bootstrap_id}
            ).scalar()
            print(
                f"  Attributed {adopted_videos} video(s) and {adopted_images} image(s) "
                f"to the administrator account '{username}'. Reassign them from "
                f"File Manager > Uploader if they belong to someone else."
            )

    # Every account that exists at upgrade time was, under the old model, able to
    # do everything a logged-in user could do. Granting the full non-admin
    # permission set preserves exactly that, so an upgrade never silently strips
    # access from a working account. Admins ignore the column entirely.
    bind.execute(sa.text(
        'UPDATE "user" SET permissions = :perms '
        'WHERE permissions IS NULL AND (admin = 0 OR admin IS NULL)'
    ), {'perms': (
        '["delete_any", "delete_own", "edit_any", "edit_own", "manage_games", '
        '"manage_library", "manage_tags", "transcode", "upload", "view_private"]'
    )})


def downgrade():
    for table in ('video', 'image'):
        index_name = f'ix_{table}_uploaded_by'
        if index_exists(table, index_name):
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.drop_index(index_name)
        if column_exists(table, 'uploaded_by'):
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.drop_column('uploaded_by')

    if index_exists('user', 'ix_user_invite_token_hash'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.drop_index('ix_user_invite_token_hash')

    for name, _ in reversed(USER_COLUMNS):
        if column_exists('user', name):
            with op.batch_alter_table('user', schema=None) as batch_op:
                batch_op.drop_column(name)
