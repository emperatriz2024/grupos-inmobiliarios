# Radar Inmobiliario v0.5.1.2 — Hotfix

## Error corregido
La v0.5.1.1 mostraba:
`Can't find variable: auditExistingPropertyPrice`

Causa:
- `engine.js` sí contenía y exportaba la función de auditoría.
- `db.js` sí contenía `patchPropertyPriceAudits`.
- `app.js` usaba ambas funciones, pero no las importaba.

La aplicación fallaba durante `loadData()` antes de modificar la base local.
Por eso ver 0 inmuebles/grupos era un efecto de que la interfaz no terminó de cargar,
no una eliminación de los datos.

## Corrección adicional de caché
Todos los imports internos se migran a `?v=0512`.
Esto evita que Safari/PWA/Service Worker reutilice módulos antiguos `v0502`,
especialmente `engine.js`, que contiene el nuevo extractor contextual de precios.

## Conservación de datos
- No cambia la versión de IndexedDB.
- No borra stores.
- No requiere reimportar chats.
- No requiere restaurar respaldo.
- Al arrancar correctamente, reaudita precios existentes una sola vez.
