#!/bin/bash
# This is the lite image — GPU transcoding dependencies are not installed.
# Force TRANSCODE_GPU=false regardless of any runtime environment variable.
export FIRESHARE_LITE=true
export TRANSCODE_GPU=false

echo "============================================"
echo "  Fireshare Lite"
echo "  GPU transcoding is not available in this"
echo "  image. CPU transcoding is supported."
echo "  To use GPU transcoding, switch to the"
echo "  standard fireshare image."
echo "============================================"

exec bash /entrypoint.sh
