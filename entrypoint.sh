#/bin/bash

nginx -g 'daemon on;'

PUID=${PUID:-1000}
PGID=${PGID:-1000}

useradd appuser || true

groupmod -o -g "$PGID" appuser
usermod -o -u "$PUID" appuser

chown -R appuser:appuser $DATA_DIRECTORY
chown -R appuser:appuser $VIDEO_DIRECTORY
chown -R appuser:appuser $PROCESSED_DIRECTORY

su appuser

echo '
-------------------------------------'
echo "
User uid:    $(id -u appuser)
User gid:    $(id -g appuser)
-------------------------------------
"

# Remove any lockfiles on startup
runuser -u appuser -- rm $DATA_DIRECTORY/*.lock 2> /dev/null

# Remove job db on start
runuser -u appuser -- rm /jobs.sqlite


runuser -u appuser -- flask db upgrade
runuser -u appuser -- gunicorn --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)" --workers 3 --threads 3 --preload
