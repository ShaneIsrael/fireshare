#/bin/bash
nginx -g 'daemon on;'
gunicorn --bind=127.0.0.1:5000 "fireshare:create_app()" --workers 3 --threads 3
