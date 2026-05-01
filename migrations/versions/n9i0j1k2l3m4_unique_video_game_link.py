"""add unique constraint to video_game_link and remove existing duplicates

Revision ID: n9i0j1k2l3m4
Revises: m8h9i0j1k2l3
Create Date: 2026-05-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'n9i0j1k2l3m4'
down_revision = 'm8h9i0j1k2l3'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Remove duplicate rows, keeping the lowest id for each (video_id, game_id) pair
    conn.execute(text("""
        DELETE FROM video_game_link
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM video_game_link
            GROUP BY video_id, game_id
        )
    """))

    op.create_unique_constraint(
        'uq_video_game_link_video_id_game_id',
        'video_game_link',
        ['video_id', 'game_id']
    )


def downgrade():
    op.drop_constraint(
        'uq_video_game_link_video_id_game_id',
        'video_game_link',
        type_='unique'
    )
