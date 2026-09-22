"""add upload_token table

Revision ID: s4n5o6p7q8r9
Revises: r3m4n5o6p7q8
Create Date: 2026-09-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 's4n5o6p7q8r9'
down_revision = 'r3m4n5o6p7q8'
branch_labels = None
depends_on = None


def table_exists(table_name):
    bind = op.get_bind()
    return table_name in sa.inspect(bind).get_table_names()


def upgrade():
    # Long-lived upload credentials for external tools. Only the sha256 of each
    # token is stored; `prefix` is the non-secret leading fragment shown in the UI
    # so an owner can tell their tokens apart.
    if not table_exists('upload_token'):
        op.create_table(
            'upload_token',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=64), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('prefix', sa.String(length=24), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('last_used_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.PrimaryKeyConstraint('id'),
        )
        with op.batch_alter_table('upload_token', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_upload_token_user_id'), ['user_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_upload_token_token_hash'), ['token_hash'], unique=True)


def downgrade():
    if table_exists('upload_token'):
        with op.batch_alter_table('upload_token', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_upload_token_token_hash'))
            batch_op.drop_index(batch_op.f('ix_upload_token_user_id'))
        op.drop_table('upload_token')
