# RADAR CORE CONTRACT V1

## Invariantes

- Una publicación es evidencia, no una propiedad. `source_messages` es inmutable; consolidar nunca elimina procedencia.
- ZIP primario y WhatsApp secundario son canales independientes y aditivos. ZIP permanece disponible como fallback.
- Un `master_property` puede enlazar N `property_sources`; cada enlace conserva el mensaje y canal originales.
- Un campo canónico solo puede apuntar a `evidence_facts` con una fuente real. Un dato ausente permanece ausente.
- `domain_events` es append-only. Correlación y causación reconstruyen Source → Evidence → Master.
- Retries de importación, mensaje, enlace y mutación se resuelven mediante claves idempotentes.
- PostgreSQL es el target futuro; IndexedDB `grupos-inmobiliarios` continúa como datos legacy/cache y no se elimina.
- El Core está desactivado salvo `RADAR_CORE_ENABLED=true`; cualquier indisponibilidad conserva el flujo legacy.
- La identidad visual es una señal: pHash nunca autoriza por sí solo un auto-merge.
- Todo medio conserva provenance y derechos; `UNKNOWN`, `INTERNAL_ONLY` y `SOURCE_LINK_ONLY` no son públicos.
- OWN requiere confirmación humana y sus detalles contractuales/comerciales son privados.
- Un fallo de media nunca invalida el mensaje ni sus hechos textuales.

## Entidades Phase 0A

Workspace, ingestion channel/run, group coverage, import batch, source thread/message, territory/alias/closure, evidence fact, master property, canonical fact, property source, domain event, idempotency key, device, sync change y client mutation.

No incluye Demand Engine, Media Vault, OCR/Audio AI, portal, visitas, deals, SaaS ni funciones de Phase 0B.

## Canales paralelos

`WHATSAPP_ZIP / PRIMARY_NUMBER / MANUAL` y `WHATSAPP_SECONDARY / SECONDARY_NUMBER / AUTOMATIC` escriben evidencia separada. La identidad puede converger en un mismo master sin fusionar mensajes. `group_ingestion_coverage` registra ZIP_ONLY, PENDING_SECONDARY, DUAL, SECONDARY_PRIMARY, SECONDARY_ONLY o INACTIVE y mantiene `zip_fallback_enabled`.

## Identificadores y persistencia

La capa de aplicación genera UUIDv7. Las migraciones SQL requieren UUID proporcionado por el cliente y no dependen de un proveedor PostgreSQL. `DATABASE_URL` nunca se versiona.
