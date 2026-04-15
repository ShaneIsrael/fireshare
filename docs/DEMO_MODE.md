# Demo Mode

When `DEMO_MODE=true`, two accounts are created on startup:

| Account | Username | Password | Role |
|---|---|---|---|
| Admin | `admin` (or `ADMIN_USERNAME`) | `admin` (or `ADMIN_PASSWORD`) | Full access, no restrictions |
| Demo | `demo` | `demo` | Restricted — see below |

The admin account has no restrictions whatsoever. All limitations below apply only to the **demo** account.

---

## Demo Account Abilities

### ✅ Allowed

**Browsing & Playback**
- Browse and watch all public videos and images
- Browse games and tags
- View video and image details

**Uploads**
- Upload videos and images (subject to `DEMO_UPLOAD_LIMIT_MB` if configured)

**File Manager**
- View all files and folders (videos and images)
- Rename files (bulk rename)
- Set privacy / make files public or private (bulk)
- Create folders
- Delete empty folders
- Remove crop settings from videos (bulk remove crop)

**Metadata & Tags**
- Edit video and image details (title, description)
- Add and remove tags on videos and images
- Link and unlink games on videos and images

**Settings**
- View application settings (API keys are hidden)

---

### ❌ Blocked

**File Operations**
- Delete individual videos or images
- Move individual videos
- Bulk delete videos or images
- Bulk move videos or images
- Remove transcoded variants (bulk remove transcodes)
- Clean up orphaned derived files

**Scanning**
- Manual video scan
- Manual image scan
- Manual date extraction scan
- Manual game scan
- Remove missing videos/images

**Game Folder Rules**
- Create video game folder rules
- Delete video game folder rules
- Create image game folder rules
- Delete image game folder rules

**Transcoding**
- Start transcoding (transcoding is disabled entirely in demo mode)
- Start transcoding for individual videos
- Cancel transcoding jobs

**Settings & Administration**
- Change application settings
- Test Discord webhook
- Test generic webhook
- Reset database
- Create new user accounts

---

## Configuration

| Variable | Description | Default |
|---|---|---|
| `DEMO_MODE` | Enable demo mode | `false` |
| `DEMO_UPLOAD_LIMIT_MB` | Max upload size in MB for demo instance. `0` = unlimited | `0` |
| `ADMIN_USERNAME` | Username for the admin account | `admin` |
| `ADMIN_PASSWORD` | Password for the admin account | `admin` |

The demo account (`demo` / `demo`) is created automatically and cannot be configured. It is removed automatically if `DEMO_MODE` is set back to `false`.
