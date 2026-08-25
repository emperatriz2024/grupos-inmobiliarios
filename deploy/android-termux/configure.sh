#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux; ensure_private_runtime
default_url='https://radar-v061-whatsapp-secondary--radar-inmobiliario-dev.netlify.app/.netlify/functions/secondary-whatsapp-ingest'
read -r -p "URL ingest TEST [$default_url]: " url; url="${url:-$default_url}"
[[ "$url" == https://*'/secondary-whatsapp-ingest' ]] || { echo 'ERROR: URL HTTPS ingest TEST inválida.' >&2; exit 2; }
read -r -s -p 'Token ingest TEST (no se mostrará): ' token; echo; [[ ${#token} -ge 32 ]] || { echo 'ERROR: token ausente o demasiado corto.' >&2; exit 2; }
umask 077; cat >"$ENV_FILE" <<EOF
RADAR_BRIDGE_MODE=live
RADAR_BRIDGE_RUNTIME_DIR=$RUNTIME
RADAR_BRIDGE_INGEST_URL=$url
RADAR_BRIDGE_INGEST_TOKEN=$token
RADAR_BRIDGE_HEALTH_HOST=127.0.0.1
RADAR_BRIDGE_HEALTH_PORT=8080
RADAR_BRIDGE_BOOTSTRAP_MODE=false
PUPPETEER_SKIP_DOWNLOAD=true
EOF
chmod 600 "$ENV_FILE"; unset token; echo "Configuración privada guardada con permisos 600."
