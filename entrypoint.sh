#/bin/bash
mkdir -p /processed/
nginx -g 'daemon on;'
gunicorn --bind=0.0.0.0:5000 "fireshare:create_app()" --workers 1 --threads 12
