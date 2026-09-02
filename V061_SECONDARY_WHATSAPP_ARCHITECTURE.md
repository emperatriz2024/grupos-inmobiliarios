# Radar V0.6.1 — Secondary WhatsApp Bridge

## Alcance

V0.6.1 añade un canal de captura de solo lectura para un segundo número de WhatsApp normal. No reemplaza ni modifica el flujo estable del número principal:

```text
WhatsApp principal → ZIP/Dropbox → WhatsAppZipSource → Radar Core
WhatsApp secundario → WhatsApp Web vinculado → bridge local → outbox → HTTPS → cola TEST → SecondaryWhatsAppSource → Radar Core
```

No existe código para enviar, responder, reaccionar, reenviar, administrar participantes o modificar grupos. El contacto manual mediante `wa.me` permanece separado en Radar.

## Límites de seguridad

- Rama de trabajo: `radar-v061-whatsapp-secondary`.
- Store exclusivo: `radar-secondary-whatsapp-v061-test`.
- Sesión, perfil Chromium, estado por grupo y outbox se guardan fuera del repositorio, por defecto en `%LOCALAPPDATA%\RadarInmobiliario\whatsapp-secondary`.
- `.wwebjs_auth`, `.wwebjs_cache`, runtime, bases locales, logs y `.env` están ignorados.
- `RADAR_BRIDGE_INGEST_TOKEN` autentica escritura y `RADAR_SECONDARY_SYNC_TOKEN` autentica lectura. Deben ser secretos distintos y de alta entropía.
- `RADAR_SECONDARY_ALLOWED_ORIGIN` limita CORS al branch deploy TEST. Las solicitudes same-origin del propio host también son válidas.
- El token de lectura se introduce manualmente en Radar y vive solo en `sessionStorage`; no entra en JavaScript, Git ni respaldos.
- Ningún endpoint devuelve eventos sin autenticación Bearer válida.

## Flujo y garantías

1. El listener acepta únicamente IDs de chat terminados en `@g.us`; ignora privados, propios y revocados.
2. Normaliza metadata sin descargar media. Los captions sí se procesan.
3. Un `@c.us` numérico puede marcarse como teléfono verificado. Un LID se conserva como identificador y el teléfono queda `null`/`unverifiable`.
4. La outbox persiste antes del upload y usa `messageId` como idempotency key.
5. El uploader envía lotes de hasta 50 y reintenta 429, 5xx o fallos de red con backoff exponencial máximo de cinco minutos.
6. El estado reciente por grupo evita reencolar el backfill después de reinicios. El backfill queda limitado a 100 grupos y 50 mensajes por grupo y registra intentos/errores.
7. La función de ingestión valida POST, JSON, máximo 512 KB, token, lote, IDs y timestamps.
8. Aplica un rate limit defensivo por IP e instancia (60 solicitudes/minuto en ingesta y 120/minuto en lectura). Para protección distribuida se debe añadir una regla de plataforma en Netlify TEST.
9. Netlify Blobs actúa solo como cola TEST idempotente, no como base relacional definitiva.
10. Los eventos crudos se retienen 14 días. El índice mínimo de `messageId` se conserva 30 días para bloquear replays tardíos. La purga solo opera sobre el store TEST hardcodeado.
11. La sincronización valida el cursor, limita cada página a 100 y la PWA consume un máximo de cinco páginas por ciclo.
12. La PWA agrupa conservadoramente; la clasificación final llama a `isPropertyPost` y la extracción a `extractProperty`, seguida por `mergeProperties`, consolidación y Radar Core V0.6.

## Datos transmitidos y retención TEST

El bridge envía exclusivamente lotes JSON con: `messageId`, `groupId`, `groupName`, `authorId`, `authorIdentifier`, `authorDisplayName`, `authorPhone` solo si es verificable, `phoneStatus`, `timestamp`, `receivedAt`, `messageType`, `text`, `caption`, `hasMedia`, `mediaType`, `quotedMessageId`, `sourceType` y `sourceChannel`. No envía archivos multimedia, QR, cookies, sesión, perfil Chromium, tokens ni directorios del teléfono.

Los logs de consola incluyen únicamente fecha, estado/evento, contadores, estado HTTP, operación, intento y backoff. No imprimen grupo, mensaje, autor, teléfono, texto, QR o secretos.

Las claves remotas son `event-<receivedAt epoch>-<messageId codificado>` para el raw y `id-<messageId codificado>` para idempotencia. Dos escrituras simultáneas del mismo evento convergen en las mismas claves; Netlify Blobs no ofrece una transacción compare-and-set, por lo que dos respuestas concurrentes podrían contabilizar “accepted”, pero solo queda un raw y un índice. Esto requiere prueba integrada manual.

## Publicaciones multimensaje

Solo se agrupan mensajes con mismo grupo, mismo autor, menos de dos minutos y continuidad semántica inmobiliaria. Si no hay señal suficiente quedan separados. El autor observado se conserva como `publisher`; nunca se declara captador original por el solo hecho de publicar.

## Riesgos conocidos

`whatsapp-web.js` automatiza WhatsApp Web y no es una API oficial. WhatsApp puede cambiar su interfaz, cerrar sesiones o restringir cuentas. La vinculación debe probarse con un número secundario y grupos de prueba, nunca como garantía de disponibilidad. Netlify Blobs necesita verificación integrada en un contexto TEST real antes de conectar el número.
