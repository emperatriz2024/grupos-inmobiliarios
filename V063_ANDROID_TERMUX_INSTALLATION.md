# Instalación Android/Termux paso a paso

## Antes de comenzar

1. Instala Termux y Termux:Boot desde **la misma fuente y firma**. No mezcles F-Droid, GitHub ni Play Store. Abre ambas aplicaciones una vez.
2. Android debe ser 7 o posterior; se recomienda ARM64 y una versión Termux actual.
3. En Ajustes → Aplicaciones → Termux y Termux:Boot → Batería, selecciona **Sin restricciones**. No se requiere root, ADB, depuración USB ni desbloquear el teléfono.

La recomendación de no mezclar firmas y el procedimiento Boot provienen de los proyectos oficiales [Termux](https://github.com/termux/termux-app) y [Termux:Boot](https://github.com/termux/termux-boot).

## Preparar sin conectar WhatsApp

1. Clona esta rama en el HOME privado de Termux, nunca en `/sdcard`.
2. Entra al repositorio y ejecuta `bash deploy/android-termux/install.sh`.
3. El script valida Android/ABI, habilita `x11-repo`, instala Node, npm, Git, Chromium, termux-services y utilidades, instala dependencias con `PUPPETEER_SKIP_DOWNLOAD=true` y prepara runit/Boot. Es idempotente y no inicia WhatsApp.
4. Ejecuta `bash deploy/android-termux/device-diagnostic.sh`. No muestra identificadores del dispositivo ni tokens.
5. Ejecuta `bash deploy/android-termux/configure.sh`. Pega el token TEST cuando lo solicite; queda oculto y guardado con permisos 600.
6. Antes del QR, cambia temporalmente `RADAR_BRIDGE_MODE=test` en el archivo privado y ejecuta el servicio. Comprueba `health.sh` y `status.sh`. Restablece `live` solo para la futura fase de vínculo.

Comandos habituales: `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `health.sh`, `update.sh`. El stop manual libera wake lock; un reinicio normal conserva sesión, outbox y estado.

## Batería y datos

El bridge puede usar Wi‑Fi o datos móviles. Un wake lock aumenta consumo; conecta el Android a alimentación fiable cuando sea posible. Android puede cerrar Termux pese a estas medidas: revisa las opciones de batería del fabricante y ejecuta las pruebas de fiabilidad.
