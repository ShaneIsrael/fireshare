DEFAULT_CONFIG = {
  "app_config": {
    "video_defaults": {
      "private": True
    },
    "image_defaults": {
      "private": True
    },
    "allow_public_upload": True,
    "allow_public_folder_selection": True,
    "allow_public_game_tag": True,
    "public_upload_folder_name": "public uploads",
    "admin_upload_folder_name": "uploads"
  },
  "ui_config": {
    "shareable_link_domain": "",
    "show_admin_upload": True,
    "show_folder_dropdown": True,
    "show_games": True,
    "show_my_videos": True,
    "show_public_upload": False,
    "show_public_videos": True,
    "show_images": True,
    "autoplay": False,
    "show_suggestions": True
  },
  "integrations": {
    "discord_webhook_url": "",
    "generic_webhook_url": "",
    "generic_webhook_payload": {},
    "steamgriddb_api_key": "",
  },
  "rss_config": {
    "title": "Fireshare Feed",
    "description": "Latest videos from Fireshare"
  },
  "transcoding": {
    "encoder_preference": "auto",
    "auto_transcode": True,
    "enable_480p": True,
    "enable_720p": True,
    "enable_1080p": True,
  }
}

SUPPORTED_FILE_TYPES = ['mp4', 'm4v', 'mov', 'webm']
SUPPORTED_FILE_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm']

# MIME types advertised to OpenGraph consumers via og:video:type. Discord and Slack
# require the tag to render an inline player; without it they fall back to a link card.
VIDEO_MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
}
DEFAULT_VIDEO_MIME_TYPE = 'video/mp4'
