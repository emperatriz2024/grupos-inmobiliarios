#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"; require_termux
abi="$(getprop ro.product.cpu.abi 2>/dev/null || uname -m)"; case "$abi" in arm64-v8a|aarch64|x86_64) ;; *) echo "ERROR: ABI no validada: $abi" >&2; exit 2;; esac
android="$(getprop ro.build.version.sdk 2>/dev/null || echo 0)"; [[ "$android" =~ ^[0-9]+$ && "$android" -ge 24 ]] || { echo "ERROR: Android API 24+ requerida; detectada $android" >&2; exit 2; }
pkg update -y
pkg install -y x11-repo
pkg install -y nodejs npm git chromium termux-services termux-api curl jq openssl coreutils procps iproute2
command -v node >/dev/null; command -v npm >/dev/null
chromium="$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || true)"; [[ -n "$chromium" ]] || { echo 'ERROR: chromium no instaló un ejecutable compatible.' >&2; exit 3; }
ensure_private_runtime
cd "$BRIDGE_DIR"; PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev --ignore-scripts
service_root="$PREFIX/var/service/$SERVICE_NAME"; mkdir -p "$service_root/log"; cp "$SCRIPT_DIR/service/run" "$service_root/run"; cp "$SCRIPT_DIR/service/log-run" "$service_root/log/run"; chmod 700 "$service_root/run" "$service_root/log/run"
mkdir -p "$HOME/.termux/boot"; cp "$SCRIPT_DIR/termux-boot-start.sh" "$HOME/.termux/boot/20-radar-whatsapp-secondary"; chmod 700 "$HOME/.termux/boot/20-radar-whatsapp-secondary"
echo "INSTALACIÓN PREPARADA. Chromium: $chromium. No se inició WhatsApp."
