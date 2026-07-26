import io
import os
import re
import time
import errno
import threading
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from click.testing import CliRunner

from fireshare import _cleanup_stale_machine_staging, _read_machine_api_token, db
from fireshare.cli import cli
from fireshare.machine_upload import (
    finalize_job_after_scan,
    machine_upload_blocks_scan,
    mark_job_ready,
    reconcile_pending_jobs,
)
from fireshare.models import MachineUploadJob, Video, VideoInfo

from .helpers import MachineApiTestCase


class MachineUploadServiceTests(MachineApiTestCase):
    def test_token_generator_stdout_and_file(self):
        runner = CliRunner()
        generated = runner.invoke(cli, ["generate-machine-token"])
        self.assertEqual(generated.exit_code, 0)
        self.assertRegex(generated.output.strip(), r"^[0-9a-f]{64}$")

        with runner.isolated_filesystem():
            target = Path("machine-token")
            written = runner.invoke(
                cli,
                ["generate-machine-token", "--output", str(target)],
            )
            self.assertEqual(written.exit_code, 0)
            self.assertRegex(target.read_text(encoding="ascii"), r"^[0-9a-f]{64}$")
            if os.name != "nt":
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            duplicate = runner.invoke(
                cli,
                ["generate-machine-token", "--output", str(target)],
            )
            self.assertNotEqual(duplicate.exit_code, 0)

    def test_token_file_loading_and_conflict(self):
        token_file = self.root / "token"
        token_file.write_text("b" * 64, encoding="utf-8")
        with patch.dict(
            os.environ,
            {"MACHINE_API_TOKEN_FILE": str(token_file)},
            clear=True,
        ):
            self.assertEqual(_read_machine_api_token(), "b" * 64)

        with patch.dict(
            os.environ,
            {
                "MACHINE_API_TOKEN": "a" * 64,
                "MACHINE_API_TOKEN_FILE": str(token_file),
            },
            clear=True,
        ):
            with self.assertRaises(RuntimeError):
                _read_machine_api_token()

        token_file.write_text("", encoding="utf-8")
        with patch.dict(
            os.environ,
            {"MACHINE_API_TOKEN_FILE": str(token_file)},
            clear=True,
        ):
            with self.assertRaises(RuntimeError):
                _read_machine_api_token()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_preexisting_video_is_deduplicated(self, launch):
        content = b"existing-video"
        source = self.video_dir / "library" / "existing.mp4"
        source.parent.mkdir()
        source.write_bytes(content)

        from fireshare import util

        video_id = util.video_id(source)
        with self.app.app_context():
            video = Video(
                video_id=video_id,
                extension=".mp4",
                path="library/existing.mp4",
                available=True,
            )
            info = VideoInfo(video_id=video_id, title="Existing", private=True)
            db.session.add_all([video, info])
            db.session.commit()
            (self.processed_dir / "video_links" / f"{video_id}.mp4").write_bytes(content)

        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={
                "file": (io.BytesIO(content), "existing.mp4"),
                "title": "Published",
                "private": "false",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["deduplicated"])
        launch.assert_not_called()
        with self.app.app_context():
            job = MachineUploadJob.query.one()
            self.assertEqual(job.status, "ready")
            self.assertFalse(VideoInfo.query.filter_by(video_id=video_id).one().private)

    @patch("fireshare.api.upload._launch_scan_video")
    @patch("fireshare.machine_upload.util.video_id", return_value="f" * 32)
    def test_full_hash_detects_video_id_collision(self, _video_id, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"one"), "clip.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(first.status_code, 202)

        headers = dict(self.auth_headers)
        headers["Idempotency-Key"] = "publish-attempt-2"
        second = self.client.post(
            "/api/v1/uploads",
            headers=headers,
            data={"file": (io.BytesIO(b"two"), "clip.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json["error"]["code"], "video_id_collision")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_same_filename_uses_collision_safe_paths(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"one"), "clip.mp4")},
            content_type="multipart/form-data",
        )
        headers = dict(self.auth_headers)
        headers["Idempotency-Key"] = "publish-attempt-2"
        second = self.client.post(
            "/api/v1/uploads",
            headers=headers,
            data={"file": (io.BytesIO(b"two"), "clip.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        with self.app.app_context():
            paths = [job.source_path for job in MachineUploadJob.query.order_by(MachineUploadJob.id)]
        self.assertEqual(len(set(paths)), 2)
        self.assertTrue(all(re.search(r"clip-[0-9a-f]{12}\.mp4$", path) for path in paths))

    @patch("fireshare.api.upload._launch_scan_video")
    def test_concurrent_identical_uploads_create_one_job_and_file(self, launch):
        from fireshare import machine_upload

        launch.return_value = SimpleNamespace(pid=1234)
        barrier = threading.Barrier(2)
        thread_state = threading.local()
        original_find = machine_upload._find_job_by_video_id
        responses = []
        errors = []

        def synchronized_find(video_id):
            job = original_find(video_id)
            if not getattr(thread_state, "waited", False):
                thread_state.waited = True
                barrier.wait(timeout=5)
            return job

        def publish(key):
            try:
                client = self.app.test_client()
                headers = {
                    "Authorization": "Bearer " + self.token,
                    "Idempotency-Key": key,
                }
                responses.append(
                    client.post(
                        "/api/v1/uploads",
                        headers=headers,
                        data={"file": (io.BytesIO(b"same-video"), "clip.mp4")},
                        content_type="multipart/form-data",
                    )
                )
            except Exception as exc:
                errors.append(exc)

        with patch(
            "fireshare.machine_upload._find_job_by_video_id",
            side_effect=synchronized_find,
        ):
            threads = [
                threading.Thread(target=publish, args=(f"attempt-{index}",))
                for index in range(2)
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)

        self.assertFalse(errors)
        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertEqual(sorted(response.status_code for response in responses), [202, 202])
        self.assertEqual(len({response.json["job_id"] for response in responses}), 1)
        self.assertEqual(launch.call_count, 1)
        with self.app.app_context():
            self.assertEqual(MachineUploadJob.query.count(), 1)
            job = MachineUploadJob.query.one()
            self.assertTrue((self.video_dir / job.source_path).exists())
        video_files = [
            path
            for path in self.video_dir.rglob("*")
            if path.is_file() and path.suffix == ".mp4"
        ]
        self.assertEqual(len(video_files), 1)

    @patch("fireshare.api.upload._launch_scan_video")
    def test_preexisting_video_folder_conflict_is_rejected(self, launch):
        content = b"existing-video"
        source = self.video_dir / "library" / "existing.mp4"
        source.parent.mkdir()
        source.write_bytes(content)

        from fireshare import util

        video_id = util.video_id(source)
        with self.app.app_context():
            db.session.add_all(
                [
                    Video(
                        video_id=video_id,
                        extension=".mp4",
                        path="library/existing.mp4",
                        available=True,
                    ),
                    VideoInfo(video_id=video_id, title="Existing", private=True),
                ]
            )
            db.session.commit()

        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={
                "file": (io.BytesIO(content), "existing.mp4"),
                "folder": "other",
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"]["code"], "folder_conflict")
        launch.assert_not_called()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_preexisting_video_must_be_ready_for_deduplication(self, launch):
        content = b"existing-video"
        source = self.video_dir / "library" / "existing.mp4"
        source.parent.mkdir()
        source.write_bytes(content)

        from fireshare import util

        video_id = util.video_id(source)
        with self.app.app_context():
            db.session.add_all(
                [
                    Video(
                        video_id=video_id,
                        extension=".mp4",
                        path="library/existing.mp4",
                        available=True,
                    ),
                    VideoInfo(video_id=video_id, title="Existing", private=True),
                ]
            )
            db.session.commit()

        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(content), "existing.mp4")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"]["code"], "existing_video_incomplete")
        launch.assert_not_called()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_ready_scan_race_is_not_overwritten_as_processing(self, launch):
        def finish_scan(_path, _config, **kwargs):
            job = MachineUploadJob.query.filter_by(
                job_id=kwargs["machine_job_id"]
            ).one()
            video = Video(
                video_id=job.video_id,
                extension=".mp4",
                path=job.source_path,
                available=True,
            )
            info = VideoInfo(video_id=job.video_id, title="clip", private=True)
            db.session.add_all([video, info])
            db.session.commit()
            (self.processed_dir / "video_links" / f"{job.video_id}.mp4").write_bytes(
                b"video"
            )
            self.assertTrue(mark_job_ready(job.job_id))
            return SimpleNamespace(pid=1234)

        launch.side_effect = finish_scan
        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ready")
        with self.app.app_context():
            self.assertEqual(MachineUploadJob.query.one().status, "ready")

    @patch("fireshare.api.upload._launch_scan_video")
    def test_relative_video_root_produces_relative_source_path(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        original_cwd = Path.cwd()
        os.chdir(self.root)
        try:
            self.app.config["PATHS"]["video"] = Path("videos")
            response = self.client.post(
                "/api/v1/uploads",
                headers=self.auth_headers,
                data={"file": (io.BytesIO(b"video"), "clip.mp4")},
                content_type="multipart/form-data",
            )
        finally:
            os.chdir(original_cwd)

        self.assertEqual(response.status_code, 202)
        with self.app.app_context():
            source_path = MachineUploadJob.query.one().source_path
        self.assertFalse(Path(source_path).is_absolute())
        self.assertTrue((self.video_dir / source_path).exists())
        self.assertEqual(Path(launch.call_args.args[0]), Path(source_path))

    @patch("fireshare.api.upload._launch_scan_video")
    def test_marker_descriptor_closes_when_write_fails(self, launch):
        marker_fd = []

        def fail_marker_write(fd, _content):
            marker_fd.append(fd)
            raise OSError(errno.EIO, "marker write failed")

        with patch("fireshare.machine_upload.os.write", side_effect=fail_marker_write):
            response = self.client.post(
                "/api/v1/uploads",
                headers=self.auth_headers,
                data={"file": (io.BytesIO(b"video"), "clip.mp4")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json["error"]["code"], "storage_error")
        self.assertEqual(len(marker_fd), 1)
        with self.assertRaises(OSError):
            os.fstat(marker_fd[0])
        self.assertFalse(list(self.video_dir.rglob("*.machine-upload.lock")))
        launch.assert_not_called()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_periodic_reconciliation_fails_abandoned_job(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=response.json["job_id"]).one()
            source = self.video_dir / job.source_path
            marker = Path(f"{source}.machine-upload.lock")
            job.updated_at = datetime.utcnow() - timedelta(seconds=901)
            db.session.commit()
            with patch(
                "fireshare.machine_upload._scanner_process_alive",
                return_value=True,
            ):
                self.assertEqual(reconcile_pending_jobs(), 1)
                self.assertEqual(job.status, "processing")
                self.assertTrue(source.exists())
                self.assertTrue(marker.exists())
            with patch(
                "fireshare.machine_upload._scanner_process_alive",
                return_value=False,
            ):
                self.assertEqual(reconcile_pending_jobs(), 1)
            self.assertEqual(job.status, "failed")
            self.assertFalse(source.exists())
            self.assertFalse(marker.exists())

    def test_orphan_marker_is_removed_without_deleting_video(self):
        source = self.video_dir / "library" / "orphan.mp4"
        source.parent.mkdir()
        source.write_bytes(b"video")
        marker = Path(f"{source}.machine-upload.lock")
        marker.write_text("f" * 32, encoding="ascii")

        with self.app.app_context():
            self.assertFalse(machine_upload_blocks_scan(source))

        self.assertTrue(source.exists())
        self.assertFalse(marker.exists())

    def test_invalid_marker_is_released_only_after_timeout(self):
        source = self.video_dir / "library" / "invalid.mp4"
        source.parent.mkdir()
        source.write_bytes(b"video")
        marker = Path(f"{source}.machine-upload.lock")
        marker.write_text("invalid", encoding="ascii")

        with self.app.app_context():
            self.assertTrue(machine_upload_blocks_scan(source))
            self.assertTrue(marker.exists())
            expired = time.time() - 901
            os.utime(marker, (expired, expired))
            self.assertFalse(machine_upload_blocks_scan(source))

        self.assertTrue(source.exists())
        self.assertFalse(marker.exists())

    def test_hidden_staging_cleanup_matches_actual_temp_names(self):
        staging_dir = self.video_dir / ".fireshare-upload-tmp"
        staging_dir.mkdir()
        stale = staging_dir / ".fireshare-stale.machine-upload"
        recent = staging_dir / ".fireshare-recent.machine-upload"
        unrelated = staging_dir / "other.machine-upload"
        for path in (stale, recent, unrelated):
            path.write_bytes(b"partial")
        os.utime(stale, (time.time() - 90000, time.time() - 90000))

        _cleanup_stale_machine_staging(self.video_dir, time.time() - 86400)

        self.assertFalse(stale.exists())
        self.assertTrue(recent.exists())
        self.assertTrue(unrelated.exists())

    @patch("fireshare.api.upload.threading.Thread.start")
    @patch("fireshare.api.upload.Popen")
    def test_scanner_command_privacy_flags_are_tri_state(self, popen, _thread_start):
        from fireshare.api.upload import _launch_scan_video

        popen.return_value = SimpleNamespace(pid=1234)
        config = {"transcoding": {"auto_transcode": False}}
        source = self.video_dir / "clip.mp4"

        with self.app.app_context():
            _launch_scan_video(source, config, private=True)
            private_command = popen.call_args.args[0]
            _launch_scan_video(source, config, private=False)
            public_command = popen.call_args.args[0]
            _launch_scan_video(source, config)
            default_command = popen.call_args.args[0]

        self.assertIn("--private", private_command)
        self.assertNotIn("--public", private_command)
        self.assertIn("--public", public_command)
        self.assertNotIn("--private", public_command)
        self.assertNotIn("--private", default_command)
        self.assertNotIn("--public", default_command)

    @patch("fireshare.api.upload._launch_scan_video")
    def test_nonzero_scanner_exit_marks_job_failed(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        response = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=response.json["job_id"]).one()
            source = self.video_dir / job.source_path
            finalize_job_after_scan(job.job_id, 7, job.attempt_count)
            db.session.refresh(job)
            self.assertEqual(job.status, "failed")
            self.assertEqual(job.error_code, "scan_failed")
            self.assertFalse(source.exists())

    def test_machine_scheduler_does_not_restore_disabled_video_scan(self):
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
        from fireshare.schedule import fireshare_scan, init_schedule

        jobs_url = f"sqlite:///{self.data_dir / 'jobs.sqlite'}"
        seed = BackgroundScheduler(
            jobstores={"default": SQLAlchemyJobStore(url=jobs_url)}
        )
        seed.start(paused=True)
        seed.add_job(
            fireshare_scan,
            "interval",
            minutes=5,
            id="fireshare_scan",
        )
        seed.shutdown()
        seed._jobstores["default"].engine.dispose()

        scheduler = init_schedule(
            self.app,
            jobs_url,
            mins_between_scan=0,
            machine_uploads_enabled=True,
        )
        try:
            self.assertIsNone(scheduler.get_job("fireshare_scan"))
            self.assertIsNotNone(scheduler.get_job("machine_upload_reconcile"))
        finally:
            scheduler.shutdown()
            scheduler._jobstores["default"].engine.dispose()

    @patch("fireshare.api.upload._launch_scan_video")
    def test_stale_reaper_cannot_fail_new_attempt(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=first.json["job_id"]).one()
            finalize_job_after_scan(job.job_id, 7, 1)
            self.assertEqual(job.status, "failed")

        second = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(second.status_code, 202)

        with self.app.app_context():
            job = MachineUploadJob.query.one()
            source = self.video_dir / job.source_path
            self.assertEqual(job.attempt_count, 2)
            finalize_job_after_scan(job.job_id, 7, 1)
            db.session.refresh(job)
            self.assertEqual(job.status, "processing")
            self.assertTrue(source.exists())

    @patch("fireshare.api.upload._launch_scan_video")
    def test_deleted_ready_video_can_be_republished_without_poll_deleting_source(self, launch):
        launch.return_value = SimpleNamespace(pid=1234)
        first = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        with self.app.app_context():
            job = MachineUploadJob.query.filter_by(job_id=first.json["job_id"]).one()
            source = self.video_dir / job.source_path
            video = Video(
                video_id=job.video_id,
                extension=".mp4",
                path=job.source_path,
                available=True,
            )
            db.session.add_all(
                [
                    video,
                    VideoInfo(video_id=job.video_id, title="clip", private=True),
                ]
            )
            db.session.commit()
            link = self.processed_dir / "video_links" / f"{job.video_id}.mp4"
            link.write_bytes(b"video")
            self.assertTrue(mark_job_ready(job.job_id))
            VideoInfo.query.filter_by(video_id=job.video_id).delete()
            Video.query.filter_by(video_id=job.video_id).delete()
            db.session.commit()
            source.unlink()
            link.unlink()

        second = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(b"video"), "clip.mp4")},
            content_type="multipart/form-data",
        )

        self.assertEqual(second.status_code, 202)
        self.assertEqual(second.json["job_id"], first.json["job_id"])
        with self.app.app_context():
            job = MachineUploadJob.query.one()
            self.assertEqual(job.attempt_count, 2)
            self.assertEqual(job.status, "processing")
            self.assertTrue((self.video_dir / job.source_path).exists())

    @patch("fireshare.api.upload._launch_scan_video")
    def test_admin_database_reset_does_not_delete_existing_media(self, launch):
        content = b"existing-video"
        source = self.video_dir / "library" / "existing.mp4"
        source.parent.mkdir()
        source.write_bytes(content)

        from fireshare import util

        video_id = util.video_id(source)
        with self.app.app_context():
            db.session.add_all(
                [
                    Video(
                        video_id=video_id,
                        extension=".mp4",
                        path="library/existing.mp4",
                        available=True,
                    ),
                    VideoInfo(video_id=video_id, title="Existing", private=True),
                ]
            )
            db.session.commit()
            link = self.processed_dir / "video_links" / f"{video_id}.mp4"
            link.write_bytes(content)

        published = self.client.post(
            "/api/v1/uploads",
            headers=self.auth_headers,
            data={"file": (io.BytesIO(content), "existing.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(published.status_code, 200)

        with self.app.app_context():
            VideoInfo.query.filter_by(video_id=video_id).delete()
            Video.query.filter_by(video_id=video_id).delete()
            db.session.commit()
            link.unlink()

        status = self.client.get(
            f"/api/v1/uploads/{published.json['job_id']}",
            headers=self.auth_headers,
        )
        second_status = self.client.get(
            f"/api/v1/uploads/{published.json['job_id']}",
            headers=self.auth_headers,
        )

        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json["status"], "failed")
        self.assertEqual(status.json["error"]["code"], "video_removed")
        self.assertEqual(second_status.json["error"]["code"], "video_removed")
        self.assertTrue(source.exists())
        launch.assert_not_called()
