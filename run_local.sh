nginx -s stop

DEV_TEMPLATE_CONF=$(pwd)/app/nginx/dev.template.conf
DEV_CONF=$(pwd)/app/nginx/dev.conf

cp $DEV_TEMPLATE_CONF $DEV_CONF

DEV_BUILD=$(pwd)/app/client/build
# NGINX_CONF=$(nginx -V 2>&1 | grep -o '\-\-conf-path=\(.*conf\)' | cut -d '=' -f2)
NGINX_CONF_FOLDER=/usr/local/etc/nginx

sed -i "" "s|root   html;|root   $DEV_BUILD;|" $DEV_CONF

cp $DEV_CONF $NGINX_CONF_FOLDER

nginx -c $NGINX_CONF_FOLDER/dev.conf

source .env.dev
flask run --with-threads