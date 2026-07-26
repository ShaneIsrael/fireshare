import copy
import json
import tempfile
import unittest
from pathlib import Path

from flask import Flask
from flask_login import LoginManager
from sqlalchemy.pool import NullPool

from fireshare import FireshareRequest, db
from fireshare.api import api
from fireshare.constants import DEFAULT_CONFIG


class MachineApiTestCase(unittest.TestCase):
    token = "a" * 64

    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.data_dir = self.root / "data"
        self.video_dir = self.root / "videos"
        self.processed_dir = self.root / "processed"
        self.image_dir = self.root / "images"
        for path in (
            self.data_dir,
            self.video_dir,
            self.processed_dir / "video_links",
            self.processed_dir / "image_links",
            self.processed_dir / "derived",
            self.image_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)

        config = copy.deepcopy(DEFAULT_CONFIG)
        config["app_config"]["admin_upload_folder_name"] = "uploads"
        config["app_config"]["video_defaults"]["private"] = True
        (self.data_dir / "config.json").write_text(
            json.dumps(config),
            encoding="utf-8",
        )

        self.app = Flask(__name__)
        self.app.request_class = FireshareRequest
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-secret",
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{self.data_dir / 'test.sqlite'}",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            SQLALCHEMY_ENGINE_OPTIONS={
                "poolclass": NullPool,
                "connect_args": {"check_same_thread": False},
            },
            DATA_DIRECTORY=str(self.data_dir),
            VIDEO_DIRECTORY=str(self.video_dir),
            PROCESSED_DIRECTORY=str(self.processed_dir),
            IMAGE_DIRECTORY=str(self.image_dir),
            PATHS={
                "data": self.data_dir,
                "video": self.video_dir,
                "processed": self.processed_dir,
                "images": self.image_dir,
            },
            DOMAIN="",
            MACHINE_API_TOKEN=self.token,
            MACHINE_UPLOAD_MAX_MB=10,
            MACHINE_UPLOAD_INGEST_TIMEOUT_SECONDS=900,
            DEMO_MODE=False,
            ENABLE_TRANSCODING=False,
            ENVIRONMENT="test",
        )
        login_manager = LoginManager(self.app)

        @login_manager.user_loader
        def load_user(_user_id):
            return None

        db.init_app(self.app)
        self.app.register_blueprint(api)

        with self.app.app_context():
            db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.tempdir.cleanup()

    @property
    def auth_headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Idempotency-Key": "publish-attempt-1",
        }
