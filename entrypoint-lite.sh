#!/bin/bash
export FIRESHARE_LITE=true
export TRANSCODE_GPU=false

echo ""
echo "  ███████╗██╗██████╗ ███████╗███████╗██╗  ██╗ █████╗ ██████╗ ███████╗"
echo "  ██╔════╝██║██╔══██╗██╔════╝██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝"
echo "  █████╗  ██║██████╔╝█████╗  ███████╗███████║███████║██████╔╝█████╗  "
echo "  ██╔══╝  ██║██╔══██╗██╔══╝  ╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  "
echo "  ██║     ██║██║  ██║███████╗███████║██║  ██║██║  ██║██║  ██║███████╗"
echo "  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝"
echo "  ─────────────────── Lite Edition ─────────────────────────────────────"
echo ""
echo "  ▸ GPU transcoding is disabled in this image"
echo "  ▸ CPU transcoding is supported"
echo "  ▸ Switch to the standard image to enable GPU transcoding"
echo ""

exec bash /entrypoint.sh
