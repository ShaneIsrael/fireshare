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

# Install python-ldap dependencies if needed (optional, won't fail the setup)
if ! pip show python-ldap > /dev/null 2>&1; then
  echo ""
  echo "Note: python-ldap requires system libraries (libldap2-dev, libsasl2-dev on Linux"
  echo "or openldap on macOS). If the install fails, you can install them with:"
  echo "  Ubuntu/Debian: sudo apt-get install -y libldap2-dev libsasl2-dev"
  echo "  macOS:         brew install openldap"
  echo ""
fi

pip install -r app/server/requirements.txt
pip install -e app/server

flask db upgrade
flask run --host=0.0.0.0 --port=5000 --with-threads
