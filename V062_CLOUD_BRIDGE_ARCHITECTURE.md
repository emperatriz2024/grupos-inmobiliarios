# V0.6.2 — Cloud Bridge 24/7

## Flujo

Segundo WhatsApp → dispositivo WhatsApp Web vinculado en una única Machine → bridge Node/Chromium → ingest V0.6.1 → Netlify Blobs TEST → sync → Radar Core en iPhone.

La lógica del bridge no depende de Fly. `runtime-config.js` define paths y modos; `runtime-lock.js`, health y lifecycle son Node estándar. Docker es la frontera de despliegue.

## Persistencia y aislamiento

En cloud, `RADAR_BRIDGE_RUNTIME_DIR=/data/radar-whatsapp-secondary`. `session`, caché Chromium, outbox y estado por grupo viven bajo esa raíz. LocalAuth administra su perfil dentro de `session`; `chromium` conserva la caché/binario cuando corresponda. Los secretos permanecen en variables del proveedor, nunca en el volumen.

Una sola instancia posee el lock con lease. Un lock activo aborta el arranque; uno obsoleto solo se recupera si venció y su PID no está vivo. No hay escalado horizontal.

## Estados y seguridad

Estados: STARTING, WAITING_QR, AUTH_REQUIRED, AUTHENTICATED, READY, DISCONNECTED, RECONNECTING, DEGRADED, ERROR y SHUTTING_DOWN. `/health`, `/ready` y `/metrics` no incluyen PII. Los logs usan allowlist. El código propio es read-only y no invoca APIs de envío.

`RADAR_BRIDGE_MODE=test` es seguro por defecto y nunca inicializa WhatsApp. `live` es explícito. El QR solo puede verse en terminal TTY administrativa durante bootstrap y no se guarda.

## Fiabilidad

La outbox usa escritura atómica y backup recuperable. 429 respeta Retry-After; red y 5xx usan backoff exponencial con jitter y circuit breaker. El watchdog degrada el estado ante cola excesiva o subida estancada. SIGTERM/SIGINT vacían lo posible, destruyen Chromium sin logout y liberan el lock.
