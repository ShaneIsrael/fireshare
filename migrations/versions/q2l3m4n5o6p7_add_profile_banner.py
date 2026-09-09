"""add profile banner image

Revision ID: q2l3m4n5o6p7
Revises: p1k2l3m4n5o6
Create Date: 2026-09-09 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'q2l3m4n5o6p7'
down_revision = 'p1k2l3m4n5o6'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # 0 = no uploaded banner, in which case the profile falls back to the
    # most-uploaded game's art and then to a generated gradient. Doubles as a
    # cache buster, exactly like avatar_version.
    if not column_exists('user', 'banner_version'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('banner_version', sa.Integer(), nullable=False, server_default='0')
            )


def downgrade():
    if column_exists('user', 'banner_version'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.drop_column('banner_version')
