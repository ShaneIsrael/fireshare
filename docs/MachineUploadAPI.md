# Machine Publishing API

FireShare's versioned machine API lets trusted applications publish videos without automating a
browser login or enabling public uploads. It is disabled until a machine token is configured.

## Generate and configure a token

Generate a 256-bit token with FireShare:

```bash
fireshare generate-machine-token
```

To create an owner-only file without printing the token:

```bash
fireshare generate-machine-token --output ./secrets/machine-api-token
```

The command refuses to overwrite an existing file. An equivalent host command is:

```bash
umask 077
openssl rand -hex 32 > ./secrets/machine-api-token
```

For Docker Compose, mount the file as a secret:

```yaml
services:
  fireshare:
    environment:
      - MACHINE_API_TOKEN_FILE=/run/secrets/machine_api_token
      - MACHINE_UPLOAD_MAX_MB=10240
      - MACHINE_UPLOAD_INGEST_TIMEOUT_SECONDS=900
    secrets:
      - machine_api_token

secrets:
  machine_api_token:
    file: ./secrets/machine-api-token
```

`MACHINE_API_TOKEN` can supply the token directly, but environment values may be visible through
container inspection. Configure only one token source. Restart FireShare after changing it.

FireShare supports one active machine token in this API version. To rotate it, generate a new
secret, update the publishing client, replace the mounted secret, and restart FireShare.

Use the API only over HTTPS. FireShare may terminate TLS itself or run behind a trusted HTTPS
reverse proxy.

## Authentication

Every request requires:

```text
Authorization: Bearer <token>
```

Browser cookies do not authenticate machine routes. Missing or invalid credentials return `401`
with `WWW-Authenticate: Bearer`. If no token is configured, the routes return `503`.

## List upload folders

`GET /api/v1/folders`

```bash
curl --fail-with-body \
  -H "Authorization: Bearer <token>" \
  "https://clips.example.com/api/v1/folders"
```

The response identifies the configured default and existing top-level upload directories:

```json
{
  "default_folder": "uploads",
  "folders": [
    {"name": "clips"},
    {"name": "vice"}
  ]
}
```

Folder names are sorted case-insensitively and contain only letters, numbers, underscores, and
hyphens. Hidden and internal directories are omitted. The response never includes filesystem paths.
This list is advisory: clients may still submit a new valid folder name to the upload endpoint, and
FireShare creates that directory when storing the upload. The configured default is returned even
when its directory does not exist yet.

## Publish a video

`POST /api/v1/uploads`

Headers:

```text
Authorization: Bearer <token>
Idempotency-Key: <unique publication attempt>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Required | Description |
|---|---|---|
| `file` | Yes | Non-empty `.mp4`, `.m4v`, `.mov`, or `.webm` video |
| `title` | No | Title up to 256 characters; defaults to the filename stem |
| `folder` | No | Letters, numbers, underscores, and hyphens; defaults to the admin upload folder |
| `game_id` | No | Existing FireShare game ID |
| `tag_ids` | No | Comma-separated existing tag IDs |
| `private` | No | Exact `true` or `false`; defaults to FireShare's configured video privacy |

Example:

```bash
curl --fail-with-body \
  -X POST "https://clips.example.com/api/v1/uploads" \
  -H "Authorization: Bearer ${FIRESHARE_TOKEN}" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "file=@clip.mp4" \
  -F "title=Round win" \
  -F "folder=vice" \
  -F "game_id=42" \
  -F "tag_ids=3,8" \
  -F "private=false"
```

A newly accepted upload returns `202`, `Location`, and `Retry-After`:

```json
{
  "job_id": "e2af6f51c9b14cb090f1f22923b455ea",
  "video_id": "6f84a149ac3d66d11f934fcbd2f80b70",
  "public_url": "https://clips.example.com/w/6f84a149ac3d66d11f934fcbd2f80b70",
  "path": "/w/6f84a149ac3d66d11f934fcbd2f80b70",
  "status": "processing",
  "private": false,
  "title": "Round win",
  "deduplicated": false,
  "created_at": "2026-07-26T01:30:00Z",
  "updated_at": "2026-07-26T01:30:00Z",
  "error": null
}
```

The URL is deterministic as soon as the upload is stored. If `private` is true, the URL still
uses normal FireShare viewer authentication and privacy rules.

## Idempotency and retries

An idempotency key identifies one immutable publication request, including the file and metadata.
Use a new UUID for each publish action. If a clip is edited, use a new key.

- Same key and same request: returns the same job.
- Same key with changed content or metadata: `409 idempotency_conflict`.
- Same content and metadata with a new key: maps to the existing job without another file.
- Same FireShare first-16-MiB ID but different full file content: `409 video_id_collision`.
- A matching retry of a failed job requeues that job.

This API version retries an interrupted upload from the beginning. A future endpoint will add
durable resumable chunks.

FireShare streams multipart file storage into a hidden staging area on `VIDEO_DIRECTORY`, enforces
the configured request and exact file-byte limits while reading, and atomically moves completed
uploads into place. This avoids consuming the container's writable layer for large request bodies.

## Check status

`GET /api/v1/uploads/<job_id>`

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${FIRESHARE_TOKEN}" \
  "https://clips.example.com/api/v1/uploads/e2af6f51c9b14cb090f1f22923b455ea"
```

Statuses:

| Status | Meaning |
|---|---|
| `accepted` | File and job are durable; scanner launch is pending |
| `processing` | Scanner launched; the original is not ready yet |
| `ready` | Original video and requested metadata/privacy are ready; derivatives may continue |
| `failed` | Launch/scanning failed, the scanner exited after an ingest timeout, or a previously ready video was removed |

Status lookup reconciles durable FireShare records, so it recovers correctly if the web worker that
accepted the upload is recycled. FireShare also reconciles nonterminal machine jobs every minute
while the API is enabled, including when periodic library scanning is disabled. The ingest timeout
does not remove an upload while its matching scanner process is still running. If FireShare's video
records are administratively reset, status becomes `failed` without deleting retained source media;
a matching replay re-ingests it.

## HTTP status codes

| Status | Meaning |
|---|---|
| `200` | Successful folder listing, existing ready/deduplicated job, or status lookup |
| `202` | New, requeued, or existing nonterminal job |
| `400` | Malformed header, form data, filename, or metadata |
| `401` | Missing or invalid token |
| `404` | Unknown job ID |
| `409` | Idempotency, metadata, folder, or content-ID conflict |
| `413` | File exceeds `MACHINE_UPLOAD_MAX_MB` |
| `415` | Unsupported extension |
| `422` | Referenced game or tag does not exist |
| `500` | Scanner launch or persistence failure |
| `503` | Machine API is not configured |
| `507` | Insufficient storage |

Errors use a stable JSON envelope:

```json
{
  "error": {
    "code": "idempotency_conflict",
    "message": "The idempotency key was already used for a different request."
  }
}
```

Tokens, internal file paths, command lines, and exception text are never included.
