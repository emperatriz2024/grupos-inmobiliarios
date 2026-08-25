# V0.6.3 — Android Bridge

El Android del segundo número ejecuta Termux sin root. Node + Chromium mantienen un dispositivo WhatsApp Web vinculado y el bridge read-only envía eventos al ingest TEST V0.6.1. Netlify conserva la cola y Radar en iPhone procesa con Radar Core.

El runtime privado es `$HOME/.radar-whatsapp-secondary`; nunca usa `/sdcard` ni almacenamiento compartido. Contiene `session`, `chromium`, `outbox`, `state`, `logs`, `lock` y `config`. Los secretos viven solo en `config/runtime.env` con modo 600.

Chromium se detecta en este orden: `CHROMIUM_PATH`, `PUPPETEER_EXECUTABLE_PATH`, `$PREFIX/bin/chromium-browser`, `$PREFIX/bin/chromium`, y rutas Linux para conservar Docker. Puppeteer no descarga Chrome en Termux. TEST no inicializa WhatsApp.

runit supervisa el proceso; Termux:Boot arranca servicios y adquiere wake lock. El lock Node impide duplicados. La outbox atómica, backoff, circuit breaker y watchdog sobreviven red caída y reinicios sin borrar LocalAuth.

Android 12+ puede finalizar procesos por límites de batería o “phantom processes”. Wake lock y batería sin restricciones reducen el riesgo, pero solo las pruebas físicas prolongadas permiten afirmar operación 24/7.
