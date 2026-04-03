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
    <br />
    <a href="https://v.fireshare.net">Live Demo</a>
    ·
    <a href="https://github.com/ShaneIsrael/fireshare/issues">Report a Bug</a>
    ·
    <a href="https://www.paypal.com/paypalme/shaneisrael">Buy us a Coffee!</a>
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
- [Notifications to Discord and others](#notifications)
- RSS feed for new public videos
- [LDAP support](./LDAP.md)
- Optional [video transcoding with CPU or NVIDIA GPU](#transcoding-optional)

# Navigation

- [Features Overview](#features-overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Demo](#demo)
- [Contributing](#contributing)


<h3 align="center">Dashboard</h3>

---

![card-view][card-view]

<h3 align="center">Automatic Game Organization</h3>

---

![folders][folders]

![folders-game][folders-game]

<h3 align="center">Video Details</h3>

---

![edit][edit]

<h3 align="center">Open Graph Support</h3>

---

<center><img src=".github/images/ogg-data.png" alt="Open graph preview" /></center>

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
  -v $(pwd)/fireshare:/data:rw \
  -v $(pwd)/fireshare_processed:/processed:rw \
  -v /path/to/my_game_clips:/videos:rw \
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

| Environment Variable | Description | Default | Required |
|----------------------|-------------|---------|----------|
| **App Configuration** | | |
| `DOMAIN` | The base URL or domain name where the instance is hosted. This is needed for things like link sharing, and notifications to work properly| |
| `STEAMGRIDDB_API_KEY` | API key for SteamGridDB integration to fetch game metadata and assets. | |
| **Storage** | | |
| `DATA_DIRECTORY` | Absolute path to the directory where application database and metadata are stored. | `$(pwd)/dev_root/dev_data/` | Yes |
| `VIDEO_DIRECTORY` | Absolute path to the source directory containing raw video files. | `$(pwd)/dev_root/dev_videos/` | Yes |
| `PROCESSED_DIRECTORY` | Absolute path to the directory where optimized/transcoded videos are stored. | `$(pwd)/dev_root/dev_processed/` | Yes |
| `THUMBNAIL_VIDEO_LOCATION` | The timestamp (in seconds) used to capture the video thumbnail preview. | `50` |
| **Security** | | |
| `ADMIN_USERNAME` | The username for the initial administrative account. | `admin` | Yes |
| `ADMIN_PASSWORD` | The password for the initial administrative account. | `admin` | Yes |
| LDAP | See [LDAP.md](./LDAP.md) for full LDAP configuration instructions
| **Integrations** | | |
| `DISCORD_WEBHOOK_URL` | Discord Server/Channel webhook URL used to send a notification of a new fireshare upload. [See Docs](#discord) | |
| `GENERIC_WEBHOOK_URL` | Notification Integration, to send a generic webhook POST. Has to be used with `GENERIC_WEBHOOK_PAYLOAD` to work. [See Docs](#generic-webhook) | |
| `GENERIC_WEBHOOK_PAYLOAD` | JSON Based payload that will be POSTed to webhook url. Please [See Docs](#generic-webhook) for full example and payload options | |

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

### Playback Problems

If playback is unstable:

- Reduce source file size/bitrate
- Verify upload bandwidth on the host
- Prefer browser-friendly formats (MP4/H.264 is safest)
- Consider enabling transcoding for better compatibility
- Test in another browser to rule out codec/browser limitations

### Upload Fails Behind Nginx

Increase proxy limits/timeouts, for example:

```nginx
client_max_body_size 0;
proxy_read_timeout 999999s;
```

If you use a different proxy, apply equivalent upload size and timeout settings there.


# Features Overview

## Notifications
Firesahre has a limited setup for notifications when a new video is uploaded. Primarily Discord and a Generic Webhook. Since Gaming and Discord is so ubiquitous it makes sense to have a dedicated Discord channel just for clip highlights to share with your friends. For this reason there is the Discord integration, to notify a channel when a new video has been uploaded. A similar premise has been made for the Generic Webhook. There are many notification systems, and to program them all would be an undertaking, so with the Generic Webhook, this allows what should be a means to still notify any system that can take a HTTP-POST and a JSON payload for webhooks.
### Discord
The Discord Notification integration is very simple, you just add the webhook URL to the channel you want it to be send to. You can learn how to generate a webhook URL for your Discord server and channel here: [Discord - Webhook Documentation](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

Docker ENV example:

`DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz'`

### Generic Webhook
For any other service you would want to send a notification to, that also supports a generic JSON payload-based webhook. Please note, you will have to set not only the POST URL but also the JSON Payload. If you do not know what this is you can learn more here:

Basically, you will need to enter valid JSON data into the "Generic Webhook JSON Payload" box on the integrations page, with the JSON payload that will work for your specific app or service. Please consult the webhook documentation for the service you are wanting to use, if they offer webhook support. For instance, the JSON data could look something like the following:

```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare",
}
```

There is one variable avaliable that can be used in the JSON payload that can inject the video perma link. This could be useful that when you see the notification on your service you have a direct link to this new video. This can be achived using this exact format anywhere it makes sense: `[video_url]` 

Example:
```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare [video_url]",
}
```
What this will look like send to your service as a json payload:

```
{
    "Title": "Fireshare",
    "message": "New Video Uploaded to Fireshare https://yourdomain.com/w/c415d34530d15b2892fa4a4e037b6c05",
}
```

**Syntax Note**

Please keep in mind that the json payload is not a simple string, it has key/value pairs that have string in it. This means these strings are usually wrapped in either single quotes `'` or double `"`. Meaning if you are just pasting your json via the gui, just pick one and fireshare will take care of the rest. However for Docker ENVs you need to make sure you are choosing one for the total encapuslation of the json, and then another for the actual internal json strings. 

Example:

```
GENERIC_WEBHOOK_PAYLOAD='{"Title": "Fireshare", "message": "New Video Uploaded to Fireshare [video_url]"}'
#Notice this is a sinlge line ^
```


**Full Docker ENV example:**

```
GENERIC_WEBHOOK_URL='https://webhook.com/at/endpoint12345'
GENERIC_WEBHOOK_PAYLOAD='{"Title": "Fireshare", "message": "New Video Uploaded to Fireshare [video_url]"}'
# You must have both ENVs filled in for Generic Webhook to work
```

---

[card-view]: .github/images/card-view.png
[folders]: .github/images/folders.png
[folders-game]: .github/images/folders-game.png
[edit]: .github/images/edit-details.png