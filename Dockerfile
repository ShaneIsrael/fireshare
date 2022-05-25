FROM node:18.2-slim as client
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY app/client/package.json ./
COPY app/client/package-lock.json ./
RUN npm ci --silent
RUN npm install react-scripts@5.0.1 -g --silent
COPY app/client/ ./
RUN npm run build

FROM python:3.9-slim-buster
WORKDIR /
RUN apt-get update && apt-get install -y \
    nginx nginx-extras supervisor build-essential gcc libc-dev libffi-dev python3-pip ffmpeg
RUN adduser --disabled-password --gecos '' nginx
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log 
RUN mkdir /data
COPY entrypoint.sh /
COPY app/nginx/prod.conf /etc/nginx/nginx.conf
COPY app/server/ /app/server
COPY --from=client /app/build /app/build
RUN pip install /app/server

ENV FLASK_ENV production
ENV DATA_DIRECTORY /data
ENV VIDEO_DIRECTORY /videos
ENV PROCESSED_DIRECTORY /processed
ENV ADMIN_PASSWORD admin

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]