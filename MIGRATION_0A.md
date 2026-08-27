# MIGRATION 0A

## Flujo shadow

1. Generar un backup legacy inmutable desde la aplicación actual.
2. Ejecutar `node scripts/shadow-migrate-0a.mjs <backup.json>` sobre una copia TEST.
3. Validar formato, `db_name`, stores, conteos y mappings `legacy_id`.
4. Construir el shadow export en memoria.
5. Aceptarlo solo si todas las validaciones terminan correctamente.
6. Comparar Source, Master y Territory antes de cualquier fase futura de cutover.

El script no escribe sobre el backup, no abre IndexedDB y no modifica PostgreSQL. Una validación fallida devuelve `aborted` y código distinto de cero. No se renombra `grupos-inmobiliarios`, no se borran stores y no se incrementa su versión en Phase 0A.

## PostgreSQL

Aplicar migraciones y seeds únicamente en una base TEST mediante una herramienta transaccional. La migración usa `BEGIN/COMMIT`; `domain_events` rechaza UPDATE/DELETE. No se aprovisiona proveedor ni se guarda `DATABASE_URL` en el repositorio.
