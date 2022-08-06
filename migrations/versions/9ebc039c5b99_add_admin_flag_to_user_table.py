"""add admin flag to user table

Revision ID: 9ebc039c5b99
Revises: 8873c9333689
Create Date: 2022-08-05 20:50:16.032433

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9ebc039c5b99'
down_revision = '8873c9333689'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user', sa.Column('admin', sa.Boolean(), server_default='1'))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('user', 'admin')
    # ### end Alembic commands ###
