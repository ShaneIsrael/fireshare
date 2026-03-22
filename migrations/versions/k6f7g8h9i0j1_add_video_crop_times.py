"""add start_time, end_time, and has_crop to video_info

Revision ID: k6f7g8h9i0j1
Revises: j5e6f7g8h9i0
Create Date: 2026-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'k6f7g8h9i0j1'
down_revision = 'j5e6f7g8h9i0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('video_info', schema=None) as batch_op:
        batch_op.add_column(sa.Column('start_time', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('end_time', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('has_crop', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    with op.batch_alter_table('video_info', schema=None) as batch_op:
        batch_op.drop_column('has_crop')
        batch_op.drop_column('end_time')
        batch_op.drop_column('start_time')
