DEFAULT_CONFIG = {
  "app_config": {
    "video_defaults": {
      "private": True
    },
    "allow_public_upload": False,
    "public_upload_folder_name": "public uploads",
    "admin_upload_folder_name": "uploads"
  },
  "ui_config": {
    "shareable_link_domain": "",
    "show_public_upload": False,
    "show_admin_upload": True,
  },
  "integrations": {
    "discord_webhook_url": "",
  }
}

SUPPORTED_FILE_TYPES = ['mp4', 'mov', 'webm']
SUPPORTED_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm']