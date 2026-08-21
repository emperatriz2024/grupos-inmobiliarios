# Validación V0.6.1 — Secondary WhatsApp Bridge

## Resultado automatizado

- Fecha local: 2026-08-20.
- Comando: `npm test`.
- Suite completa preconexión: 60 ejecutados, 60 aprobados, 0 fallidos, 13,00 s.
- Chequeo: `npm run check`.
- Resultado: sintaxis correcta y `ARCHITECTURE_OK`.

Una corrida intermedia tuvo un fallo exclusivo del umbral temporal del test de 3.000 mensajes (18,9 s frente a 15 s). El mismo archivo pasó aislado en 14,17 s y la corrida completa final pasó en 14,92 s para ese caso. No se relajó ni modificó el umbral.

Auditoría de cinco corridas consecutivas del test de 3.000 mensajes: 11,31 s; 11,02 s; 13,45 s; 12,70 s; 12,23 s. Mínimo 11,02 s, máximo 13,45 s y promedio 12,14 s; 0/5 superaron 15 s. La carga sintética de 7.000 fuentes consolidó 1.400 maestros en aproximadamente 0,59 s dentro de la suite final.

## Cobertura confirmada sin servicios externos

- Chat privado y mensajes propios ignorados.
- Grupo aceptado con nombre/autor correctos.
- Teléfono verificable para `@c.us`; LID preservado con teléfono desconocido.
- Idempotencia de `messageId` local y remota.
- Outbox conservada tras error y retry con backoff.
- Lotes duplicados sin duplicación de cola.
- Ingest sin token rechazado, con token aceptado y payload inválido rechazado.
- Sync con autenticación y cursor incremental.
- Cursor inválido, origen CORS ajeno y páginas mayores de 100 rechazados/limitados.
- Rate limiting defensivo y errores internos genéricos.
- Retención raw TEST de 14 días e idempotencia de 30 días.
- Mensaje no inmobiliario no crea inmueble.
- Publicación válida reutiliza extracción estricta y Radar Core.
- Agrupamiento multimensaje conservador.
- Precio estricto, deduplicación y ZIP principal sin regresión.

## No verificado todavía

- QR y sesión persistente con un teléfono físico.
- Comportamiento real de WhatsApp Web, LID/contactos y backfill en grupos reales.
- Instalación de Chromium/Puppeteer en esta PC.
- Variables, permisos, CORS y Netlify Blobs en un branch deploy TEST.
- Reintentos reales ante HTTP 429/5xx y cortes prolongados.
- Volumen, límites, orden y retención de Netlify Blobs.
- Rate limiting distribuido de plataforma; el límite incorporado es por instancia de función.
- PWA en iPhone y ciclo de vida en segundo plano.

## Veredicto provisional

La arquitectura está apta para revisión de código y pruebas automatizadas locales. **No está apta todavía para conectar el segundo WhatsApp real** hasta completar una prueba integrada con teléfono físico, cola Netlify TEST aislada, secretos externos y revisión humana. No se realizó deploy, push, commit ni conexión real durante esta validación.
