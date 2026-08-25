#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BRIDGE_DIR="$PROJECT_ROOT/bridge/whatsapp-secondary"
RUNTIME="${RADAR_BRIDGE_RUNTIME_DIR:-$HOME/.radar-whatsapp-secondary}"
ENV_FILE="$RUNTIME/config/runtime.env"
SERVICE_NAME="radar-whatsapp-secondary"
require_termux(){ [[ "${PREFIX:-}" == *com.termux*/files/usr ]] || { echo 'ERROR: ejecutar dentro de Termux.' >&2; exit 1; }; }
load_runtime(){ [[ -f "$ENV_FILE" ]] || { echo "ERROR: falta $ENV_FILE; ejecuta configure.sh." >&2; exit 1; }; set -a; source "$ENV_FILE"; set +a; }
ensure_private_runtime(){ umask 077; mkdir -p "$RUNTIME"/{session,chromium,outbox,state,logs,lock,config}; chmod 700 "$RUNTIME" "$RUNTIME"/{session,chromium,outbox,state,logs,lock,config}; }
