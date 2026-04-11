<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/ShaneIsrael/fireshare">
    <img src="app/client/src/assets/logo.png" alt="Logo" width="120" height="160">
  </a>

  <h1 align="center">Fireshare</h1>

  <p align="center">
    Share your game clips, videos, or other media via unique links.
    <br />
    <br />
    <a href="https://github.com/shaneisrael/fireshare/actions">
      <img alt="Docker Build" src="https://github.com/shaneisrael/fireshare/actions/workflows/docker-publish-main.yml/badge.svg" />
    </a>
    <a href="https://hub.docker.com/r/shaneisrael/fireshare">
      <img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/shaneisrael/fireshare?label=docker%20pulls">
    </a>
    <a href="https://hub.docker.com/r/shaneisrael/fireshare/tags?page=1&ordering=last_updated">
      <img alt="GitHub tag (latest SemVer)" src="https://img.shields.io/github/v/tag/shaneisrael/fireshare?label=version">
    </a>
    <a href="https://github.com/shaneisrael/fireshare/stargazers">
      <img alt="GitHub stars" src="https://img.shields.io/github/stars/shaneisrael/fireshare">
    </a>
    <br />
    <p align="center">
      <a href="https://www.buymeacoffee.com/shaneisrael"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="41" width="174" /></a>
    </p>
    <p align="center">
      <a href="https://v.fireshare.net">Live Demo</a>
      ·
      <a href="https://github.com/ShaneIsrael/fireshare/issues">Report a Bug</a>
    </p>
  </p>

## Key Features

- Share videos through unique links
- Public / Private feeds (private is link only)
- Game-based organization with cover art
- Mobile Device Support
- Uploads (optional, can be restricted)
- Video view counting
- Video Cropping
- Video Tags for improved search and categorization
- Open Graph metadata for rich link previews
- [Notifications to Discord and others](./Notifications.md)
- RSS feed for new public videos
- [LDAP support](./LDAP.md)
- Optional [video transcoding with CPU or GPU](#transcoding-optional)

# Navigation

- [Installation](#installation)
- [Configuration](#configuration)
- [Demo](#demo)
- [Contributing](#contributing)

<h4 align="center">Dashboard</h4>

---

![card-view][card-view]

<h4 align="center">Automatic Game Organization</h3h4>

---

![folders][folders]

![folders-game][folders-game]

<h4 align="center">Video Details</h4>

---

![edit][edit]

<h4 align="center">Public / Private Uploading</h4>

---

![uploading][uploading]

## Installation

Fireshare is designed to run in Docker.

Required mounts:

1. `/data` - internal database
2. `/processed` - generated metadata (posters, metadata files)
3. `/videos` - source video directory to scan

If your clips are in `/path/to/my_game_clips/`, mount that path to `/videos` in the container.

### Docker Compose

Edit `docker-compose.yml` for your host paths and admin credentials, then run:

```sh
docker-compose up -d
```

Then open `http://localhost:8080`.

### Docker Run

```sh
docker run --name fireshare \
  -v $(pwd)/fireshare/data:/data:rw \
  -v $(pwd)/fireshare/processed:/processed:rw \
  -v /path/to/my/videos:/videos:rw \
  -v /path/to/my/images:/images:rw \
  -p 8080:80 \
  -e ADMIN_PASSWORD=your-admin-password \
  -d shaneisrael/fireshare:latest
```

Open `http://localhost:8080`.

## Configuration

- [LDAP](#ldap)
- [Transcoding](#transcoding-optional)
- [Docker ENV Variables](#docker-environment-variables)

### LDAP

- LDAP setup: [LDAP.md](./LDAP.md)

### Transcoding (Optional)

Transcoding is off by default.

```yaml
ENABLE_TRANSCODING=true
TRANSCODE_GPU=true # optional, NVIDIA only
```

CPU transcoding works out of the box. For NVIDIA GPU setup with the Docker image, you only need an NVIDIA GPU on the host—the image handles drivers and toolkit.

#### GPU Requirements

- NVIDIA GPU with NVENC support

#### Unraid Setup

If you're using Unraid:

1. Install "NVIDIA Driver" plugin from Apps/Community Applications
2. Add to Fireshare container environment:
   ```
   ENABLE_TRANSCODING=true
   TRANSCODE_GPU=true
   NVIDIA_DRIVER_CAPABILITIES=all
   ```
3. Add to "Extra Parameters": `--gpus=all`

#### Encoder Selection

When GPU mode is enabled, Fireshare selects the best available encoder:

**GPU Mode** (`TRANSCODE_GPU=true`):

- AV1 with GPU (av1_nvenc) — RTX 40 series or newer
- H.264 with GPU (h264_nvenc) — GTX 1050+
- Fallback to CPU encoders if GPU encoding fails

**CPU Mode** (`TRANSCODE_GPU=false`):

- H.264 with CPU — Most compatible, faster encoding
- AV1 with CPU — Best compression, slower

### Docker Environment Variables

See [EnvironmentVariables.md](./EnvironmentVariables.md) for the full list of available environment variables.

## Local Development

Requirements: Python 3, Node.js, and npm.

1. Clone the repo:
   ```sh
   git clone https://github.com/ShaneIsrael/fireshare.git
   ```
2. Start backend services from project root:
   ```sh
   ./run_local.sh
   ```
3. Start frontend:
   ```sh
   cd app/client
   npm install
   npm start
   ```
4. Open `http://localhost:3000` and sign in with `admin/admin`.

## Contributing

Contributions are welcome. For larger changes, open an issue first to align on scope.

1. Fork the repository
2. Create a branch from `develop`
3. Commit your changes
4. Rebase on latest `develop`
5. Open a pull request to `develop`

Issues and feature requests: https://github.com/ShaneIsrael/fireshare/issues

### Database Changes

If you update models, create a migration and review it before opening a pull request.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for a full guide covering installation issues, playback problems, permission errors, transcoding, LDAP, and more.

---

[card-view]: .github/images/card-view.png
[folders]: .github/images/folders.png
[folders-game]: .github/images/folders-game.png
[edit]: .github/images/edit-details.png
[uploading]: .github/images/uploading.png
