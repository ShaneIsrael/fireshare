import json
from flask_login import UserMixin
from . import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))

class Video(db.Model):
    __tablename__ = "video"

    id        = db.Column(db.Integer, primary_key=True)
    video_id  = db.Column(db.String(32), index=True, nullable=False)
    extension = db.Column(db.String(8), nullable=False)
    path      = db.Column(db.String(2048), index=True, nullable=False)
    available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime())
    updated_at = db.Column(db.DateTime())

    info      = db.relationship("VideoInfo", back_populates="video", uselist=False, lazy="joined")

    def json(self):
        j = {
            "video_id": self.video_id,
            "extension": self.extension,
            "path": self.path,
            "available": self.available,
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
            "vcodec": self.vcodec,
            "acodec": self.acodec,
            "framerate": self.framerate
        }

    def __repr__(self):
        return "<VideoInfo {} {}>".format(self.video_id, self.title)

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
    
