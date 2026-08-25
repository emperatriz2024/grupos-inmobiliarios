#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock || true
source /data/data/com.termux/files/usr/etc/profile.d/start-services.sh
sv up radar-whatsapp-secondary
