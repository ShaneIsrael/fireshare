import errno
import hmac
import json
import os
import re
from datetime import timezone
from functools import wraps
from pathlib import Path

from flask import current_app, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

from .. import logger, util
from ..machine_upload import (
    MachineUploadError,
    create_upload,
    get_default_upload_folder,
    is_valid_upload_folder_name,
    reconcile_job,
    validate_idempotency_key,
)
from ..models import MachineUploadJob
from . import api


JOB_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
MULTIPART_OVERHEAD_BYTES = 8 * 1024 * 1024
INTERNAL_FOLDER_NAMES = frozenset({"derived", "image_links", "video_links"})


def _json_response(payload, status_code, headers=None):
    response = jsonify(payload)
    response.status_code = status_code
    response.headers["Cache-Control"] = "no-store"
    for name, value in (headers or {}).items():
        response.headers[name] = value
    return response


def _error_response(code, message, status_code, job=None):
    payload = {"error": {"code": code, "message": message}}
    if job is not None:
        payload["job"] = _serialize_job(job)
    headers = {"WWW-Authenticate": "Bearer"} if status_code == 401 else None
    return _json_response(payload, status_code, headers)


def machine_token_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        configured = current_app.config.get("MACHINE_API_TOKEN")
        if not configured:
            return _error_response(
                "machine_api_disabled",
                "The machine publishing API is not configured.",
                503,
            )

        authorization = request.headers.get("Authorization", "")
        parts = authorization.split()
        valid_shape = len(parts) == 2 and parts[0].lower() == "bearer"
        supplied = parts[1] if valid_shape else ""
        authorized = valid_shape and hmac.compare_digest(
            configured.encode("utf-8"),
            supplied.encode("utf-8"),
        )
        if not authorized:
            logger.warning(
                f"{request.remote_addr or '-'} {request.method} {request.path} 401"
            )
            return _error_response("unauthorized", "Unauthorized.", 401)
        return func(*args, **kwargs)

    return decorated


def _load_config():
    config_path = current_app.config["PATHS"]["data"] / "config.json"
    try:
        with config_path.open("r", encoding="utf-8") as config_file:
            return json.load(config_file)
    except (OSError, json.JSONDecodeError):
        return {}


def _request_origin():
    configured_domain = current_app.config.get("DOMAIN")
    if configured_domain:
        return configured_domain, None
    forwarded = request.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower()
    scheme = forwarded if forwarded in ("http", "https") else request.scheme
    return request.host, scheme


def _isoformat(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize_job(job, deduplicated=None):
    host, scheme = _request_origin()
    path = f"/w/{job.video_id}"
    error = None
    if job.error_code:
        error = {"code": job.error_code, "message": job.error_message}
    return {
        "job_id": job.job_id,
        "video_id": job.video_id,
        "public_url": util.public_watch_url(
            job.video_id,
            _load_config(),
            host=host,
            scheme=scheme,
        ),
        "path": path,
        "status": job.status,
        "private": job.private,
        "title": job.title,
        "deduplicated": job.deduplicated if deduplicated is None else deduplicated,
        "created_at": _isoformat(job.created_at),
        "updated_at": _isoformat(job.updated_at),
        "error": error,
    }


def _cleanup_request_upload_streams():
    for stream in getattr(request, "_fireshare_upload_streams", ()):
        path = getattr(stream, "_fireshare_upload_path", None)
        try:
            stream.close()
        except OSError:
            pass
        if path is not None:
            try:
                Path(path).unlink()
            except FileNotFoundError:
                pass
            except OSError as exc:
                logger.warning(f"Could not remove a machine upload request file: {exc}")


@api.route("/api/v1/folders", methods=["GET"])
@machine_token_required
def get_machine_upload_folders():
    try:
        default_folder = get_default_upload_folder()
        video_root = current_app.config["PATHS"]["video"].resolve()
        try:
            entries = os.scandir(video_root)
        except FileNotFoundError:
            return _json_response(
                {
                    "default_folder": default_folder,
                    "folders": [],
                },
                200,
            )

        folders = []
        with entries:
            for entry in entries:
                name = entry.name
                if (
                    name.startswith(".")
                    or name.casefold() in INTERNAL_FOLDER_NAMES
                    or not is_valid_upload_folder_name(name)
                    or not entry.is_dir()
                ):
                    continue
                try:
                    Path(entry.path).resolve().relative_to(video_root)
                except (OSError, ValueError):
                    continue
                folders.append(name)
    except MachineUploadError as exc:
        return _error_response(exc.code, exc.message, exc.status_code)
    except OSError:
        logger.exception("Could not enumerate machine upload folders")
        return _error_response(
            "storage_error",
            "FireShare could not list upload folders.",
            500,
        )

    folders.sort(key=lambda name: (name.casefold(), name))
    return _json_response(
        {
            "default_folder": default_folder,
            "folders": folders,
        },
        200,
    )


@api.route("/api/v1/uploads", methods=["POST"])
@machine_token_required
def create_machine_upload():
    max_request_bytes = (
        current_app.config["MACHINE_UPLOAD_MAX_MB"] * 1024 * 1024
        + MULTIPART_OVERHEAD_BYTES
    )
    request.max_content_length = max_request_bytes
    if request.content_length is not None and request.content_length > max_request_bytes:
        return _error_response(
            "upload_too_large",
            f"The upload exceeds the {current_app.config['MACHINE_UPLOAD_MAX_MB']} MiB limit.",
            413,
        )

    try:
        idempotency_key = validate_idempotency_key(
            request.headers.get("Idempotency-Key")
        )
    except MachineUploadError as exc:
        return _error_response(exc.code, exc.message, exc.status_code)

    try:
        if "file" not in request.files:
            return _error_response("missing_file", "A file field is required.", 400)
        result = create_upload(request.files["file"], idempotency_key, request.form)
    except RequestEntityTooLarge:
        return _error_response(
            "upload_too_large",
            f"The upload exceeds the {current_app.config['MACHINE_UPLOAD_MAX_MB']} MiB limit.",
            413,
        )
    except MachineUploadError as exc:
        return _error_response(
            exc.code,
            exc.message,
            exc.status_code,
            job=exc.job,
        )
    except OSError as exc:
        logger.error("Machine upload request storage failure")
        if exc.errno in (errno.ENOSPC, getattr(errno, "EDQUOT", errno.ENOSPC)):
            return _error_response(
                "insufficient_storage",
                "FireShare does not have enough storage for this upload.",
                507,
            )
        return _error_response(
            "storage_error",
            "FireShare could not store the uploaded file.",
            500,
        )
    except Exception:
        logger.exception("Unexpected machine upload failure")
        return _error_response(
            "internal_error",
            "FireShare could not process the upload.",
            500,
        )
    finally:
        _cleanup_request_upload_streams()

    headers = None
    if result.status_code == 202:
        headers = {
            "Location": f"/api/v1/uploads/{result.job.job_id}",
            "Retry-After": "2",
        }
    return _json_response(
        _serialize_job(result.job, deduplicated=result.deduplicated),
        result.status_code,
        headers,
    )


@api.route("/api/v1/uploads/<job_id>", methods=["GET"])
@machine_token_required
def get_machine_upload(job_id):
    if not JOB_ID_PATTERN.fullmatch(job_id):
        return _error_response("not_found", "Upload job not found.", 404)
    job = MachineUploadJob.query.filter_by(job_id=job_id).first()
    if job is None:
        return _error_response("not_found", "Upload job not found.", 404)
    job = reconcile_job(job)
    return _json_response(_serialize_job(job), 200)
