# Radar Inmobiliario v0.5.1 — Mis Compradores

## Objetivo
Convertir el inventario consolidado en una herramienta comercial: cada comprador tiene un perfil de búsqueda y Radar calcula coincidencias automáticamente contra `master_properties`.

## Incluye
- Nueva pestaña **Compradores**.
- Alta, edición, pausa, cierre y eliminación de compradores.
- WhatsApp, urgencia y notas.
- Operación, múltiples tipos de inmueble, múltiples municipios y múltiples zonas.
- Presupuesto mínimo/máximo.
- Habitaciones, baños, puestos y metraje.
- Características obligatorias y deseables.
- Matching explicable con puntaje 0–100.
- Filtros de coincidencias: Todos, 90%+, 80%+.
- Razones a favor y puntos a revisar.
- Acceso desde un match a la ficha original del inmueble.
- Recalculo automático cuando cambia el inventario.
- Compradores y matches quedan incluidos en los respaldos existentes.
- Si el respaldo automático de Dropbox está activo, también se actualiza después de guardar/eliminar compradores.

## Arquitectura
No cambia la versión de IndexedDB: los stores `buyers` y `matches` ya existían desde Radar Core v0.5.0.
Por lo tanto, no hay migración destructiva de base.

## Matching v1
El motor pondera:
- operación,
- tipo de inmueble,
- ubicación,
- presupuesto,
- habitaciones/baños/puestos,
- metraje,
- características obligatorias/deseables,
- recencia de la publicación.

Las coincidencias son orientativas y explicables. Los datos no detectados bajan puntuación en lugar de descartar automáticamente el inmueble.
