import json
from datetime import datetime
from flask_login import UserMixin
from . import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))
    admin = db.Column(db.Boolean, default=True)
    ldap = db.Column(db.Boolean, default=False)
    last_seen_version = db.Column(db.String(32), nullable=True)

class Video(db.Model):
    __tablename__ = "video"

    id        = db.Column(db.Integer, primary_key=True)
    video_id  = db.Column(db.String(32), index=True, nullable=False)
    extension = db.Column(db.String(8), nullable=False)
    path      = db.Column(db.String(2048), index=True, nullable=False)
    available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime())
    updated_at = db.Column(db.DateTime())
    recorded_at = db.Column(db.DateTime(), nullable=True)  # Extracted from filename
    source_folder = db.Column(db.String(256), nullable=True)  # Original folder name for game detection

    info      = db.relationship("VideoInfo", back_populates="video", uselist=False, lazy="joined")

    def json(self):
        j = {
            "video_id": self.video_id,
            "extension": self.extension,
            "path": self.path,
            "available": self.available,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
            "info": self.info.json(),
        }
        return j

    def __repr__(self):
        return "<Video {}>".format(self.video_id)

class VideoInfo(db.Model):
    __tablename__ = "video_info"

    id          = db.Column(db.Integer, primary_key=True)
    video_id    = db.Column(db.String(32), db.ForeignKey("video.video_id"), nullable=False)
    title       = db.Column(db.String(256), index=True)
    description = db.Column(db.String(2048))
    info        = db.Column(db.Text)
    duration    = db.Column(db.Float)
    width       = db.Column(db.Integer)
    height      = db.Column(db.Integer)
    private     = db.Column(db.Boolean, default=True)
    has_480p    = db.Column(db.Boolean, default=False)
    has_720p    = db.Column(db.Boolean, default=False)
    has_1080p   = db.Column(db.Boolean, default=False)
    start_time  = db.Column(db.Float, nullable=True)
    end_time    = db.Column(db.Float, nullable=True)
    has_crop    = db.Column(db.Boolean, default=False)

    video       = db.relationship("Video", back_populates="info", uselist=False, lazy="joined")

    @property
    def vcodec(self):
        info = json.loads(self.info) if self.info else None
        vcodec = [i for i in info if i["codec_type"] == "video"][0] if info else None
        return vcodec

    @property
    def acodec(self):
        info = json.loads(self.info) if self.info else None
        acodec = [i for i in info if i["codec_type"] == "video"][0] if info else None
        return acodec

    @property
    def framerate(self):
        if self.vcodec:
            frn, frd = self.vcodec.get("r_frame_rate", "").split("/")
            return round(float(frn)/float(frd))
        else:
            return None

    def _cropped_duration(self):
        """Return the effective duration, accounting for crop start/end times."""
        if not self.has_crop:
            return self.duration
        start = self.start_time or 0
        end = self.end_time if self.end_time is not None else self.duration
        return end - start

    def json(self):
        return {
            "title": self.title,
            "description": self.description,
            "private": self.private,
            "width": self.width,
            "height": self.height,
            "duration": round(self._cropped_duration()) if self.duration else 0,
            "framerate": self.framerate,
            "has_480p": self.has_480p,
            "has_720p": self.has_720p,
            "has_1080p": self.has_1080p,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "has_crop": self.has_crop or False,
        }

    def __repr__(self):
        return "<VideoInfo {} {}>".format(self.video_id, self.title)

class GameMetadata(db.Model):
    __tablename__ = "game_metadata"

    id                  = db.Column(db.Integer, primary_key=True)
    steamgriddb_id      = db.Column(db.Integer, index=True, nullable=True)
    name                = db.Column(db.String(256), index=True, nullable=False)
    release_date        = db.Column(db.String(64), nullable=True)
    hero_url            = db.Column(db.String(2048), nullable=True)
    logo_url            = db.Column(db.String(2048), nullable=True)
    icon_url            = db.Column(db.String(2048), nullable=True)
    created_at          = db.Column(db.DateTime())
    updated_at          = db.Column(db.DateTime())

    videos              = db.relationship("VideoGameLink", back_populates="game")

    def json(self):
        from flask import current_app

        # Construct dynamic URLs for assets if steamgriddb_id exists
        hero_url = None
        logo_url = None
        icon_url = None

        banner_url = None

        if self.steamgriddb_id:
            domain = f"https://{current_app.config['DOMAIN']}" if current_app.config.get('DOMAIN') else ""
            # Assume standard .png extension - endpoint handles if missing or different
            hero_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/hero_1.png"
            banner_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/hero_2.png"
            logo_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/logo_1.png"
            icon_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/icon_1.png"

        return {
            "id": self.id,
            "steamgriddb_id": self.steamgriddb_id,
            "name": self.name,
            "release_date": self.release_date,
            "hero_url": hero_url,
            "banner_url": banner_url,
            "logo_url": logo_url,
            "icon_url": icon_url,
        }

    def __repr__(self):
        return "<GameMetadata {} {}>".format(self.id, self.name)

class VideoGameLink(db.Model):
    __tablename__ = "video_game_link"

    id          = db.Column(db.Integer, primary_key=True)
    video_id    = db.Column(db.String(32), db.ForeignKey("video.video_id"), nullable=False)
    game_id     = db.Column(db.Integer, db.ForeignKey("game_metadata.id"), nullable=False)
    created_at  = db.Column(db.DateTime())

    video       = db.relationship("Video")
    game        = db.relationship("GameMetadata", back_populates="videos")

    def json(self):
        return {
            "video_id": self.video_id,
            "game_id": self.game_id,
            "game": self.game.json() if self.game else None,
        }

    def __repr__(self):
        return "<VideoGameLink video:{} game:{}>".format(self.video_id, self.game_id)

class FolderRule(db.Model):
    __tablename__ = "folder_rule"

    id          = db.Column(db.Integer, primary_key=True)
    folder_path = db.Column(db.String(2048), unique=True, nullable=False)
    game_id     = db.Column(db.Integer, db.ForeignKey("game_metadata.id"), nullable=False)

    game        = db.relationship("GameMetadata")

    def json(self):
        return {
            "id": self.id,
            "folder_path": self.folder_path,
            "game_id": self.game_id,
            "game": self.game.json() if self.game else None,
        }

    def __repr__(self):
        return "<FolderRule {} -> game:{}>".format(self.folder_path, self.game_id)


class ImageFolderRule(db.Model):
    __tablename__ = "image_folder_rule"

    id          = db.Column(db.Integer, primary_key=True)
    folder_path = db.Column(db.String(2048), unique=True, nullable=False)
    game_id     = db.Column(db.Integer, db.ForeignKey("game_metadata.id"), nullable=False)

    game        = db.relationship("GameMetadata")

    def json(self):
        return {
            "id": self.id,
            "folder_path": self.folder_path,
            "game_id": self.game_id,
            "game": self.game.json() if self.game else None,
        }

    def __repr__(self):
        return "<ImageFolderRule {} -> game:{}>".format(self.folder_path, self.game_id)


class CustomTag(db.Model):
    __tablename__ = "custom_tag"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(256), unique=True, nullable=False, index=True)
    color      = db.Column(db.String(7), nullable=True)   # hex, e.g. "#FF5733"
    created_at = db.Column(db.DateTime())
    updated_at = db.Column(db.DateTime())

    videos     = db.relationship("VideoTagLink", back_populates="tag")

    def json(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
        }

    def __repr__(self):
        return "<CustomTag {} {}>".format(self.id, self.name)


class VideoTagLink(db.Model):
    __tablename__ = "video_tag_link"
    __table_args__ = (db.UniqueConstraint("video_id", "tag_id"),)

    id         = db.Column(db.Integer, primary_key=True)
    video_id   = db.Column(db.String(32), db.ForeignKey("video.video_id"), nullable=False)
    tag_id     = db.Column(db.Integer, db.ForeignKey("custom_tag.id"), nullable=False)
    created_at = db.Column(db.DateTime())

    video      = db.relationship("Video")
    tag        = db.relationship("CustomTag", back_populates="videos")

    def json(self):
        return {
            "video_id": self.video_id,
            "tag_id": self.tag_id,
            "tag": self.tag.json() if self.tag else None,
        }

    def __repr__(self):
        return "<VideoTagLink video:{} tag:{}>".format(self.video_id, self.tag_id)


class VideoView(db.Model):
    __tablename__ = "video_view"
    __table_args__ = (
        db.UniqueConstraint('video_id', 'ip_address'),
    )

    id          = db.Column(db.Integer, primary_key=True)
    video_id    = db.Column(db.String(32), db.ForeignKey("video.video_id"), nullable=False)
    ip_address  = db.Column(db.String(256), nullable=False)

    def json(self):
        return {
            "video_id": self.video_id,
            "ip_address": self.ip_address,
        }

    @classmethod
    def count(cls, video_id):
        return cls.query.filter_by(video_id=video_id).count()

    @classmethod
    def add_view(cls, video_id, ip_address):
        exists = cls.query.filter_by(video_id=video_id, ip_address=ip_address).first()
        if not exists:
            db.session.add(cls(video_id=video_id, ip_address=ip_address))
            db.session.commit()

    def __repr__(self):
        return "<VideoViews {} {}>".format(self.video_id, self.ip_address)


# ---------------------------------------------------------------------------
# Image models
# ---------------------------------------------------------------------------

class Image(db.Model):
    __tablename__ = "image"

    id            = db.Column(db.Integer, primary_key=True)
    image_id      = db.Column(db.String(32), index=True, nullable=False)
    extension     = db.Column(db.String(8), nullable=False)
    path          = db.Column(db.String(2048), index=True, nullable=False)
    available     = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime())
    updated_at    = db.Column(db.DateTime())
    source_folder = db.Column(db.String(256), nullable=True)

    info          = db.relationship("ImageInfo", back_populates="image", uselist=False, lazy="joined")

    def json(self):
        return {
            "image_id": self.image_id,
            "extension": self.extension,
            "path": self.path,
            "available": self.available,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "info": self.info.json() if self.info else {},
        }

    def __repr__(self):
        return "<Image {}>".format(self.image_id)


class ImageInfo(db.Model):
    __tablename__ = "image_info"

    id            = db.Column(db.Integer, primary_key=True)
    image_id      = db.Column(db.String(32), db.ForeignKey("image.image_id"), nullable=False)
    title         = db.Column(db.String(256), index=True)
    description   = db.Column(db.String(2048))
    width         = db.Column(db.Integer)
    height        = db.Column(db.Integer)
    file_size     = db.Column(db.Integer)
    private       = db.Column(db.Boolean, default=True)
    has_webp      = db.Column(db.Boolean, default=False)
    has_thumbnail = db.Column(db.Boolean, default=False)

    image         = db.relationship("Image", back_populates="info", uselist=False, lazy="joined")

    def json(self):
        return {
            "title": self.title,
            "description": self.description,
            "private": self.private,
            "width": self.width,
            "height": self.height,
            "file_size": self.file_size,
            "has_webp": self.has_webp,
            "has_thumbnail": self.has_thumbnail,
        }

    def __repr__(self):
        return "<ImageInfo {} {}>".format(self.image_id, self.title)


class ImageGameLink(db.Model):
    __tablename__ = "image_game_link"
    __table_args__ = (db.UniqueConstraint("image_id", "game_id"),)

    id         = db.Column(db.Integer, primary_key=True)
    image_id   = db.Column(db.String(32), db.ForeignKey("image.image_id"), nullable=False)
    game_id    = db.Column(db.Integer, db.ForeignKey("game_metadata.id"), nullable=False)
    created_at = db.Column(db.DateTime())

    image      = db.relationship("Image")
    game       = db.relationship("GameMetadata")

    def json(self):
        return {
            "image_id": self.image_id,
            "game_id": self.game_id,
            "game": self.game.json() if self.game else None,
        }

    def __repr__(self):
        return "<ImageGameLink image:{} game:{}>".format(self.image_id, self.game_id)


class ImageTagLink(db.Model):
    __tablename__ = "image_tag_link"
    __table_args__ = (db.UniqueConstraint("image_id", "tag_id"),)

    id         = db.Column(db.Integer, primary_key=True)
    image_id   = db.Column(db.String(32), db.ForeignKey("image.image_id"), nullable=False)
    tag_id     = db.Column(db.Integer, db.ForeignKey("custom_tag.id"), nullable=False)
    created_at = db.Column(db.DateTime())

    image      = db.relationship("Image")
    tag        = db.relationship("CustomTag")

    def json(self):
        return {
            "image_id": self.image_id,
            "tag_id": self.tag_id,
            "tag": self.tag.json() if self.tag else None,
        }

    def __repr__(self):
        return "<ImageTagLink image:{} tag:{}>".format(self.image_id, self.tag_id)


class ImageView(db.Model):
    __tablename__ = "image_view"
    __table_args__ = (db.UniqueConstraint("image_id", "ip_address"),)

    id         = db.Column(db.Integer, primary_key=True)
    image_id   = db.Column(db.String(32), db.ForeignKey("image.image_id"), nullable=False)
    ip_address = db.Column(db.String(256), nullable=False)

    def json(self):
        return {
            "image_id": self.image_id,
            "ip_address": self.ip_address,
        }

    @classmethod
    def count(cls, image_id):
        return cls.query.filter_by(image_id=image_id).count()

    @classmethod
    def add_view(cls, image_id, ip_address):
        exists = cls.query.filter_by(image_id=image_id, ip_address=ip_address).first()
        if not exists:
            db.session.add(cls(image_id=image_id, ip_address=ip_address))
            db.session.commit()

    def __repr__(self):
        return "<ImageView {} {}>".format(self.image_id, self.ip_address)


class TranscodeJob(db.Model):
    __tablename__ = "transcode_job"

    id           = db.Column(db.Integer, primary_key=True)
    video_id     = db.Column(db.String(64), nullable=True, index=True)  # None = bulk
    status       = db.Column(db.String(16), nullable=False, default='pending', index=True)
    task_count   = db.Column(db.Integer, nullable=False, default=0)
    created_at   = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    started_at   = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return "<TranscodeJob id={} video_id={} status={}>".format(self.id, self.video_id, self.status)

