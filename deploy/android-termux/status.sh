#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
sv status "$SERVICE_NAME" || true; "$SCRIPT_DIR/health.sh" || true
