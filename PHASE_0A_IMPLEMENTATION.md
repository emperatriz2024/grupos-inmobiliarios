# PHASE 0A IMPLEMENTATION

## Componentes

- `db/migrations/001_phase_0a_core_foundation.sql`: modelo PostgreSQL, restricciones, índices e inmutabilidad de eventos.
- `db/seeds/001_emperatriz_workspace.sql`: workspace y jerarquía territorial Carabobo → Trigal.
- `core/radar/foundation.js`: contrato ejecutable de ingesta, idempotencia, evidencia, masters, sources, eventos y sync.
- `core/radar/territory.js`: ontología y expansión por closure, sin reglas particulares por zona.
- `core/radar/legacy-adapters.js`: mirror aditivo bajo feature flag con fallback legacy.
- `core/radar/shadow-migration.js` y `scripts/shadow-migrate-0a.mjs`: exportación/validación shadow sin cutover.

## Activación

`RADAR_CORE_ENABLED` usa default OFF. Phase 0A no conecta el frontend legacy a PostgreSQL ni requiere `DATABASE_URL` para validar. La integración real puede habilitarse en un entorno aislado sin afectar Buscar, Compradores, ZIP, WhatsApp secundario, respaldos o restore.

## Observabilidad

Los adaptadores emiten objetos estructurados para import batches, runs, mensajes, duplicados, migraciones, fallos de sync y Core no disponible. No registran texto fuente ni credenciales.

## Validación

`npm test`, `npm run check`, `npm run core:schema:validate` y `git diff --check` validan esta fase sin aprovisionar servicios ni usar secretos.
