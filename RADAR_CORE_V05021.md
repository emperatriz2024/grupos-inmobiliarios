# Radar Inmobiliario v0.5.0.2.1 CORE DEV — iPhone Backup Fix

Corrección específica para guardar respaldos en iPhone/iOS.

## Problema corregido
El flujo anterior generaba un Blob y lanzaba una descarga programática después de una operación asíncrona.
En algunos navegadores iOS el archivo no quedaba materializado en Archivos.

## Nuevo flujo
1. **Preparar respaldo**
2. La aplicación muestra nombre y tamaño del archivo.
3. **Guardar en Archivos**
4. Se abre el menú nativo de iPhone.
5. Elegir **Guardar en Archivos** → iCloud Drive o En mi iPhone.

También queda una opción **Descarga directa** como alternativa.

## Seguridad
- No cambia IndexedDB ni la lógica de propiedades.
- No elimina inventario.
- No modifica la deduplicación.
- Mantiene el respaldo de Dropbox de v0.5.0.2.
