"""add custom tag tables

Revision ID: j5e6f7g8h9i0
Revises: i4d5e6f7g8h9
Create Date: 2026-03-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'j5e6f7g8h9i0'
down_revision = 'i4d5e6f7g8h9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('custom_tag',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_custom_tag_name'), 'custom_tag', ['name'], unique=True)

    op.create_table('video_tag_link',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('video_id', sa.String(length=32), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tag_id'], ['custom_tag.id'], ),
        sa.ForeignKeyConstraint(['video_id'], ['video.video_id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('video_id', 'tag_id')
    )


def downgrade():
    op.drop_table('video_tag_link')
    op.drop_index(op.f('ix_custom_tag_name'), table_name='custom_tag')
    op.drop_table('custom_tag')
