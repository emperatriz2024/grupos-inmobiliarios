# Validación V0.6.2 Cloud Ready

Antes de cualquier Fly real:

- Rama V0.6.2 limpia respecto de cambios ajenos y sin secretos.
- Modo predeterminado TEST; ninguna llamada a `client.initialize()` en tests.
- Runtime persistente, lock activo/stale, outbox y estado tras restart.
- Health 200; ready 503/200; metrics sin PII.
- SIGTERM ordenado sin logout.
- Retry-After, backoff+jitter, red, circuit breaker y watchdog.
- QR/tokens/mensajes/identidades ausentes de logs y endpoints.
- Docker context excluye sesión/runtime y contenedor corre sin WhatsApp real.
- `npm test`, `npm run check`, tests bridge y `git diff --check` pasan.
- ZIP, Dropbox, fuentes externas, Radar Core, precio, dedupe, matching y backups continúan pasando su regresión.

Pendiente deliberado: crear app/volumen/Machine, emparejar por terminal segura y ejecutar la prueba PC apagada → iPhone. Requiere revisión humana y una fase Fly TEST posterior.
