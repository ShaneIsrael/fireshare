# Upload Tokens

Upload tokens let a script, a capture box, or any other tool push videos and
images into Fireshare without a password and without a browser session.

A token belongs to one user and carries nothing of its own: every request re-reads
that account, so the upload lands with the owner's name on it and obeys whatever
permissions they hold *at that moment*. Take away their `upload` permission,
disable the account, or delete it, and every token they made stops working on the
next call.

Tokens never expire. They end when you delete or regenerate them.

## Creating a token

Any account with the **Upload** permission (and every administrator) can make one:

**Settings → Security → Upload Tokens → Create token**

Name it after the machine or tool that will use it, so you know which one to
revoke later. The secret is shown **once**, on creation — Fireshare stores only a
sha256 of it and cannot show it again. If you lose it, regenerate the token to get
a new secret; the old one stops working immediately.

Each account may hold up to 20 tokens.

## Uploading

```
POST /api/upload/token
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

One file per request. Whether it is filed as a video or an image is decided by its
extension — `mp4`, `m4v`, `mov`, `webm` for video; `jpg`, `jpeg`, `png`, `webp`,
`gif` for images. Anything else is rejected with a 400.

| Field | Required | Description |
| --- | --- | --- |
| `file` | yes | The media to upload. |
| `title` | no | Title for the item. Without it, Fireshare uses the filename. |
| `folder` | no | Destination folder under the media root. Defaults to the configured upload folder. |
| `game_id` | no | Fireshare game id to link the upload to. |
| `game` | no | Game *name*, matched case-insensitively against games already in the library. Ignored when `game_id` is given; a name that matches nothing is a 400. |
| `tag_ids` | no | Comma-separated tag ids. |

The token goes in a header, never a query string — a URL ends up in proxy access
logs and shell history. `X-Fireshare-Token: <token>` works as an alternative to
`Authorization: Bearer`.

```bash
curl -X POST https://fireshare.example.com/api/upload/token \
  -H "Authorization: Bearer fsk_your_token_here" \
  -F "file=@clip.mp4" \
  -F "title=Ace on Ascent" \
  -F "folder=uploads" \
  -F "game=VALORANT"
```

A successful upload returns `201` and describes where the file landed:

```json
{
  "status": "accepted",
  "media_type": "video",
  "filename": "clip.mp4",
  "folder": "uploads"
}
```

`accepted` rather than `complete`: the file is on disk and Fireshare has started
scanning it in the background, exactly as it does for a browser upload. The item
appears in the library once that finishes.

### Responses

| Status | Meaning |
| --- | --- |
| `201` | Stored; scanning has started. |
| `400` | No file, unsupported extension, or an unknown game name. |
| `401` | Missing, unknown, or revoked token. |
| `409` | This video is already in the library; the body identifies the existing one. |
| `413` | The file is over the demo-mode upload limit (demo instances only). |
| `429` | Too many invalid tokens from this address. Retry after the `Retry-After` header. |
| `503` | An image was uploaded but `IMAGE_DIRECTORY` is not configured. |

## Uploading in chunks

Large videos can go up a piece at a time instead of in one request:

```
POST /api/upload/token/chunked
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Send each chunk as its own request, in any order, using the same `checkSum`
throughout. Every request but the last answers `202`; whichever one completes the
set reassembles the file and answers `201` exactly as `/api/upload/token` does —
including the `409` when the finished video turns out to be a duplicate.

| Field | Required | Description |
| --- | --- | --- |
| `blob` | yes | This chunk's bytes. |
| `chunkPart` | yes | 1-based index of this chunk. |
| `totalChunks` | yes | How many chunks make up the file (max 20000). |
| `checkSum` | yes | A caller-chosen id grouping the chunks. `A-Z a-z 0-9 _ -` only. |
| `fileName` | yes | The finished file's name; its extension picks video or image. |
| `fileSize` | yes | The finished file's size in bytes, verified after reassembly. |

`title`, `folder`, `game_id`, `game` and `tag_ids` work as they do for a
single-shot upload — send them with whichever chunk you like, but sending them
with every chunk is simplest, since you cannot know in advance which request will
be the one that completes the set.

Pick a `checkSum` that is unique per upload; two files sharing one will have their
chunks mixed together. A content hash of the file is the obvious choice, and is
where the name comes from.

If an upload is abandoned part way, the orphaned `.partNNNN` files are swept on
the next Fireshare restart.

```bash
# 8 MiB chunks, in order
split -b 8388608 -d -a 4 big.mp4 chunk_
total=$(ls chunk_* | wc -l | tr -d ' ')
size=$(wc -c < big.mp4 | tr -d ' ')
id=$(shasum -a 256 big.mp4 | cut -c1-32)

i=1
for c in chunk_*; do
  curl -X POST https://fireshare.example.com/api/upload/token/chunked \
    -H "Authorization: Bearer fsk_your_token_here" \
    -F "blob=@$c" \
    -F "chunkPart=$i" \
    -F "totalChunks=$total" \
    -F "checkSum=$id" \
    -F "fileName=big.mp4" \
    -F "fileSize=$size" \
    -F "title=A long clip"
  i=$((i + 1))
done
```

## Listing folders and games

To offer real choices rather than making a user type a folder name from memory:

```bash
curl https://fireshare.example.com/api/upload/token/options \
  -H "Authorization: Bearer fsk_your_token_here"
```

```json
{
  "default_folder": "uploads",
  "folders": {
    "video": ["uploads", "clips"],
    "image": ["uploads", "screenshots"]
  },
  "games": [
    { "id": 3, "name": "VALORANT", "steamgriddb_id": 12345 }
  ]
}
```

Every game in the library is listed, including ones with nothing linked to them
yet — `/api/games` hides those, but they are exactly the games an upload might be
the first to use, and the `game` field already accepts them.

## Checking a token

`GET /api/upload/token` with the same header validates a token without uploading
anything, which is useful when setting a tool up:

```bash
curl https://fireshare.example.com/api/upload/token \
  -H "Authorization: Bearer fsk_your_token_here"
```

```json
{
  "ok": true,
  "username": "shane",
  "default_folder": "uploads",
  "images_enabled": true,
  "supported_video_types": ["m4v", "mov", "mp4", "webm"],
  "supported_image_types": ["gif", "jpeg", "jpg", "png", "webp"]
}
```

## How this differs from public uploads

`allow_public_upload` opens `/api/upload/public` to anyone who can reach the
instance, drops everything into the public upload folder, and attributes nothing.
Upload tokens are the opposite: the caller is a known account, the upload is
attributed, folder and metadata are theirs to choose, and access is revoked by
deleting one token rather than by turning a feature off for everybody.

Leaving public uploads disabled and handing out tokens is the safer arrangement
for anything automated.

## Keeping tokens safe

* Treat a token like a password. Anyone holding it can upload as you.
* Give each tool its own token, so revoking one does not break the others.
* Fireshare never logs the secret. It logs the visible prefix (`fsk_xxxxxxxx`)
  when a token is created, regenerated, or deleted.
* Serve Fireshare over HTTPS if tokens cross a network you do not control — a
  bearer token in a plain HTTP request is readable in transit.
* Regenerate immediately if a token may have leaked; the old secret dies the
  moment the new one is issued.
