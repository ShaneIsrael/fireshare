DEFAULT_CONFIG = {
  "app_config": {
    "video_defaults": {
      "private": True
    },
    "allow_public_upload": False,
    "allow_public_game_tag": False,
    "public_upload_folder_name": "public uploads",
    "admin_upload_folder_name": "uploads"
  },
  "ui_config": {
    "shareable_link_domain": "",
    "show_admin_upload": True,
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

SUPPORTED_FILE_TYPES = ['mp4', 'mov', 'webm']
SUPPORTED_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm']