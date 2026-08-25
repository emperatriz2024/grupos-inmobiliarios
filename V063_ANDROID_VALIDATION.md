# Validación V0.6.3

- Rama aislada, sin secretos, QR, sesión o perfiles.
- Scripts shell con LF, runtime privado y config 600.
- Chromium detectado dinámicamente; descarga Puppeteer desactivada.
- Modo TEST no inicializa WhatsApp.
- runit, Boot, wake lock, lock, health y rotación preparados.
- Bootstrap: LAN, token único, cinco minutos, RAM-only y cierre tras auth.
- Read-only y solo grupos.
- Suite completa, Android, arquitectura y diff check con cero fallos.

Esta validación es de arquitectura. Sin un Android físico no confirma disponibilidad del paquete Chromium en ese dispositivo, políticas de batería específicas, compatibilidad real de WhatsApp Web ni operación 24/7.
