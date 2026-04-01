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


# Start nginx as ROOT (it will drop to nginx user automatically)
echo "Starting nginx..."
nginx -g 'daemon on;'
echo "Nginx started successfully"

# Ensure PATH and LD_LIBRARY_PATH are set
export PATH=/usr/local/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/lib:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}

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
    gunicorn --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)" \
    --workers 3 --threads 3 --preload
