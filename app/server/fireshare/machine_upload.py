import errno
import hashlib
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from flask import current_app
from sqlalchemy.exc import IntegrityError, OperationalError

from . import db, logger, util
from .constants import SUPPORTED_FILE_TYPES
from .models import (
    CustomTag,
    GameMetadata,
    MachineUploadJob,
    MachineUploadRequest,
    Video,
    VideoGameLink,
    VideoInfo,
    VideoTagLink,
)


FOLDER_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[\x21-\x7E]{1,128}$")
STAGING_SUFFIX = ".machine-upload"
MARKER_SUFFIX = ".machine-upload.lock"
COPY_CHUNK_SIZE = 1024 * 1024


class MachineUploadError(Exception):
    def __init__(self, code, message, status_code, job=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.job = job


@dataclass(frozen=True)
class UploadMetadata:
    original_filename: str
    extension: str
    raw_title: str | None
    raw_folder: str | None
    game_id: int | None
    tag_ids: tuple[int, ...]
    raw_private: bool | None
    default_folder: str
    default_private: bool

    @property
    def new_title(self):
        return self.raw_title or Path(self.original_filename).stem

    @property
    def new_folder(self):
        return self.raw_folder or self.default_folder

    @property
    def new_private(self):
        return self.default_private if self.raw_private is None else self.raw_private


@dataclass
class UploadResult:
    job: MachineUploadJob
    status_code: int
    deduplicated: bool


def validate_idempotency_key(value):
    if not value or not IDEMPOTENCY_KEY_PATTERN.fullmatch(value):
        raise MachineUploadError(
            "invalid_idempotency_key",
            "Idempotency-Key must contain 1-128 printable ASCII characters.",
            400,
        )
    return value


def _load_config():
    config_path = current_app.config["PATHS"]["data"] / "config.json"
    try:
        with config_path.open("r", encoding="utf-8") as config_file:
            return json.load(config_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise MachineUploadError(
            "configuration_error",
            "FireShare configuration could not be read.",
            500,
        ) from exc


def _parse_optional_positive_int(raw_value, field_name):
    if raw_value is None or raw_value == "":
        return None
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise MachineUploadError(
            "invalid_metadata",
            f"{field_name} must be a positive integer.",
            400,
        ) from exc
    if value <= 0:
        raise MachineUploadError(
            "invalid_metadata",
            f"{field_name} must be a positive integer.",
            400,
        )
    return value


def _parse_tag_ids(raw_value):
    if raw_value is None or raw_value.strip() == "":
        return ()
    values = []
    for item in raw_value.split(","):
        item = item.strip()
        if not item.isdigit() or int(item) <= 0:
            raise MachineUploadError(
                "invalid_metadata",
                "tag_ids must be comma-separated positive integers.",
                400,
            )
        values.append(int(item))
    return tuple(sorted(set(values)))


def _parse_private(raw_value):
    if raw_value is None or raw_value == "":
        return None
    if raw_value == "true":
        return True
    if raw_value == "false":
        return False
    raise MachineUploadError(
        "invalid_metadata",
        "private must be exactly true or false.",
        400,
    )


def parse_upload_metadata(file_storage, form):
    raw_filename = file_storage.filename or ""
    filename = util.secure_filename(raw_filename).strip(".")
    if not filename:
        raise MachineUploadError("invalid_file", "A filename is required.", 400)

    suffix = Path(filename).suffix.lower()
    extension = suffix[1:] if suffix.startswith(".") else ""
    if extension not in SUPPORTED_FILE_TYPES:
        raise MachineUploadError(
            "unsupported_file_type",
            "The uploaded file type is not supported.",
            415,
        )

    raw_title = form.get("title")
    if raw_title is not None:
        raw_title = raw_title.strip() or None
    if raw_title and len(raw_title) > 256:
        raise MachineUploadError("invalid_metadata", "title must be 256 characters or fewer.", 400)

    raw_folder = form.get("folder")
    if raw_folder is not None:
        raw_folder = raw_folder.strip() or None
    if raw_folder and not FOLDER_PATTERN.fullmatch(raw_folder):
        raise MachineUploadError(
            "invalid_metadata",
            "folder may contain only letters, numbers, underscores, and hyphens.",
            400,
        )

    game_id = _parse_optional_positive_int(form.get("game_id"), "game_id")
    tag_ids = _parse_tag_ids(form.get("tag_ids"))
    raw_private = _parse_private(form.get("private"))

    if game_id is not None and db.session.get(GameMetadata, game_id) is None:
        raise MachineUploadError("unknown_game", "The requested game does not exist.", 422)
    if tag_ids:
        found_ids = {
            row[0]
            for row in db.session.query(CustomTag.id).filter(CustomTag.id.in_(tag_ids)).all()
        }
        if found_ids != set(tag_ids):
            raise MachineUploadError("unknown_tag", "One or more requested tags do not exist.", 422)

    config = _load_config()
    app_config = config.get("app_config", {})
    default_folder = app_config.get("admin_upload_folder_name", "uploads")
    default_private = bool(app_config.get("video_defaults", {}).get("private", True))

    return UploadMetadata(
        original_filename=filename,
        extension=extension,
        raw_title=raw_title,
        raw_folder=raw_folder,
        game_id=game_id,
        tag_ids=tag_ids,
        raw_private=raw_private,
        default_folder=default_folder,
        default_private=default_private,
    ), config


def _resolved_within(root, path):
    root = Path(root).resolve()
    path = Path(path).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise MachineUploadError("invalid_path", "The upload path is invalid.", 400) from exc
    return path


def _safe_unlink(path):
    if not path:
        return
    try:
        resolved = _resolved_within(current_app.config["PATHS"]["video"], path)
    except MachineUploadError:
        logger.error("Refused to delete a machine upload path outside VIDEO_DIRECTORY")
        return
    try:
        resolved.unlink()
    except FileNotFoundError:
        pass
    except OSError as exc:
        logger.warning(f"Could not remove machine upload file {resolved}: {exc}")


def _marker_path(source_path):
    return Path(f"{source_path}{MARKER_SUFFIX}")


def _stage_file(file_storage, folder):
    video_root = current_app.config["PATHS"]["video"].resolve()
    destination = _resolved_within(video_root, video_root / folder)
    destination.mkdir(parents=True, exist_ok=True)
    staging = destination / f".fireshare-{uuid.uuid4().hex}{STAGING_SUFFIX}"
    max_bytes = current_app.config["MACHINE_UPLOAD_MAX_MB"] * 1024 * 1024
    digest = hashlib.sha256()
    total = 0
    owned_temp = getattr(file_storage.stream, "_fireshare_upload_path", None)

    try:
        if owned_temp is not None:
            owned_temp = _resolved_within(video_root, owned_temp)
            file_storage.stream.seek(0)
            while True:
                chunk = file_storage.stream.read(COPY_CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise MachineUploadError(
                        "upload_too_large",
                        f"The uploaded file exceeds the {current_app.config['MACHINE_UPLOAD_MAX_MB']} MiB limit.",
                        413,
                    )
                digest.update(chunk)
            file_storage.stream.flush()
            os.fsync(file_storage.stream.fileno())
            file_storage.stream.close()
            os.replace(owned_temp, staging)
        else:
            with staging.open("xb") as output:
                while True:
                    chunk = file_storage.stream.read(COPY_CHUNK_SIZE)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise MachineUploadError(
                            "upload_too_large",
                            f"The uploaded file exceeds the {current_app.config['MACHINE_UPLOAD_MAX_MB']} MiB limit.",
                            413,
                        )
                    output.write(chunk)
                    digest.update(chunk)
                output.flush()
                os.fsync(output.fileno())
    except MachineUploadError:
        try:
            file_storage.stream.close()
        except OSError:
            pass
        _safe_unlink(owned_temp)
        _safe_unlink(staging)
        raise
    except OSError as exc:
        try:
            file_storage.stream.close()
        except OSError:
            pass
        _safe_unlink(owned_temp)
        _safe_unlink(staging)
        if exc.errno in (errno.ENOSPC, getattr(errno, "EDQUOT", errno.ENOSPC)):
            raise MachineUploadError(
                "insufficient_storage",
                "FireShare does not have enough storage for this upload.",
                507,
            ) from exc
        raise MachineUploadError(
            "storage_error",
            "FireShare could not store the uploaded file.",
            500,
        ) from exc

    if total == 0:
        _safe_unlink(staging)
        raise MachineUploadError("empty_file", "The uploaded file is empty.", 400)
    return staging, digest.hexdigest()


def _hash_file(path):
    digest = hashlib.sha256()
    try:
        with Path(path).open("rb") as source:
            while True:
                chunk = source.read(COPY_CHUNK_SIZE)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError as exc:
        raise MachineUploadError(
            "existing_video_unavailable",
            "The existing FireShare video file is unavailable.",
            409,
        ) from exc
    return digest.hexdigest()


def _request_fingerprint(content_sha256, metadata):
    canonical = {
        "content_sha256": content_sha256,
        "filename": metadata.original_filename,
        "title": metadata.raw_title,
        "folder": metadata.raw_folder,
        "game_id": metadata.game_id,
        "tag_ids": list(metadata.tag_ids),
        "private": metadata.raw_private,
    }
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _actual_folder(source_path):
    parts = Path(source_path).parts
    return parts[0] if len(parts) > 1 else None


def _add_requested_links(video_id, game_id, tag_ids):
    if game_id is not None and not VideoGameLink.query.filter_by(
        video_id=video_id, game_id=game_id
    ).first():
        db.session.add(
            VideoGameLink(video_id=video_id, game_id=game_id, created_at=datetime.utcnow())
        )
    for tag_id in tag_ids:
        if not VideoTagLink.query.filter_by(video_id=video_id, tag_id=tag_id).first():
            db.session.add(
                VideoTagLink(video_id=video_id, tag_id=tag_id, created_at=datetime.utcnow())
            )


def _apply_job_metadata(video, job):
    info = video.info or VideoInfo.query.filter_by(video_id=video.video_id).first()
    if info is None:
        return False
    info.title = job.title
    info.private = job.private
    _add_requested_links(video.video_id, job.game_id, job.tag_ids)
    return True


def _video_ready(job):
    video = Video.query.filter_by(video_id=job.video_id, available=True).first()
    if video is None or not _video_record_ready(video):
        return None
    return video


def _video_record_ready(video):
    if not video.available or video.info is None:
        return False
    link_path = (
        current_app.config["PATHS"]["processed"]
        / "video_links"
        / f"{video.video_id}{video.extension}"
    )
    return link_path.exists()


def _remove_marker(job):
    if not job.source_path:
        return
    source = current_app.config["PATHS"]["video"] / job.source_path
    _safe_unlink(_marker_path(source))


def _cleanup_failed_source(job):
    if (
        not job.source_path
        or job.error_code == "video_removed"
        or Video.query.filter_by(video_id=job.video_id).first() is not None
    ):
        _remove_marker(job)
        return
    source = current_app.config["PATHS"]["video"] / job.source_path
    _safe_unlink(source)
    _safe_unlink(_marker_path(source))


def _scanner_process_alive(job):
    if not job.scan_pid:
        return False
    command_path = Path("/proc") / str(job.scan_pid) / "cmdline"
    try:
        command = command_path.read_bytes()
    except OSError:
        return False
    expected_argument = f"--machine-job-id={job.job_id}".encode("ascii")
    return expected_argument in command.split(b"\0")


def reconcile_job(job):
    video = _video_ready(job)
    if video is not None:
        if job.status != "ready":
            _apply_job_metadata(video, job)
            job.status = "ready"
            job.scan_pid = None
            job.error_code = None
            job.error_message = None
            job.updated_at = datetime.utcnow()
            db.session.commit()
        _remove_marker(job)
        return job

    if (
        job.status == "ready"
        and Video.query.filter_by(video_id=job.video_id).first() is None
    ):
        job.status = "failed"
        job.scan_pid = None
        job.error_code = "video_removed"
        job.error_message = "The published video was removed from FireShare."
        job.updated_at = datetime.utcnow()
        db.session.commit()
        return job

    if job.status == "ready":
        _remove_marker(job)
        return job

    if job.status == "failed":
        _cleanup_failed_source(job)
        return job

    if job.status in ("accepted", "processing"):
        reference_time = job.updated_at or job.created_at
        timeout = current_app.config["MACHINE_UPLOAD_INGEST_TIMEOUT_SECONDS"]
        if reference_time and datetime.utcnow() - reference_time > timedelta(seconds=timeout):
            if _scanner_process_alive(job):
                return job
            job.status = "failed"
            job.scan_pid = None
            job.error_code = "ingest_timeout"
            job.error_message = "The scanner did not make the video ready before the timeout."
            job.updated_at = datetime.utcnow()
            _cleanup_failed_source(job)
            db.session.commit()
    return job


def reconcile_pending_jobs():
    jobs = MachineUploadJob.query.filter(
        MachineUploadJob.status.in_(("accepted", "processing"))
    ).all()
    for job in jobs:
        reconcile_job(job)
    return len(jobs)


def machine_upload_blocks_scan(source_path):
    marker = _marker_path(source_path)
    if not marker.exists():
        return False
    try:
        job_id = marker.read_text(encoding="ascii").strip()
    except OSError as exc:
        logger.warning(f"Could not inspect machine upload marker {marker}: {exc}")
        return not _remove_stale_marker(marker)
    if not re.fullmatch(r"[0-9a-f]{32}", job_id):
        logger.warning(f"Machine upload marker is invalid: {marker}")
        return not _remove_stale_marker(marker)

    job = MachineUploadJob.query.filter_by(job_id=job_id).first()
    if job is None:
        _safe_unlink(marker)
        return False
    return reconcile_job(job).status not in ("ready",)


def _remove_stale_marker(marker):
    timeout = current_app.config["MACHINE_UPLOAD_INGEST_TIMEOUT_SECONDS"]
    try:
        if time.time() - marker.stat().st_mtime <= timeout:
            return False
    except OSError:
        return False
    _safe_unlink(marker)
    return not marker.exists()


def mark_job_ready(job_id):
    job = MachineUploadJob.query.filter_by(job_id=job_id).first()
    if job is None:
        return False
    return reconcile_job(job).status == "ready"


def finalize_job_after_scan(job_id, return_code, attempt_count):
    for attempt in range(3):
        try:
            job = MachineUploadJob.query.filter_by(job_id=job_id).first()
            if job is None or job.attempt_count != attempt_count:
                return
            if mark_job_ready(job_id):
                return
            job = MachineUploadJob.query.filter_by(job_id=job_id).first()
            if (
                job is None
                or job.attempt_count != attempt_count
                or job.status not in ("accepted", "processing")
            ):
                return
            job.status = "failed"
            job.scan_pid = None
            job.error_code = "scan_failed" if return_code else "scan_incomplete"
            job.error_message = (
                f"The scanner exited with status {return_code}."
                if return_code
                else "The scanner completed without making the video ready."
            )
            job.updated_at = datetime.utcnow()
            _cleanup_failed_source(job)
            db.session.commit()
            return
        except OperationalError as exc:
            db.session.rollback()
            if attempt == 2:
                logger.error(f"Could not persist machine upload completion for {job_id}: {exc}")
                return
            time.sleep(0.1 * (attempt + 1))


def _create_receipt(idempotency_key, job):
    receipt = MachineUploadRequest(idempotency_key=idempotency_key, job=job)
    db.session.add(receipt)
    return receipt


def _find_job_by_video_id(video_id):
    return MachineUploadJob.query.filter_by(video_id=video_id).first()


def _assert_matching_job(job, content_sha256, request_fingerprint, key_conflict=False):
    if job.content_sha256 != content_sha256:
        raise MachineUploadError(
            "idempotency_conflict" if key_conflict else "video_id_collision",
            (
                "The idempotency key was already used for a different request."
                if key_conflict
                else "Another file has the same FireShare video ID."
            ),
            409,
        )
    if job.request_fingerprint != request_fingerprint:
        raise MachineUploadError(
            "idempotency_conflict" if key_conflict else "content_metadata_conflict",
            (
                "The idempotency key was already used for a different request."
                if key_conflict
                else "This video already exists with different publication metadata."
            ),
            409,
        )


def _create_ready_job_for_video(
    video,
    metadata,
    content_sha256,
    request_fingerprint,
    idempotency_key,
):
    actual_folder = _actual_folder(video.path)
    if metadata.raw_folder is not None and metadata.raw_folder != actual_folder:
        raise MachineUploadError(
            "folder_conflict",
            "The existing video is stored in a different folder.",
            409,
        )
    if not _video_record_ready(video):
        raise MachineUploadError(
            "existing_video_incomplete",
            "The existing video is not ready for sharing.",
            409,
        )

    title = metadata.raw_title or video.info.title or Path(video.path).stem
    private = video.info.private if metadata.raw_private is None else metadata.raw_private
    if metadata.raw_title is not None:
        video.info.title = title
    if metadata.raw_private is not None:
        video.info.private = private
    _add_requested_links(video.video_id, metadata.game_id, metadata.tag_ids)

    job = MachineUploadJob(
        job_id=uuid.uuid4().hex,
        video_id=video.video_id,
        content_sha256=content_sha256,
        request_fingerprint=request_fingerprint,
        source_path=video.path,
        status="ready",
        title=title,
        folder=actual_folder,
        game_id=metadata.game_id,
        tag_ids_json=json.dumps(list(metadata.tag_ids), separators=(",", ":")),
        private=private,
        deduplicated=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(job)
    _create_receipt(idempotency_key, job)
    db.session.commit()
    return UploadResult(job=job, status_code=200, deduplicated=True)


def _final_path(job, metadata):
    video_root = current_app.config["PATHS"]["video"].resolve()
    folder_path = _resolved_within(video_root, video_root / job.folder)
    stem = Path(metadata.original_filename).stem.strip("._-") or "upload"
    stem = util.secure_filename(stem)[:180].strip("._-") or "upload"
    final_path = folder_path / f"{stem}-{job.job_id[:12]}.{metadata.extension}"
    return _resolved_within(video_root, final_path)


def _start_job(job, staging, config, metadata, requeue=False):
    final_path = _resolved_within(
        current_app.config["PATHS"]["video"],
        current_app.config["PATHS"]["video"] / job.source_path,
    )
    marker = _marker_path(final_path)

    if requeue:
        expected_attempt = job.attempt_count
        claimed = MachineUploadJob.query.filter_by(
            id=job.id,
            status="failed",
            attempt_count=expected_attempt,
        ).update(
            {
                "status": "accepted",
                "scan_pid": None,
                "attempt_count": expected_attempt + 1,
                "error_code": None,
                "error_message": None,
                "updated_at": datetime.utcnow(),
            },
            synchronize_session=False,
        )
        db.session.commit()
        db.session.refresh(job)
        if not claimed:
            _safe_unlink(staging)
            if job.status == "failed":
                raise MachineUploadError(
                    job.error_code or "scan_failed",
                    job.error_message or "The video scanner failed.",
                    500,
                    job=job,
                )
            return UploadResult(
                job=job,
                status_code=200 if job.status == "ready" else 202,
                deduplicated=True,
            )

    marker_created = False
    try:
        marker_fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        marker_created = True
        try:
            marker_content = job.job_id.encode("ascii")
            if os.write(marker_fd, marker_content) != len(marker_content):
                raise OSError(errno.EIO, "Could not write the machine upload marker")
            os.fsync(marker_fd)
        finally:
            os.close(marker_fd)
        os.replace(staging, final_path)
    except OSError as exc:
        _safe_unlink(staging)
        if marker_created:
            _safe_unlink(marker)
        job.status = "failed"
        job.error_code = "storage_error"
        job.error_message = "FireShare could not finalize the uploaded file."
        job.updated_at = datetime.utcnow()
        db.session.commit()
        raise MachineUploadError(
            "storage_error",
            "FireShare could not finalize the uploaded file.",
            500,
            job=job,
        ) from exc

    try:
        from .api.upload import _launch_scan_video

        process = _launch_scan_video(
            Path(job.source_path),
            config,
            tag_ids=list(job.tag_ids),
            game_id=job.game_id,
            title=job.title,
            private=job.private,
            machine_job_id=job.job_id,
            machine_attempt=job.attempt_count,
        )
    except OSError as exc:
        job.status = "failed"
        job.error_code = "scanner_unavailable"
        job.error_message = "FireShare could not start the video scanner."
        job.updated_at = datetime.utcnow()
        _cleanup_failed_source(job)
        db.session.commit()
        raise MachineUploadError(
            "scanner_unavailable",
            "FireShare could not start the video scanner.",
            500,
            job=job,
        ) from exc

    MachineUploadJob.query.filter_by(id=job.id, status="accepted").update(
        {
            "status": "processing",
            "scan_pid": process.pid,
            "updated_at": datetime.utcnow(),
        },
        synchronize_session=False,
    )
    db.session.commit()
    db.session.refresh(job)
    if job.status == "ready":
        return UploadResult(job=job, status_code=200, deduplicated=False)
    if job.status == "failed":
        raise MachineUploadError(
            job.error_code or "scan_failed",
            job.error_message or "The video scanner failed.",
            500,
            job=job,
        )
    return UploadResult(job=job, status_code=202, deduplicated=False)


def _reuse_job(job, staging, config, metadata):
    job = reconcile_job(job)
    if job.status == "failed":
        return _start_job(job, staging, config, metadata, requeue=True)
    _safe_unlink(staging)
    return UploadResult(
        job=job,
        status_code=200 if job.status == "ready" else 202,
        deduplicated=True,
    )


def _resolve_race(
    idempotency_key,
    video_id,
    content_sha256,
    request_fingerprint,
    staging,
    config,
    metadata,
):
    receipt = MachineUploadRequest.query.filter_by(idempotency_key=idempotency_key).first()
    if receipt is not None:
        _assert_matching_job(receipt.job, content_sha256, request_fingerprint, key_conflict=True)
        return _reuse_job(receipt.job, staging, config, metadata)

    job = _find_job_by_video_id(video_id)
    if job is None:
        raise MachineUploadError(
            "concurrent_upload_error",
            "The concurrent upload could not be resolved.",
            500,
        )
    _assert_matching_job(job, content_sha256, request_fingerprint)
    _create_receipt(idempotency_key, job)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        receipt = MachineUploadRequest.query.filter_by(idempotency_key=idempotency_key).first()
        if receipt is None:
            raise MachineUploadError(
                "concurrent_upload_error",
                "The concurrent upload could not be resolved.",
                500,
            )
        _assert_matching_job(receipt.job, content_sha256, request_fingerprint, key_conflict=True)
        job = receipt.job
    return _reuse_job(job, staging, config, metadata)


def create_upload(file_storage, idempotency_key, form):
    idempotency_key = validate_idempotency_key(idempotency_key)
    metadata, config = parse_upload_metadata(file_storage, form)
    staging, content_sha256 = _stage_file(file_storage, metadata.new_folder)

    try:
        video_id = util.video_id(staging)
        request_fingerprint = _request_fingerprint(content_sha256, metadata)

        receipt = MachineUploadRequest.query.filter_by(
            idempotency_key=idempotency_key
        ).first()
        if receipt is not None:
            _assert_matching_job(
                receipt.job,
                content_sha256,
                request_fingerprint,
                key_conflict=True,
            )
            return _reuse_job(receipt.job, staging, config, metadata)

        job = _find_job_by_video_id(video_id)
        if job is not None:
            _assert_matching_job(job, content_sha256, request_fingerprint)
            _create_receipt(idempotency_key, job)
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                return _resolve_race(
                    idempotency_key,
                    video_id,
                    content_sha256,
                    request_fingerprint,
                    staging,
                    config,
                    metadata,
                )
            return _reuse_job(job, staging, config, metadata)

        video = Video.query.filter_by(video_id=video_id).first()
        if video is not None:
            video_root = current_app.config["PATHS"]["video"].resolve()
            try:
                source_path = _resolved_within(video_root, video_root / video.path)
            except MachineUploadError as exc:
                raise MachineUploadError(
                    "existing_video_unavailable",
                    "The existing FireShare video file is unavailable.",
                    409,
                ) from exc
            if _hash_file(source_path) != content_sha256:
                raise MachineUploadError(
                    "video_id_collision",
                    "Another file has the same FireShare video ID.",
                    409,
                )
            try:
                result = _create_ready_job_for_video(
                    video,
                    metadata,
                    content_sha256,
                    request_fingerprint,
                    idempotency_key,
                )
            except IntegrityError:
                db.session.rollback()
                return _resolve_race(
                    idempotency_key,
                    video_id,
                    content_sha256,
                    request_fingerprint,
                    staging,
                    config,
                    metadata,
                )
            _safe_unlink(staging)
            return result

        job = MachineUploadJob(
            job_id=uuid.uuid4().hex,
            video_id=video_id,
            content_sha256=content_sha256,
            request_fingerprint=request_fingerprint,
            status="accepted",
            title=metadata.new_title,
            folder=metadata.new_folder,
            game_id=metadata.game_id,
            tag_ids_json=json.dumps(list(metadata.tag_ids), separators=(",", ":")),
            private=metadata.new_private,
            deduplicated=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        final_path = _final_path(job, metadata)
        video_root = current_app.config["PATHS"]["video"].resolve()
        job.source_path = str(final_path.relative_to(video_root))
        db.session.add(job)
        _create_receipt(idempotency_key, job)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return _resolve_race(
                idempotency_key,
                video_id,
                content_sha256,
                request_fingerprint,
                staging,
                config,
                metadata,
            )
        return _start_job(job, staging, config, metadata)
    except Exception:
        if staging.exists():
            _safe_unlink(staging)
        raise
