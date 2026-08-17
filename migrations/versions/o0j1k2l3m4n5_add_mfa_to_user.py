"""add mfa columns to user

Revision ID: o0j1k2l3m4n5
Revises: 9601ef6da2e2
Create Date: 2026-08-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'o0j1k2l3m4n5'
down_revision = '9601ef6da2e2'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if not column_exists('user', 'totp_secret'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(sa.Column('totp_secret', sa.String(length=64), nullable=True))
    if not column_exists('user', 'mfa_enabled'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='0'))
    if not column_exists('user', 'totp_last_used'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(sa.Column('totp_last_used', sa.Integer(), nullable=True))


def downgrade():
    if column_exists('user', 'totp_last_used'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.drop_column('totp_last_used')
    if column_exists('user', 'mfa_enabled'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.drop_column('mfa_enabled')
    if column_exists('user', 'totp_secret'):
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.drop_column('totp_secret')
