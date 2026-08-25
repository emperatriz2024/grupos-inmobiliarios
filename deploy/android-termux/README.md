# Radar Android Termux Bridge

Deployment gratuito y sin root para el Android del segundo WhatsApp. La PC no forma parte de la operación diaria.

Orden previo al QR: `install.sh` → `device-diagnostic.sh` → `configure.sh` → modo TEST → `start.sh` → `health.sh`. `bootstrap-qr.sh` queda reservado para una fase posterior y nunca debe ejecutarse durante preparación.

- `start.sh`, `stop.sh`, `restart.sh`, `status.sh`: control mediante termux-services/runit.
- `health.sh`: health/ready local en `127.0.0.1`.
- `update.sh`: solo fast-forward y dependencias reproducibles.
- `uninstall-runtime.sh`: no elimina nada sin confirmación explícita; borra sesión/outbox/state de forma irreversible.
- `device-diagnostic.sh`: diagnóstico sin IMEI, serial, Android ID, contactos, tokens ni IP pública.
- `termux-boot-start.sh`: plantilla Termux:Boot con wake lock.

Runtime privado: `$HOME/.radar-whatsapp-secondary`. No usar `/sdcard`. No mezclar APKs Termux/Boot/API de fuentes o firmas diferentes. Consulta las guías V063 en la raíz del repositorio.
