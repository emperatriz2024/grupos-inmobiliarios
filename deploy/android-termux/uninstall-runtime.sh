#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
[[ "${1:-}" == '--confirm-delete-private-runtime' ]] || { echo "No se eliminó nada. Para borrar sesión/outbox/state usa explícitamente --confirm-delete-private-runtime"; exit 2; }
case "$RUNTIME" in "$HOME/.radar-whatsapp-secondary") ;; *) echo 'ERROR: runtime inesperado; cancelado.' >&2; exit 3;; esac
sv down "$SERVICE_NAME" 2>/dev/null || true; rm -rf -- "$RUNTIME"; echo 'Runtime privado eliminado de forma irreversible.'
