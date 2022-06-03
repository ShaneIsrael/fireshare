FROM node:16.15-slim as client
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
    nginx nginx-extras supervisor build-essential \
    gcc libc-dev libffi-dev python3-pip git

RUN adduser --disabled-password --gecos '' nginx
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log 
RUN mkdir /data && mkdir /processed
COPY entrypoint.sh /
COPY app/nginx/prod.conf /etc/nginx/nginx.conf
COPY app/server/ /app/server
COPY migrations/ /migrations
COPY --from=client /app/build /app/build
RUN pip install /app/server

# Install NVENC dependencies
RUN apt-get install -y yasm cmake libtool libc6 libc6-dev unzip wget libnuma1 libnuma-dev
RUN git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git
WORKDIR /nv-codec-headers
RUN make install

# Install FFMPEG
WORKDIR /
RUN git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg/
WORKDIR /ffmpeg
RUN ./configure --enable-nonfree --enable-cuda-nvcc --enable-libnpp --extra-cflags=-I/usr/local/cuda/include --extra-ldflags=-L/usr/local/cuda/lib64 --disable-static --enable-shared
RUN make -j 8
RUN make install


WORKDIR /
ENV FLASK_APP /app/server/fireshare:create_app()
ENV FLASK_ENV production
ENV ENVIRONMENT production
ENV DATA_DIRECTORY /data
ENV VIDEO_DIRECTORY /videos
ENV PROCESSED_DIRECTORY /processed
ENV TEMPLATE_PATH=/app/server/fireshare/templates
ENV ADMIN_PASSWORD admin
ENV NVIDIA_DRIVER_CAPABILITIES=all

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]