#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create dev directories if they don't exist
mkdir -p dev_root/dev_data dev_root/dev_videos dev_root/dev_processed

# Setup Virtual Environment (reuse existing if present)
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

# Export environment variables
source .env.dev

pip install --upgrade pip setuptools wheel

pip install -r app/server/requirements.txt
pip install -e app/server

flask db upgrade
fireshare migrate-game-assets
flask run --host=0.0.0.0 --port=3001 --with-threads
