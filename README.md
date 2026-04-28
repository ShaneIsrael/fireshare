<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/ShaneIsrael/fireshare">
    <img src="app/client/src/assets/logo.png" alt="Logo" width="120" height="160">
  </a>

  <h1 align="center">Fireshare</h1>

  <p align="center">
    Share your game clips, videos, or other media via unique links.
    <br /><br />
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
    <br /><br />
    <a href="https://www.buymeacoffee.com/shaneisrael">
      <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="41" width="174" />
    </a>
    <br /><br />
    <a href="https://demo.fireshare.net">Live Demo</a>
    &nbsp;&middot;&nbsp;
    <a href="https://github.com/ShaneIsrael/fireshare/issues">Report a Bug</a>
  </p>
</p>

---

If Fireshare is useful to you, [GitHub Sponsors](https://github.com/sponsors/ShaneIsrael) is the best way to support development. It keeps the demo server running and helps me carve out time on weekends for new features and updates.

## Key Features

- Share videos through unique links
- Public / private feeds (private is link-only)
- [video transcoding with CPU or GPU](#transcoding-optional)
- Password protected videos
- Game-based organization with cover art
- Mobile device support
- Uploads (optional, can be restricted)
- Video view counting
- Video cropping
- Video tags for improved search and categorization
- Open Graph metadata for rich link previews
- [Notifications to Discord and others](./docs/Notifications.md)
- RSS feed for new public videos
- [LDAP support](./docs/LDAP.md)

## Navigation

- [Installation](#installation)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

---

<h4 align="center">Dashboard</h4>

![card-view][card-view]

<h4 align="center">Automatic Game Organization</h4>

![folders][folders]

![folders-game][folders-game]

<h4 align="center">Video Details</h4>

![edit][edit]

<h4 align="center">Public / Private Uploading</h4>

![uploading][uploading]

---

## Installation

Fireshare is designed to run in Docker.

**Required volume mounts:**

| Mount        | Purpose                                      |
| ------------ | -------------------------------------------- |
| `/data`      | Internal database                            |
| `/processed` | Generated metadata (posters, metadata files) |
| `/videos`    | Source video directory to scan               |
| `/images`    | Source image directory to scan               |

### Docker Compose

```yaml
services:
  fireshare:
    container_name: fireshare
    image: shaneisrael/fireshare:latest-lite
    ports:
      - "8080:80"
    volumes:
      - /path/to/data:/data
      - /path/to/processed:/processed
      - /path/to/videos:/videos
      - /path/to/images:/images
    environment:
      - ADMIN_USERNAME=your-admin-username
      - ADMIN_PASSWORD=your-admin-password
      - SECRET_KEY=replace_with_random_string_can_be_anything
      # The domain your instance is hosted at. e.x: v.fireshare.net
      # this is required for opengraph to work correctly for shared links.
      - DOMAIN=
      # PUID/PGID: the user/group ID the container runs as. Files written to your
      # volumes (data, processed, videos, images) will be owned by this user. Set these to
      # match the owner of your host directories to avoid permission errors.
      # Run `id` on your host to find your UID and GID.
      - PUID=1000
      - PGID=1000
```

Update the volume paths and credentials, then run:

```sh
docker-compose up -d
```

Open `http://localhost:8080`.

### Docker Run

```sh
docker run --name fireshare \
  -v $(pwd)/fireshare/data:/data:rw \
  -v $(pwd)/fireshare/processed:/processed:rw \
  -v /path/to/my/videos:/videos:rw \
  -v /path/to/my/images:/images:rw \
  -p 8080:80 \
  -e ADMIN_USERNAME=your-admin-username \
  -e ADMIN_PASSWORD=your-admin-password \
  -e PUID=user-id-with-read-write-permissions \
  -e PGID=group-id-with-read-write-permissions \
  -d shaneisrael/fireshare:latest
```

Open `http://localhost:8080`.

### Fireshare Lite

The `fireshare:latest-lite` image is a smaller alternative that uses the system-provided FFmpeg instead of the CUDA-enabled build included in the standard image. It is a good fit for most users who do not need GPU transcoding.

|                                | Standard                | Lite          |
| ------------------------------ | ----------------------- | ------------- |
| GPU transcoding (NVIDIA NVENC) | Supported               | Not available |
| CPU transcoding                | Supported               | Supported     |
| Image size                     | Larger (CUDA libraries) | Smaller       |

Use the lite image by appending `-lite` to your tag:

> **Note:** Setting `TRANSCODE_GPU=true` has no effect in the lite image. GPU transcoding is permanently disabled regardless of environment variables.

---

## Configuration

### LDAP

See [LDAP.md](./docs/LDAP.md) for setup instructions.

### Transcoding (Optional)

Transcoding is off by default. To enable it, set the following environment variables:

```
ENABLE_TRANSCODING=true
TRANSCODE_GPU=true   # optional, NVIDIA only
```

CPU transcoding works out of the box. For NVIDIA GPU transcoding, you only need an NVIDIA GPU on the host. The image handles drivers and toolkit.

**GPU requirements:** NVIDIA GPU with NVENC support.

#### Unraid Setup

1. Install the "NVIDIA Driver" plugin from Apps / Community Applications.
2. Add to the Fireshare container environment:
   ```
   ENABLE_TRANSCODING=true
   TRANSCODE_GPU=true
   NVIDIA_DRIVER_CAPABILITIES=all
   ```
3. Add `--gpus=all` to "Extra Parameters".

#### Encoder Selection

Fireshare automatically selects the best available encoder.

**GPU mode** (`TRANSCODE_GPU=true`):

| Encoder            | Requirement                |
| ------------------ | -------------------------- |
| AV1 (av1_nvenc)    | RTX 40 series or newer     |
| H.264 (h264_nvenc) | GTX 1050 or newer          |
| CPU fallback       | Used if GPU encoding fails |

**CPU mode** (`TRANSCODE_GPU=false`):

| Encoder | Notes                            |
| ------- | -------------------------------- |
| H.264   | Most compatible, faster encoding |
| AV1     | Best compression, slower         |

### Docker Environment Variables

See [EnvironmentVariables.md](./docs/EnvironmentVariables.md) for the full list of available environment variables.

---

## Local Development

**Requirements:** Python 3, Node.js, and npm.

1. Clone the repo:
   ```sh
   git clone https://github.com/ShaneIsrael/fireshare.git
   ```
2. Start backend services from the project root:
   ```sh
   ./run_local.sh
   ```
3. Start the frontend:
   ```sh
   cd app/client
   npm install
   npm start
   ```
4. Open `http://localhost:3000` and sign in with `admin` / `admin`.

---

## Contributing

Contributions are welcome. For larger changes, open an issue first to align on scope.

1. Fork the repository
2. Create a branch from `develop`
3. Commit your changes
4. Rebase on latest `develop`
5. Open a pull request to `develop`

For issues and feature requests, visit the [issue tracker](https://github.com/ShaneIsrael/fireshare/issues).

### Database Changes

If you update models, create a migration and review it before opening a pull request.

---

## Troubleshooting

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for a full guide covering installation issues, playback problems, permission errors, transcoding, LDAP, and more.

---

## Star History

If you like the project, consider giving it a star. It helps increase visibility and supports continued development.

<a href="https://www.star-history.com/?repos=shaneisrael%2Ffireshare&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=shaneisrael/fireshare&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=shaneisrael/fireshare&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=shaneisrael/fireshare&type=date&legend=top-left" />
  </picture>
</a>

---

[card-view]: .github/images/card-view.png
[folders]: .github/images/folders.png
[folders-game]: .github/images/folders-game.png
[edit]: .github/images/edit-details.png
[uploading]: .github/images/uploading.png
