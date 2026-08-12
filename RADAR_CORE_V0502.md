# Radar Inmobiliario v0.5.0.2 CORE DEV

## Objetivo
Evitar que el inventario dependa únicamente de IndexedDB en un navegador del iPhone.

## Incluye
- Respaldo completo descargable en JSON.
- Restauración manual desde un respaldo JSON con confirmación previa.
- Guardar/actualizar un respaldo único en Dropbox: `/RADAR_RESPALDOS/radar-backup-latest.json`.
- Restaurar el último respaldo directamente desde Dropbox.
- Opción de respaldo automático en Dropbox después de cada importación.
- El respaldo NO guarda tokens, contraseñas ni credenciales OAuth.
- Radar Core se fuerza a cuadrícula 2×2 en móvil.
- Caché PWA actualizada a `v0502`.

## Seguridad de datos
La restauración reemplaza la base local solo después de mostrar un resumen y pedir confirmación.
La app estable (`main`) no debe modificarse mientras esta versión permanezca en pruebas.
