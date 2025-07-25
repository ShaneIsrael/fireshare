FROM node:16.15-slim as client
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY app/client/package.json ./
COPY app/client/package-lock.json ./
COPY app/client/.env.* ./
RUN npm ci --silent
RUN npm install react-scripts@5.0.1 -g --silent && npm cache clean --force;
COPY app/client/ ./
RUN npm run build

FROM python:3.9.23-slim-bullseye
WORKDIR /
RUN apt-get update && apt-get install --no-install-recommends -y \
    nginx nginx-extras supervisor build-essential gcc \
    libc-dev libffi-dev python3-pip ffmpeg python-dev \
    libldap2-dev libsasl2-dev libssl-dev && rm -rf /var/lib/apt/lists/*;
RUN adduser --disabled-password --gecos '' nginx
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log
RUN mkdir /data && mkdir /processed
COPY entrypoint.sh /
COPY app/nginx/prod.conf /etc/nginx/nginx.conf
COPY app/server/ /app/server
COPY migrations/ /migrations
COPY --from=client /app/build /app/build
RUN pip install --no-cache-dir /app/server

ENV FLASK_APP /app/server/fireshare:create_app()
ENV FLASK_ENV production
ENV ENVIRONMENT production
ENV DATA_DIRECTORY /data
ENV VIDEO_DIRECTORY /videos
ENV PROCESSED_DIRECTORY /processed
ENV TEMPLATE_PATH=/app/server/fireshare/templates
ENV ADMIN_PASSWORD admin

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]
