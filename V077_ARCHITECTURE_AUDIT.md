# Auditoría ejecutable V0.7.7

Fecha: 2026-09-02. Rama auditada: `radar-v077-visits-deal-room`. Base: `5413bc143734c9064b97cc3b25e0c5fb97a80861`.

## Matriz de estado comprobado

| Estado | Bloques |
|---|---|
| Terminado y conectado | Ingestión ZIP y WhatsApp secundario; identidad, deduplicación y evidencia; inventario y Property Twin; compradores, Client Twin y Broker Twin; demanda, matching, oportunidades y readiness; Owner Twin y captación; visitas, Deal Room, Control Tower, analítica; backup/restore IndexedDB V15. |
| Parcial por evidencia humana | Disponibilidad, derechos de media, documentos, precio recomendado, resultado de visita y condiciones de cierre. El sistema los mantiene pendientes y no los inventa. |
| Simulado solamente en validación | Los recorridos E2E usan datos aislados; no se presentan como operaciones o cierres reales. |
| Desconectado deliberadamente | Migraciones SQL son contrato futuro; la operación real continúa en IndexedDB. Mensajería permanece en borrador y nunca se envía automáticamente. |
| Bloqueado externamente | Worker real requiere variables Dropbox y `RADAR_INGESTION_WORKER_TOKEN` en el contexto del Branch Deploy. OAuth depende de la allowlist de Dropbox. |

## Correcciones aplicadas por la auditoría

- Eliminado el destino de dispatch derivado del encabezado `Host`; el Worker usa exclusivamente la URL confiable del despliegue.
- Protegida la función background con credencial server-to-server y comparación temporalmente segura.
- Restringidas las mutaciones del orquestador al origen exacto del despliegue.
- Evitados eventos duplicados al repetir sin cambios Client Property State, Pipeline y Owner Twin.
- Reforzada la unicidad de eventos append-only ante dos cambios durante el mismo milisegundo.
- Conservada la identidad de Visit Twin al reprogramar; fechas pendientes, importes y relaciones obligatorias ahora se validan.
- Corregida la versión obsoleta emitida por el Service Worker y alineado el cache busting V0.7.7.
- Alineada la identidad del paquete con Radar Revenue OS V0.7.7.

## Invariantes preservados

- `DB_NAME = grupos-inmobiliarios`; migración aditiva y sin borrado automático.
- DATA DECIDES. AI REASONS.
- Townhouse de Linda continúa como hard gate; apartamentos no son coincidencias principales.
- Reanudación, checkpoints, idempotencia, backup/restore y operación offline.
- Ningún token se incluye en cliente, logs o artefactos versionados.
- `main` y producción no se modifican durante esta auditoría.

## Límites honestos

- IndexedDB es local al navegador y no reemplaza una base multiusuario transaccional.
- La autenticación de acceso humano al sitio debe imponerse en la plataforma de hosting; el secreto agregado protege el Worker interno, no constituye identidad de usuario.
- Disponibilidad, consentimiento, documentación y cierres siguen requiriendo confirmación humana verificable.
