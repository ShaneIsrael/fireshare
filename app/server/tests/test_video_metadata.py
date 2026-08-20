import re
from datetime import datetime

from fireshare import db
from fireshare.models import Video, VideoInfo

from .helpers import MachineApiTestCase


META_RE = re.compile(r'<meta property="([^"]+)" content="([^"]*)"')


class VideoMetadataOpenGraphTests(MachineApiTestCase):
    """Covers the OpenGraph tags on the /w/<video_id> share page.

    Unfurlers gate inline video playback on og:type belonging to the `video.*` family;
    a bare `video` makes them fall back to a plain link card.
    """

    def _create_video(self, video_id="abc123", extension=".mp4", password_hash=None):
        with self.app.app_context():
            video = Video(
                video_id=video_id,
                extension=extension,
                path=f"library/{video_id}{extension}",
                available=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            info = VideoInfo(
                video_id=video_id,
                title="A clip",
                description="A description",
                width=1920,
                height=1080,
                private=False,
                password_hash=password_hash,
            )
            db.session.add_all([video, info])
            db.session.commit()
        return video_id

    def _og_tags(self, video_id):
        response = self.client.get(f"/w/{video_id}")
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        return dict(META_RE.findall(html)), html

    def test_og_type_is_video_other(self):
        video_id = self._create_video()
        tags, html = self._og_tags(video_id)

        self.assertEqual(tags["og:type"], "video.other")
        # The legacy bare value is what breaks `starts_with("video.")` unfurler checks.
        self.assertNotIn('property="og:type" content="video"', html)

    def test_og_video_type_matches_extension(self):
        for extension, expected in (
            (".mp4", "video/mp4"),
            (".m4v", "video/mp4"),
            (".webm", "video/webm"),
            (".mov", "video/quicktime"),
            (".mkv", "video/x-matroska"),
        ):
            with self.subTest(extension=extension):
                video_id = self._create_video(
                    video_id=f"vid{extension.strip('.')}", extension=extension
                )
                tags, _ = self._og_tags(video_id)
                self.assertEqual(tags["og:video:type"], expected)

    def test_unknown_extension_falls_back_to_mp4(self):
        video_id = self._create_video(video_id="weird", extension=".avi")
        tags, _ = self._og_tags(video_id)
        self.assertEqual(tags["og:video:type"], "video/mp4")

    def test_video_tags_present_for_unprotected_video(self):
        video_id = self._create_video()
        tags, _ = self._og_tags(video_id)

        self.assertEqual(tags["og:video"], f"/_content/video/{video_id}.mp4")
        self.assertEqual(tags["og:video:secure_url"], f"/_content/video/{video_id}.mp4")
        self.assertEqual(tags["og:video:width"], "1920")
        self.assertEqual(tags["og:video:height"], "1080")

    def test_password_protected_video_omits_all_video_tags(self):
        video_id = self._create_video(video_id="locked", password_hash="hashed")
        tags, _ = self._og_tags(video_id)

        # og:type still marks it as a video, but nothing that exposes or describes the
        # direct media URL may leak for a protected video.
        self.assertEqual(tags["og:type"], "video.other")
        for prop in (
            "og:video",
            "og:video:secure_url",
            "og:video:type",
            "og:video:width",
            "og:video:height",
        ):
            self.assertNotIn(prop, tags)

    def test_no_twitter_card_tag(self):
        # A twitter:card of summary_large_image/photo is checked before the OpenGraph
        # video lookup by unfurlers, and would reclassify the embed away from video.
        video_id = self._create_video()
        _, html = self._og_tags(video_id)
        self.assertNotIn("twitter:card", html)
