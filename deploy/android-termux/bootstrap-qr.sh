#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux; load_runtime
sv down "$SERVICE_NAME" 2>/dev/null || true; token="$(openssl rand -hex 32)"; lan_ip="$(ip -o -4 addr show scope global | awk '{split($4,a,"/"); print a[1]; exit}')"; [[ -n "$lan_ip" ]] || { echo 'ERROR: no se detectó IP LAN.' >&2; exit 2; }
export RADAR_BRIDGE_BOOTSTRAP_MODE=true RADAR_BRIDGE_BOOTSTRAP_TOKEN="$token" RADAR_BRIDGE_BOOTSTRAP_HOST=0.0.0.0 RADAR_BRIDGE_BOOTSTRAP_PORT=8090 RADAR_BRIDGE_MODE=live
echo "Abre durante los próximos 5 minutos: http://$lan_ip:8090/bootstrap/$token"
echo 'El endpoint se cerrará al autenticar. Ctrl+C cancela sin borrar la sesión.'
termux-wake-lock || true; cd "$BRIDGE_DIR"; exec node index.js
