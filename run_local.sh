#Setup Virtual Environment
python -m venv venv
source venv/bin/activate
python -m pip install -r app/server/requirements.txt

nginx -s stop

DEV_TEMPLATE_CONF=$(pwd)/app/nginx/dev.template.conf
DEV_CONF=$(pwd)/app/nginx/dev.conf

cp $DEV_TEMPLATE_CONF $DEV_CONF

DEV_BUILD=$(pwd)/app/client/build
DEV_DATA=$(pwd)/dev_root/dev_data
DEV_PROCESSED=$(pwd)/dev_root/dev_processed
# NGINX_CONF=$(nginx -V 2>&1 | grep -o '\-\-conf-path=\(.*conf\)' | cut -d '=' -f2)
NGINX_CONF_FOLDER=/usr/local/etc/nginx

mkdir -p $DEV_DATA/nginx/log

sed -i "" "s|root /app/build;|root   $DEV_BUILD;|" $DEV_CONF
sed -i "" "s|root /processed/;|root   $DEV_PROCESSED;|" $DEV_CONF
sed -i "" "s|root /processed/video_links/;|root   $DEV_PROCESSED/video_links/;|" $DEV_CONF
sed -i "" "s|access_log  /var/log/nginx/access.log|access_log   $DEV_DATA/nginx/log/access.log|" $DEV_CONF
sed -i "" "s|error_log  /var/log/nginx/error.log|error_log  $DEV_DATA/nginx/log/error.log|" $DEV_CONF
sed -i "" "s|pid        /var/run/nginx.pid;|pid        $DEV_DATA/nginx/nginx.pid;|" $DEV_CONF

cp $DEV_CONF $NGINX_CONF_FOLDER/nginx.conf

nginx

source .env.dev
flask run --with-threads