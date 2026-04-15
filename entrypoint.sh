#!/bin/bash
set -e

echo "=== Fireshare Startup ==="

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create user if it doesn't exist
useradd appuser 2>/dev/null || true

# Update user and group IDs
groupmod -o -g "$PGID" appuser
usermod -o -u "$PUID" appuser

# Set ownership of directories
chown_fail=0
if ! chown -R appuser:appuser "$DATA_DIRECTORY" 2>/dev/null; then
    >&2 echo "WARNING: Could not chown the data directory ($DATA_DIRECTORY) to $PUID:$PGID."
    >&2 echo "  Files created by Fireshare may not have the expected ownership."
    >&2 echo "  Make sure the container has permissions to access this directory."
    chown_fail=1
fi
if ! chown -R appuser:appuser "$PROCESSED_DIRECTORY" 2>/dev/null; then
    >&2 echo "WARNING: Could not chown the processed directory ($PROCESSED_DIRECTORY) to $PUID:$PGID."
    >&2 echo "  Files created by Fireshare may not have the expected ownership."
    >&2 echo "  Make sure the container has permissions to access this directory."
    chown_fail=1
fi
if [ $chown_fail -eq 1 ]; then
    >&2 echo "NOTE: One or more chown operations failed. Continuing startup..."
fi

echo '-------------------------------------'
echo "User uid:      $(id -u appuser)"
echo "User gid:      $(id -g appuser)"
echo '-------------------------------------'

# Remove any lockfiles on startup
rm -f $DATA_DIRECTORY/*.lock 2>/dev/null || true
rm -f $DATA_DIRECTORY/jobs.sqlite 2>/dev/null || true

# Demo mode: complete data reset when DEMO_MODE_DELETE_ALL is enabled
DEMO_MODE=${DEMO_MODE:-false}
DEMO_MODE_DELETE_ALL=${DEMO_MODE_DELETE_ALL:-false}
if [ "$DEMO_MODE" = "true" ] && [ "$DEMO_MODE_DELETE_ALL" = "true" ]; then
    echo "DEMO_MODE_DELETE_ALL: wiping all data..."
    for dir in "$DATA_DIRECTORY" "$PROCESSED_DIRECTORY" "$VIDEO_DIRECTORY" "$IMAGE_DIRECTORY"; do
        if [ -n "$dir" ] && [ -d "$dir" ]; then
            echo "  Wiping $dir"
            find "$dir" -mindepth 1 -delete
        fi
    done
    echo "DEMO_MODE_DELETE_ALL: wipe complete"
fi


# Inject analytics tracking script into index.html if set
if [ -n "$ANALYTICS_TRACKING_SCRIPT" ]; then
    echo "Injecting analytics tracking script into index.html..."
    python3 - "$ANALYTICS_TRACKING_SCRIPT" <<'EOF'
import sys, re
script = sys.argv[1].strip()
# Normalize: some environments (e.g. Unraid) strip angle brackets from env values
if not script.startswith('<'):
    script = '<' + script
# Remove any mangled closing tag remnant (e.g. /script, /script>, /Script)
script = re.sub(r'/?script>?$', '', script, flags=re.IGNORECASE).rstrip('/')
script = script.rstrip() + '></script>'
path = '/app/build/index.html'
with open(path, 'r') as f:
    content = f.read()
content = content.replace('</head>', script + '</head>', 1)
with open(path, 'w') as f:
    f.write(content)
print("Analytics tracking script injected: " + script)
EOF
fi

# Start nginx as ROOT (it will drop to nginx user automatically)
echo "Starting nginx..."
nginx -g 'daemon on;'
echo "Nginx started successfully"

# Ensure PATH and LD_LIBRARY_PATH are set
export PATH=/usr/local/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/lib:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}

# Generate a random SECRET_KEY if not provided
if [ -z "$SECRET_KEY" ]; then
    export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo "SECRET_KEY not set, generated a random key for this session"
fi

# Run migrations as appuser
echo "Running database migrations..."
gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" flask db upgrade

echo "Database migrations complete"

# Generate boomerang previews once on first boot
BOOMERANG_FLAG="$DATA_DIRECTORY/.boomerangs_generated"
if [ ! -f "$BOOMERANG_FLAG" ]; then
    echo "First boot: generating boomerang previews..."
    gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" python -m fireshare.cli create-boomerang-posters || true
    touch "$BOOMERANG_FLAG"
    echo "Boomerang generation complete"
fi

# Start gunicorn as appuser via gosu (drops from root to PUID:PGID)
echo "Starting gunicorn as appuser ($PUID:$PGID)..."
exec gosu appuser env PATH="$PATH" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" \
    gunicorn --config /app/server/gunicorn.conf.py \
    --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)"
