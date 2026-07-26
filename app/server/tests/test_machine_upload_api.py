import io
import errno
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fireshare import FireshareRequest, db
from fireshare.models import CustomTag, GameMetadata, MachineUploadJob, Video, VideoInfo

from .helpers import MachineApiTestCase


class MachineUploadApiTests(MachineApiTestCase):
    def _post(self, content=b"video-content", filename="clip.mp4", headers=None, **fields):
        data = {"file": (io.BytesIO(content), filename), **fields}
        return self.client.post(
            "/api/v1/uploads",
            data=data,
            headers=headers or self.auth_headers,
            content_type="multipart/form-data",
        )

    def test_authentication_and_disabled_api(self):
        response = self.client.post("/api/v1/uploads")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["WWW-Authenticate"], "Bearer")

        response = self.client.post(
            "/api/v1/uploads",
            headers={"Authorization": "Bearer wrong", "Idempotency-Key": "key"},
        )
        self.assertEqual(response.status_code, 401)

        self.app.config["MACHINE_API_TOKEN"] = None
        response = self.client.post("/api/v1/uploads")
        self.assertEqual(response.status_code, 503)

    def test_idempotency_key_is_validated_before_file(self):
        response = self.client.post(
            "/api/v1/uploads",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"]["code"], "invalid_idempotency_key")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_new_upload_returns_processing_contract(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        with self.app.app_context():
            db.session.add_all(
                [
                    GameMetadata(id=42, name="Game"),
                    CustomTag(id=3, name="Highlight"),
                    CustomTag(id=8, name="Victory"),
                ]
            )
            db.session.commit()
        response = self._post(
            private="false",
            title="Round win",
            folder="vice",
            game_id="42",
            tag_ids="8,3,3",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.headers["Retry-After"], "2")
        self.assertRegex(response.headers["Location"], r"^/api/v1/uploads/[0-9a-f]{32}$")
        self.assertEqual(response.json["status"], "processing")
        self.assertFalse(response.json["private"])
        self.assertEqual(response.json["title"], "Round win")
        self.assertEqual(response.json["path"], f"/w/{response.json['video_id']}")
        self.assertTrue(response.json["public_url"].startswith("http://localhost/w/"))
        self.assertFalse(response.json["deduplicated"])

        kwargs = launch.call_args.kwargs
        self.assertFalse(kwargs["private"])
        self.assertEqual(kwargs["game_id"], 42)
        self.assertEqual(kwargs["tag_ids"], [3, 8])
        self.assertRegex(kwargs["machine_job_id"], r"^[0-9a-f]{32}$")
        self.assertFalse(list((self.video_dir / ".fireshare-upload-tmp").iterdir()))

    @patch("fireshare.api.upload._launch_scan_video")
    def test_same_key_same_payload_reuses_job(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self._post()
        second = self._post()

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.json["job_id"], second.json["job_id"])
        self.assertTrue(second.json["deduplicated"])
        self.assertEqual(launch.call_count, 1)

    @patch("fireshare.api.upload._launch_scan_video")
    def test_same_key_changed_content_conflicts(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        self.assertEqual(self._post(content=b"one").status_code, 202)
        response = self._post(content=b"two")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"]["code"], "idempotency_conflict")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_same_content_new_key_reuses_job(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self._post()
        headers = dict(self.auth_headers)
        headers["Idempotency-Key"] = "publish-attempt-2"
        second = self._post(headers=headers)

        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.json["job_id"], second.json["job_id"])
        self.assertEqual(launch.call_count, 1)

    @patch("fireshare.api.upload._launch_scan_video")
    def test_same_content_changed_metadata_conflicts(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        self.assertEqual(self._post(title="One").status_code, 202)
        headers = dict(self.auth_headers)
        headers["Idempotency-Key"] = "publish-attempt-2"
        response = self._post(headers=headers, title="Two")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"]["code"], "content_metadata_conflict")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_actual_file_size_limit_and_cleanup(self, launch):
        self.app.config["MACHINE_UPLOAD_MAX_MB"] = 1
        response = self._post(content=b"x" * (1024 * 1024 + 1))

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json["error"]["code"], "upload_too_large")
        self.assertFalse(list(self.video_dir.rglob("*.machine-upload")))
        launch.assert_not_called()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_request_envelope_limit_rejects_before_form_parsing(self, launch):
        self.app.config["MACHINE_UPLOAD_MAX_MB"] = 1
        response = self._post(content=b"x" * (9 * 1024 * 1024))

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json["error"]["code"], "upload_too_large")
        temp_dir = self.video_dir / ".fireshare-upload-tmp"
        self.assertFalse(temp_dir.exists())
        launch.assert_not_called()

    @patch.object(
        FireshareRequest,
        "_get_file_stream",
        side_effect=OSError(errno.ENOSPC, "disk full"),
    )
    def test_multipart_spool_disk_full_returns_507(self, _stream):
        response = self._post()

        self.assertEqual(response.status_code, 507)
        self.assertEqual(response.json["error"]["code"], "insufficient_storage")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_empty_unsupported_and_malformed_uploads(self, launch):
        cases = (
            ({"content": b""}, 400, "empty_file"),
            ({"filename": "clip.txt"}, 415, "unsupported_file_type"),
            ({"private": "False"}, 400, "invalid_metadata"),
            ({"folder": "../escape"}, 400, "invalid_metadata"),
        )
        for kwargs, status_code, error_code in cases:
            with self.subTest(error_code=error_code):
                response = self._post(**kwargs)
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(response.json["error"]["code"], error_code)
        launch.assert_not_called()

    def test_invalid_token_is_not_logged(self):
        bad_token = "wrong-" + ("x" * 64)
        headers = dict(self.auth_headers)
        headers["Authorization"] = "Bearer " + bad_token
        with patch("fireshare.api.machine.logger.warning") as warning:
            response = self._post(headers=headers)

        self.assertEqual(response.status_code, 401)
        self.assertNotIn(bad_token, repr(warning.call_args_list))

    @patch("fireshare.api.upload._launch_scan_video")
    def test_public_url_uses_forwarded_https_origin(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        headers = dict(self.auth_headers)
        headers.update(
            {
                "Host": "clips.example.com",
                "X-Forwarded-Proto": "https",
            }
        )

        response = self._post(headers=headers)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(
            response.json["public_url"],
            f"https://clips.example.com/w/{response.json['video_id']}",
        )

    @patch("fireshare.api.upload._launch_scan_video")
    def test_status_reconciles_ready_video(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        response = self._post(private="false")
        job_id = response.json["job_id"]
        video_id = response.json["video_id"]

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=job_id).one()
            video = Video(
                video_id=video_id,
                extension=".mp4",
                path=job.source_path,
                available=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            info = VideoInfo(video_id=video_id, title="clip", private=True)
            db.session.add_all([video, info])
            db.session.commit()
            link = self.processed_dir / "video_links" / f"{video_id}.mp4"
            link.write_bytes(b"video")

        status = self.client.get(
            f"/api/v1/uploads/{job_id}",
            headers=self.auth_headers,
        )
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json["status"], "ready")
        self.assertFalse(status.json["private"])

        with self.app.app_context():
            info = VideoInfo.query.filter_by(video_id=video_id).one()
            info.title = "User renamed"
            info.private = True
            db.session.commit()

        status = self.client.get(
            f"/api/v1/uploads/{job_id}",
            headers=self.auth_headers,
        )
        self.assertEqual(status.status_code, 200)
        with self.app.app_context():
            info = VideoInfo.query.filter_by(video_id=video_id).one()
            self.assertEqual(info.title, "User renamed")
            self.assertTrue(info.private)

    @patch("fireshare.api.upload._launch_scan_video")
    def test_status_times_out_and_cleans_failed_source(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        response = self._post()
        job_id = response.json["job_id"]

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=job_id).one()
            source = self.video_dir / job.source_path
            self.assertTrue(source.exists())
            job.updated_at = datetime.utcnow() - timedelta(seconds=901)
            db.session.commit()

        status = self.client.get(
            f"/api/v1/uploads/{job_id}",
            headers=self.auth_headers,
        )
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json["status"], "failed")
        self.assertEqual(status.json["error"]["code"], "ingest_timeout")
        self.assertFalse(source.exists())

    @patch("fireshare.api.upload._launch_scan_video")
    def test_scanner_launch_failure_can_be_retried(self, launch):
        launch.side_effect = [
            OSError("scanner unavailable"),
            SimpleNamespace(pid=4321),
        ]

        failed = self._post()
        retried = self._post()

        self.assertEqual(failed.status_code, 500)
        self.assertEqual(failed.json["error"]["code"], "scanner_unavailable")
        self.assertEqual(failed.json["job"]["status"], "failed")
        self.assertEqual(retried.status_code, 202)
        self.assertEqual(retried.json["status"], "processing")
        self.assertEqual(failed.json["job"]["job_id"], retried.json["job_id"])
        with self.app.app_context():
            job = MachineUploadJob.query.one()
            self.assertEqual(job.attempt_count, 2)
            self.assertTrue((self.video_dir / job.source_path).exists())

    def test_unknown_game_and_tag_are_rejected_without_temp_files(self):
        for field, code in (("game_id", "unknown_game"), ("tag_ids", "unknown_tag")):
            with self.subTest(field=field):
                response = self._post(**{field: "999"})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json["error"]["code"], code)
                self.assertFalse(
                    list((self.video_dir / ".fireshare-upload-tmp").iterdir())
                )

    def test_existing_browser_upload_route_is_unchanged(self):
        response = self.client.post("/api/upload")
        self.assertEqual(response.status_code, 401)

    def test_unknown_job(self):
        response = self.client.get(
            "/api/v1/uploads/" + ("0" * 32),
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(response.status_code, 404)
