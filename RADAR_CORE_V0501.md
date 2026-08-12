# Radar Inmobiliario v0.5.0.1 CORE DEV

Actualización de interfaz sobre v0.5.0 CORE.

## Cambios
- La cabecera muestra `v0.5.0.1 CORE`.
- El contador principal ahora dice **inmuebles únicos**.
- Radar Core usa 4 tarjetas separadas y legibles.
- Se añade **promedio de apariciones por inmueble**.
- Se muestra el resumen: publicaciones vinculadas → inmuebles únicos.
- Se actualiza la caché PWA (`v0501`) para forzar la renovación en iPhone.
- No se cambia la estructura de IndexedDB ni la lógica de deduplicación/importación.

## Despliegue
Subir todos los archivos de este ZIP a la rama `radar-v050-dev`, reemplazando los archivos homónimos.
Netlify detectará el commit y desplegará automáticamente.
