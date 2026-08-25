#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux; load_runtime; termux-wake-lock || true
sv-enable "$SERVICE_NAME" >/dev/null 2>&1 || true; sv up "$SERVICE_NAME"; sv status "$SERVICE_NAME"
