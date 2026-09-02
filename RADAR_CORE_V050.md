# Radar Inmobiliario v0.5.0 CORE

Esta versión parte de v0.4.12 PRO y conserva la base `properties` sin modificar su contrato.

## Añadido
- IndexedDB v6.
- `master_properties`: una ficha por inmueble consolidado.
- `source_posts`: publicaciones/apariciones vinculadas a la ficha maestra.
- `buyers`: estructura reservada para compradores.
- `matches`: estructura reservada para matching comprador ↔ inmueble.
- `sync_queue`: estructura reservada para sincronización futura con backend.
- Migración automática y reversible desde el inventario WhatsApp actual.
- Tarjeta de diagnóstico Radar Core con contadores.

## Seguridad de la migración
La tabla histórica `properties`, favoritos, contactos, importaciones, municipios, zonas y conjuntos no se convierten ni se eliminan. Radar se construye en paralelo.

## Próximo módulo recomendado
`v0.5.1 COMPRADORES`: alta/edición de requerimientos y búsqueda guardada.
