#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
cd "$PROJECT_ROOT"; git fetch origin; git pull --ff-only
cd "$BRIDGE_DIR"; PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev --ignore-scripts
sv restart "$SERVICE_NAME"; echo 'Actualización aplicada mediante fast-forward.'
