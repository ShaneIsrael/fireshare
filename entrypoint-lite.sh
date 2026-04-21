#!/bin/bash
# This is the lite image — transcoding dependencies are not installed.
# Force ENABLE_TRANSCODING=false regardless of any runtime environment variable.
export ENABLE_TRANSCODING=false
exec bash /entrypoint.sh
