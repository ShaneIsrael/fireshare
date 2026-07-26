"""add machine upload jobs

Revision ID: 1846092721e8
Revises: 9601ef6da2e2
Create Date: 2026-07-25 21:58:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "1846092721e8"
down_revision = "9601ef6da2e2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "machine_upload_job",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.String(length=32), nullable=False),
        sa.Column("video_id", sa.String(length=32), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("source_path", sa.String(length=2048), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("folder", sa.String(length=256), nullable=True),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("tag_ids_json", sa.Text(), nullable=False),
        sa.Column("private", sa.Boolean(), nullable=False),
        sa.Column("scan_pid", sa.Integer(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("deduplicated", sa.Boolean(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", name="uq_machine_upload_job_job_id"),
        sa.UniqueConstraint("video_id", name="uq_machine_upload_job_video_id"),
    )
    op.create_index("ix_machine_upload_job_job_id", "machine_upload_job", ["job_id"], unique=False)
    op.create_index("ix_machine_upload_job_status", "machine_upload_job", ["status"], unique=False)
    op.create_index("ix_machine_upload_job_video_id", "machine_upload_job", ["video_id"], unique=False)

    op.create_table(
        "machine_upload_request",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["machine_upload_job.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_machine_upload_request_idempotency_key"),
    )
    op.create_index(
        "ix_machine_upload_request_idempotency_key",
        "machine_upload_request",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        "ix_machine_upload_request_job_id",
        "machine_upload_request",
        ["job_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_machine_upload_request_job_id", table_name="machine_upload_request")
    op.drop_index("ix_machine_upload_request_idempotency_key", table_name="machine_upload_request")
    op.drop_table("machine_upload_request")
    op.drop_index("ix_machine_upload_job_video_id", table_name="machine_upload_job")
    op.drop_index("ix_machine_upload_job_status", table_name="machine_upload_job")
    op.drop_index("ix_machine_upload_job_job_id", table_name="machine_upload_job")
    op.drop_table("machine_upload_job")
