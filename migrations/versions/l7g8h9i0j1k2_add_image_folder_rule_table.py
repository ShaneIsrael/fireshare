"""add image_folder_rule table

Revision ID: l7g8h9i0j1k2
Revises: k6f7g8h9i0j1
Create Date: 2026-04-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'l7g8h9i0j1k2'
down_revision = '5a12c7f85737'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('image_folder_rule',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('folder_path', sa.String(length=2048), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['game_metadata.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('folder_path')
    )


def downgrade():
    op.drop_table('image_folder_rule')
