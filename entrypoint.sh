#/bin/bash

nginx -g 'daemon on;'

PUID=${PUID:-1000}
PGID=${PGID:-1000}

useradd appuser || true

groupmod -o -g "$PGID" appuser
usermod -o -u "$PUID" appuser

su appuser

echo '
-------------------------------------'
echo "
User uid:    $(id -u appuser)
User gid:    $(id -g appuser)
-------------------------------------
"

chown appuser:appuser $DATA_DIRECTORY
chown appuser:appuser $VIDEO_DIRECTORY
chown appuser:appuser $PROCESSED_DIRECTORY



# Remove any lockfiles on startup
rm $DATA_DIRECTORY/*.lock 2> /dev/null

# Remove job db on start
rm /jobs.sqlite


flask db upgrade
gunicorn --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)" --workers 3 --threads 3 --preload
