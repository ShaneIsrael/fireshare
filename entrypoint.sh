#!/bin/bash
set -e

# ── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo "  ▸ $*"; }
warn()    { >&2 echo "  ⚠ $*"; }
section() {
    local title="  ── $* "
    local pad=$(( 71 - ${#title} ))
    printf '\n%s' "$title"
    [ "$pad" -gt 0 ] && printf '─%.0s' $(seq 1 "$pad")
    printf '\n\n'
}

# ── Banner ────────────────────────────────────────────────────────────────────
if [ "${FIRESHARE_LITE}" != "true" ]; then
    echo ""
    echo "  ███████╗██╗██████╗ ███████╗███████╗██╗  ██╗ █████╗ ██████╗ ███████╗"
    echo "  ██╔════╝██║██╔══██╗██╔════╝██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝"
    echo "  █████╗  ██║██████╔╝█████╗  ███████╗███████║███████║██████╔╝█████╗  "
    echo "  ██╔══╝  ██║██╔══██╗██╔══╝  ╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  "
    echo "  ██║     ██║██║  ██║███████╗███████║██║  ██║██║  ██║██║  ██║███████╗"
    echo "  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝"
    echo "  ─────────────────────────────────────────────────────────────────────"
    echo ""
fi

# ── User / permissions ────────────────────────────────────────────────────────
PUID=${PUID:-1000}
PGID=${PGID:-1000}

useradd appuser 2>/dev/null || true
groupmod -o -g "$PGID" appuser
usermod  -o -u "$PUID" appuser

chown_fail=0
if ! chown -R appuser:appuser "$DATA_DIRECTORY" 2>/dev/null; then
    warn "Could not chown data directory ($DATA_DIRECTORY) to $PUID:$PGID"
    warn "Files created by Fireshare may not have the expected ownership"
    warn "Ensure the container has permissions to access this directory"
    chown_fail=1
fi
if ! chown -R appuser:appuser "$PROCESSED_DIRECTORY" 2>/dev/null; then
    warn "Could not chown processed directory ($PROCESSED_DIRECTORY) to $PUID:$PGID"
    warn "Files created by Fireshare may not have the expected ownership"
    warn "Ensure the container has permissions to access this directory"
    chown_fail=1
fi
[ $chown_fail -eq 1 ] && warn "One or more chown operations failed — continuing startup"

log "UID=$(id -u appuser)  GID=$(id -g appuser)"

# ── Mount validation ──────────────────────────────────────────────────────────
missing_mounts=0
for mount_path in "$DATA_DIRECTORY" "$VIDEO_DIRECTORY" "$PROCESSED_DIRECTORY"; do
    if [ -n "$mount_path" ] && ! mountpoint -q "$mount_path" 2>/dev/null; then
        warn "Required volume not mounted at $mount_path"
        missing_mounts=1
    fi
done
if [ "$missing_mounts" -eq 1 ]; then
    warn "Fireshare cannot start without /data, /videos, and /processed mounted. Exiting."
    exit 1
fi
if [ -n "$IMAGE_DIRECTORY" ] && ! mountpoint -q "$IMAGE_DIRECTORY" 2>/dev/null; then
    printf "  \033[33m▸ No volume mounted at %s — uploaded images will not persist\033[0m\n" "$IMAGE_DIRECTORY"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -f "$DATA_DIRECTORY"/*.lock 2>/dev/null || true
rm -f "$DATA_DIRECTORY/jobs.sqlite" 2>/dev/null || true

# ── Demo mode ─────────────────────────────────────────────────────────────────
DEMO_MODE=${DEMO_MODE:-false}
DEMO_MODE_DELETE_ALL=${DEMO_MODE_DELETE_ALL:-false}
if [ "$DEMO_MODE" = "true" ] && [ "$DEMO_MODE_DELETE_ALL" = "true" ]; then
    section "Demo Reset"
    log "DEMO_MODE_DELETE_ALL — wiping all data"
    for dir in "$DATA_DIRECTORY" "$PROCESSED_DIRECTORY" "$VIDEO_DIRECTORY" "$IMAGE_DIRECTORY"; do
        if [ -n "$dir" ] && [ -d "$dir" ]; then
            log "Wiping $dir"
            find "$dir" -mindepth 1 -delete
        fi
    done
    log "Wipe complete"
fi

# ── Analytics injection ───────────────────────────────────────────────────────
if [ -n "$ANALYTICS_TRACKING_SCRIPT" ]; then
    section "Analytics"
    log "Injecting tracking script into index.html"
    python3 - "$ANALYTICS_TRACKING_SCRIPT" <<'EOF'
import sys, re
script = sys.argv[1].strip()
if not script.startswith('<'):
    script = '<' + script
script = re.sub(r'/?script>?$', '', script, flags=re.IGNORECASE).rstrip('/')
script = script.rstrip() + '></script>'
path = '/app/build/index.html'
with open(path, 'r') as f:
    content = f.read()
content = content.replace('</head>', script + '</head>', 1)
with open(path, 'w') as f:
    f.write(content)
EOF
    log "Analytics script injected"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
section "Nginx"
FIRESHARE_PORT=${FIRESHARE_PORT:-80}
log "Configuring nginx to listen on port ${FIRESHARE_PORT}"
sed "s/__FIRESHARE_PORT__/${FIRESHARE_PORT}/" \
    /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
log "Starting nginx"
nginx -g 'daemon on;'
log "Nginx ready"

# ── Environment ───────────────────────────────────────────────────────────────
export PATH=/opt/python3.14/bin:/usr/local/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/lib:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}

# The placeholder that shipped uncommented in docker-compose.yml counts as unset.
# It signs the session and remember-me cookies, so anyone who had read it in the
# public repo could forge an admin cookie against an instance still carrying it.
if [ "$SECRET_KEY" = "replace_this_with_some_random_string" ]; then
    warn "SECRET_KEY is still the example value from docker-compose.yml — ignoring it and using a generated key instead."
    warn "Remove that line from your compose file; a key is generated and kept in /data automatically."
    SECRET_KEY=""
fi

# Kept in the data directory rather than regenerated per boot, so a restart does
# not sign every existing session out.
SECRET_KEY_FILE="$DATA_DIRECTORY/.secret_key"
if [ -z "$SECRET_KEY" ]; then
    if [ -s "$SECRET_KEY_FILE" ]; then
        SECRET_KEY=$(cat "$SECRET_KEY_FILE")
        log "Loaded persisted SECRET_KEY from $SECRET_KEY_FILE"
    else
        SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
        if (umask 077 && printf '%s' "$SECRET_KEY" > "$SECRET_KEY_FILE") 2>/dev/null; then
            chown appuser:appuser "$SECRET_KEY_FILE" 2>/dev/null || true
            log "SECRET_KEY not set — generated one and saved it to $SECRET_KEY_FILE"
        else
            warn "SECRET_KEY not set and $SECRET_KEY_FILE is not writable — using an ephemeral key; sessions will not survive a restart."
        fi
    fi
fi
export SECRET_KEY

# ── Database ──────────────────────────────────────────────────────────────────
section "Database"
log "Running migrations"
gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" flask db upgrade
log "Migrations complete"

# ── Game assets ───────────────────────────────────────────────────────────────
section "Game Assets"
log "Running asset migration"
gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" fireshare migrate-game-assets
log "Asset migration complete"

# ── Boomerang previews (first boot only) ──────────────────────────────────────
BOOMERANG_FLAG="$DATA_DIRECTORY/.boomerangs_generated"
if [ ! -f "$BOOMERANG_FLAG" ]; then
    section "First Boot"
    log "Generating boomerang previews"
    gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" python -m fireshare.cli create-boomerang-posters || true
    touch "$BOOMERANG_FLAG"
    log "Boomerang generation complete"
fi

# ── Application ───────────────────────────────────────────────────────────────
section "Application"
log "Starting gunicorn  (UID=$PUID  GID=$PGID)"
echo ""

exec gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" \
    gunicorn --config /app/server/gunicorn.conf.py \
    --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)"
