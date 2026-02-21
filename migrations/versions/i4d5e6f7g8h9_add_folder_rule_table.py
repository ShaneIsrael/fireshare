"""add folder_rule table

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7g8
Create Date: 2026-02-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i4d5e6f7g8h9'
down_revision = 'h3c4d5e6f7g8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('folder_rule',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('folder_path', sa.String(length=2048), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['game_metadata.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('folder_path')
    )


def downgrade():
    op.drop_table('folder_rule')
