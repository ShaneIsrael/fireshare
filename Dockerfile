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

# Install NVIDIA Video Codec SDK headers for NVENC/NVDEC support
RUN cd /tmp && \
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/nv-codec-headers

# Install codec library dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libaom-dev \
    libopus-dev \
    libvorbis-dev \
    libass-dev \
    libfreetype6-dev \
    libmp3lame-dev && \
    rm -rf /var/lib/apt/lists/*

# Download and extract FFmpeg source
RUN cd /tmp && \
    wget -q https://ffmpeg.org/releases/ffmpeg-6.1.tar.xz && \
    tar -xf ffmpeg-6.1.tar.xz

# Configure FFmpeg with explicit PKG_CONFIG_PATH
RUN cd /tmp/ffmpeg-6.1 && \
    PKG_CONFIG_PATH="/usr/local/lib/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig" \
    ./configure \
        --prefix=/usr/local \
        --extra-cflags="-I/usr/local/include" \
        --extra-ldflags="-L/usr/local/lib" \
        --enable-gpl \
        --enable-version3 \
        --enable-nonfree \
        --enable-ffnvcodec \
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
        --disable-doc || { cat /tmp/ffmpeg-6.1/ffbuild/config.log; exit 1; }

# Build FFmpeg
RUN cd /tmp/ffmpeg-6.1 && make -j$(nproc)

# Install FFmpeg
RUN cd /tmp/ffmpeg-6.1 && make install && ldconfig

# Create symlinks and verify
RUN ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg && \
    ln -sf /usr/local/bin/ffprobe /usr/bin/ffprobe && \
    test -f /usr/local/bin/ffmpeg || { echo "FFmpeg not found!"; exit 1; } && \
    echo "/usr/local/lib" > /etc/ld.so.conf.d/usr-local.conf && \
    ldconfig && \
    ffmpeg -version && \
    echo "Checking encoders:" && \
    ffmpeg -hide_banner -encoders 2>/dev/null | grep -E "(nvenc|libaom|libx264)" || true

# Clean up build files and dev packages
RUN rm -rf /tmp/ffmpeg-* && \
    apt-get remove -y \
        libx264-dev libx265-dev libvpx-dev libaom-dev \
        libopus-dev libvorbis-dev libass-dev \
        libfreetype6-dev libmp3lame-dev \
        yasm nasm autoconf automake libtool && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    ldconfig

# Set up environment
RUN echo 'export PATH=/usr/local/bin:$PATH' >> /etc/profile.d/ffmpeg.sh && \
    echo 'export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH' >> /etc/profile.d/ffmpeg.sh && \
    chmod +x /etc/profile.d/ffmpeg.sh

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
