FROM node:24-slim as client
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY app/client/package.json ./
COPY app/client/package-lock.json ./
COPY app/client/.env.* ./
RUN npm ci --silent
COPY app/client/ ./
RUN npm run build

# FFmpeg builder stage with CUDA development tools
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04 as ffmpeg-builder
WORKDIR /tmp

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
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

# Build SVT-AV1 from source, V1.8.0 for FFmpeg 6.1
RUN git clone --depth 1 --branch v1.8.0 https://gitlab.com/AOMediaCodec/SVT-AV1.git && \
    cd SVT-AV1/Build && \
    cmake .. -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc) && \
    make install

# Install NVIDIA codec headers for NVENC support
RUN git clone --depth 1 --branch n12.1.14.0 https://github.com/FFmpeg/nv-codec-headers.git && \
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
        --enable-libsvtav1 \
        --disable-debug \
        --disable-doc

# Build and install FFmpeg
RUN cd ffmpeg-6.1 && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# Verify FFmpeg was built correctly
RUN ffmpeg -version && \
    ffmpeg -hide_banner -encoders 2>/dev/null | grep -E "(nvenc|264|265|vpx|aom|svt)" | head -20

# Main application stage
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04
WORKDIR /

# Copy FFmpeg from builder
COPY --from=ffmpeg-builder /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg-builder /usr/local/bin/ffprobe /usr/local/bin/ffprobe
COPY --from=ffmpeg-builder /usr/local/lib/lib* /usr/local/lib/

# Install runtime dependencies
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
    software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && DEBIAN_FRONTEND=noninteractive apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
    nginx-extras supervisor \
    python3.14 python3.14-dev python3.14-venv \
    libldap2-dev libsasl2-dev libssl-dev \
    libffi-dev libc-dev \
    build-essential \
    gosu \
    wget curl ca-certificates \
    tzdata \
    libx264-163 libx265-199 libvpx7 libaom3 \
    libopus0 libvorbis0a libvorbisenc2 \
    libass9 libfreetype6 libmp3lame0 \
    && python3.14 -m ensurepip --upgrade \
    && python3.14 -m pip install --upgrade --break-system-packages pip \
    && ln -sf /usr/bin/python3.14 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.14 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks and configure library path
RUN ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg && \
    ln -sf /usr/local/bin/ffprobe /usr/bin/ffprobe && \
    echo "/usr/local/lib" > /etc/ld.so.conf.d/usr-local.conf && \
    echo "/usr/local/cuda/lib64" >> /etc/ld.so.conf.d/usr-local.conf && \
    echo "/usr/local/nvidia/lib" >> /etc/ld.so.conf.d/nvidia.conf && \
    echo "/usr/local/nvidia/lib64" >> /etc/ld.so.conf.d/nvidia.conf && \
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
COPY --from=client /app/package.json /app
RUN python3.14 -m pip install --no-cache-dir --break-system-packages --ignore-installed /app/server

ENV FLASK_APP /app/server/fireshare:create_app()
ENV ENVIRONMENT production
ENV DATA_DIRECTORY /data
ENV VIDEO_DIRECTORY /videos
ENV PROCESSED_DIRECTORY /processed
ENV TEMPLATE_PATH=/app/server/fireshare/templates
ENV ADMIN_PASSWORD admin
ENV TZ=UTC
ENV LD_LIBRARY_PATH /usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/lib:/usr/local/cuda/lib64:$LD_LIBRARY_PATH
ENV PATH /usr/local/bin:$PATH

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]
