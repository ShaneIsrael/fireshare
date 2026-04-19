"""add transcode_job table

Revision ID: m8h9i0j1k2l3
Revises: l7g8h9i0j1k2
Create Date: 2026-04-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'm8h9i0j1k2l3'
down_revision = 'l7g8h9i0j1k2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('transcode_job',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('video_id', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='pending'),
        sa.Column('task_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transcode_job_video_id', 'transcode_job', ['video_id'])
    op.create_index('ix_transcode_job_status', 'transcode_job', ['status'])


def downgrade():
    op.drop_index('ix_transcode_job_status', table_name='transcode_job')
    op.drop_index('ix_transcode_job_video_id', table_name='transcode_job')
    op.drop_table('transcode_job')
