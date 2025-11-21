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

# Install base dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    nginx nginx-extras supervisor build-essential gcc g++ \
    libc-dev libffi-dev python3-pip python-dev \
    libldap2-dev libsasl2-dev libssl-dev \
    wget curl xz-utils ca-certificates gnupg \
    pkg-config yasm nasm git autoconf automake libtool \
    && rm -rf /var/lib/apt/lists/*

# Install NVIDIA Video Codec SDK headers (for NVENC/NVDEC support)
RUN cd /tmp && \
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && \
    make install && \
    cd / && \
    rm -rf /tmp/nv-codec-headers

# Build and install FFmpeg with NVENC, AV1, VP9, and other codec support
RUN cd /tmp && \
    wget -q https://ffmpeg.org/releases/ffmpeg-6.1.tar.xz && \
    tar -xf ffmpeg-6.1.tar.xz && \
    cd ffmpeg-6.1 && \
    # Install codec dependencies (both dev and runtime)
    apt-get update && apt-get install -y --no-install-recommends \
        libx264-dev libx264-163 \
        libx265-dev libx265-192 \
        libvpx-dev libvpx7 \
        libaom-dev libaom3 \
        libopus-dev libopus0 \
        libvorbis-dev libvorbis0a libvorbisenc2 \
        libass-dev libass9 \
        libfreetype6-dev libfreetype6 \
        libmp3lame-dev libmp3lame0 && \
    # Configure FFmpeg with NVENC and codec support
    ./configure \
        --prefix=/usr/local \
        --enable-gpl \
        --enable-version3 \
        --enable-nonfree \
        --enable-nvenc \
        --enable-cuda-nvcc \
        --enable-libnpp \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libvpx \
        --enable-libaom \
        --enable-libopus \
        --enable-libvorbis \
        --enable-libmp3lame \
        --enable-libass \
        --enable-libfreetype \
        --disable-debug \
        --disable-doc \
        --disable-static \
        --enable-shared && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/ffmpeg-* && \
    # Remove only the -dev packages, keep runtime libraries and build tools
    apt-get remove -y \
        libx264-dev libx265-dev libvpx-dev \
        libaom-dev libopus-dev libvorbis-dev \
        libass-dev libfreetype6-dev libmp3lame-dev \
        build-essential gcc g++ pkg-config yasm nasm git autoconf automake libtool && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    # Update library cache again after cleanup
    ldconfig && \
    # Verify FFmpeg installation
    ffmpeg -version && \
    echo "Available NVENC encoders:" && \
    ffmpeg -hide_banner -encoders 2>/dev/null | grep nvenc || echo "Note: NVENC requires NVIDIA drivers at runtime"
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
ENV LD_LIBRARY_PATH /usr/local/lib:$LD_LIBRARY_PATH
ENV PATH /usr/local/bin:$PATH

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]
