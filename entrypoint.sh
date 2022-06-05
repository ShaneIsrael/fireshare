#/bin/bash

# Remove any lockfiles on startup
rm $DATA_DIRECTORY/*.lock

nginx -g 'daemon on;'
flask db upgrade
gunicorn --bind=127.0.0.1:5000 "fireshare:create_app(init_schedule=True)" --workers 3 --threads 3 --preload
