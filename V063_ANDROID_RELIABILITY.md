# Confiabilidad Android

runit reinicia Node si muere. Termux:Boot inicia runit tras reboot y toma wake lock. El bridge conserva LocalAuth, outbox y estado; nunca llama logout ni borra sesión automáticamente. Logs estructurados se rotan a aproximadamente 1 MB y cinco archivos.

Un error de red conserva la outbox. 429 respeta Retry-After; 5xx/DNS usan backoff con jitter y circuit breaker. El watchdog marca DEGRADED ante cola creciente o subida estancada. El lock evita dos procesos con la misma sesión.

Pruebas físicas futuras obligatorias:

1. 30 minutos con pantalla encendida.
2. 1 hora con pantalla apagada.
3. Reinicio completo de Android.
4. 6–12 horas con pantalla apagada alternando Wi‑Fi/datos.

Solo tras aprobarlas puede declararse “ANDROID BRIDGE OPERATIVO 24/7”. Riesgos: restricciones del fabricante, límites de procesos Android 12+, memoria de Chromium, cambios de WhatsApp Web y pérdida física del teléfono. Debe diseñarse backup cifrado posterior sin ejecutar simultáneamente otro bridge.
