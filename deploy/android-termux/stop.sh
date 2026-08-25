#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
sv down "$SERVICE_NAME" || true; termux-wake-unlock || true; echo 'Bridge detenido manualmente.'
