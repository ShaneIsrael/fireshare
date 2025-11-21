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

# FFmpeg builder stage with CUDA development tools
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04 as ffmpeg-builder
WORKDIR /tmp

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    yasm \
    nasm \
    git \
    wget \
    xz-utils \
    ca-certificates \
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libaom-dev \
    libopus-dev \
    libvorbis-dev \
    libass-dev \
    libfreetype6-dev \
    libmp3lame-dev \
    && rm -rf /var/lib/apt/lists/*

# Install NVIDIA codec headers for NVENC support
RUN git clone --depth 1 --branch n12.1.14.0 https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && \
    make install && \
    ldconfig

# Download and extract FFmpeg
RUN wget -q https://ffmpeg.org/releases/ffmpeg-6.1.tar.xz && \
    tar -xf ffmpeg-6.1.tar.xz

# Configure FFmpeg with NVENC and all necessary encoders
RUN cd ffmpeg-6.1 && \
    ./configure \
        --prefix=/usr/local \
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
        --disable-doc

# Build and install FFmpeg
RUN cd ffmpeg-6.1 && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# Verify FFmpeg was built correctly
RUN ffmpeg -version && \
    ffmpeg -hide_banner -encoders 2>/dev/null | grep -E "(nvenc|264|265|vpx|aom)" | head -20

# Main application stage
FROM nvidia/cuda:11.8.0-base-ubuntu22.04
WORKDIR /

# Copy FFmpeg from builder
COPY --from=ffmpeg-builder /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg-builder /usr/local/bin/ffprobe /usr/local/bin/ffprobe
COPY --from=ffmpeg-builder /usr/local/lib/lib* /usr/local/lib/

# Install runtime dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    nginx supervisor \
    python3.9 python3-pip python3-dev \
    libldap2-dev libsasl2-dev libssl-dev \
    libffi-dev libc-dev \
    build-essential \
    wget curl ca-certificates \
    libx264-163 libx265-199 libvpx7 libaom3 \
    libopus0 libvorbis0a libvorbisenc2 \
    libass9 libfreetype6 libmp3lame0 \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks and configure library path
RUN ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg && \
    ln -sf /usr/local/bin/ffprobe /usr/bin/ffprobe && \
    echo "/usr/local/lib" > /etc/ld.so.conf.d/usr-local.conf && \
    echo "/usr/local/cuda/lib64" >> /etc/ld.so.conf.d/usr-local.conf && \
    ldconfig && \
    ffmpeg -version && \
    echo "Available encoders:" && \
    ffmpeg -hide_banner -encoders 2>/dev/null | grep -E "(nvenc|libaom|libvpx|libx264)" || true

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
