import json
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

    def json(self):
        return {
            "title": self.title,
            "description": self.description,
            "private": self.private,
            "width": self.width,
            "height": self.height,
            "duration": round(self.duration) if self.duration else 0,
            "framerate": self.framerate,
            "has_480p": self.has_480p,
            "has_720p": self.has_720p,
            "has_1080p": self.has_1080p
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

        if self.steamgriddb_id:
            domain = f"https://{current_app.config['DOMAIN']}" if current_app.config.get('DOMAIN') else ""
            # Assume standard .png extension - endpoint handles if missing or different
            hero_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/hero_1.png"
            logo_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/logo_1.png"
            icon_url = f"{domain}/api/game/assets/{self.steamgriddb_id}/icon_1.png"

        return {
            "id": self.id,
            "steamgriddb_id": self.steamgriddb_id,
            "name": self.name,
            "release_date": self.release_date,
            "hero_url": hero_url,
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
    
