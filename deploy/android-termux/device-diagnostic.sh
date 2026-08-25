#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
chromium="$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || echo no-detectado)"
echo "Android: $(getprop ro.build.version.release 2>/dev/null || echo desconocido) (API $(getprop ro.build.version.sdk 2>/dev/null || echo desconocida))"
echo "ABI: $(getprop ro.product.cpu.abi 2>/dev/null || uname -m)"
awk '/MemTotal/{printf "RAM total: %.0f MB\n",$2/1024}' /proc/meminfo
df -h "$HOME" | awk 'NR==2{print "Almacenamiento libre: "$4}'
echo "Termux: ${TERMUX_VERSION:-desconocida}"; echo "Node: $(node --version 2>/dev/null || echo no-instalado)"
echo "Chromium path: $chromium"; [[ "$chromium" == no-detectado ]] || echo "Chromium: $($chromium --version 2>/dev/null || echo versión-no-disponible)"
echo "Wake lock: $(command -v termux-wake-lock >/dev/null && echo disponible || echo no-disponible)"
echo "Termux Boot: $(pm list packages 2>/dev/null | grep -q com.termux.boot && echo instalado || echo no-detectado)"
echo "Servicio: $(sv status "$SERVICE_NAME" 2>/dev/null || echo no-configurado)"
curl -sS --max-time 5 -o /dev/null https://radar-v061-whatsapp-secondary--radar-inmobiliario-dev.netlify.app && echo 'Red: disponible' || echo 'Red: no disponible'
