# RADAR INMOBILIARIO — Validación y hardening V0.6.0

## VEREDICTO

**A) APTO PARA PRUEBA EN ENTORNO SEPARADO**

Este veredicto no significa apto para producción. La versión puede pasar a una prueba controlada con copia de respaldo y datos no únicos. No se recomienda aún usarla como única instancia con la base real hasta completar las verificaciones marcadas **NO VERIFICADO**.

## Alcance y entorno

- Rama: `radar-v060-professional-audit`
- Commit base: `e0e043e7699aab0dc830693506aaa1b2289cc4d8`
- Aplicación servida solo en `127.0.0.1`, puerto temporal.
- IndexedDB de prueba aislada por origen local; no se abrió ni modificó la base real del usuario.
- Sin Dropbox real, Netlify, push, merge, deploy ni credenciales externas.

## Resultado cuantitativo

- Pruebas automatizadas ejecutadas: **29**
- Aprobadas: **29**
- Fallidas al cierre: **0**
- Validación de arquitectura: **24 archivos JS, 0 ciclos, imports y assets correctos**
- Consola en arranque/navegación: **0 errores, 0 warnings**
- Fixture grande: **3.000 mensajes/publicaciones sintéticas**, aproximadamente 11,6–12,7 s en ejecución Node; progreso cada 250 mensajes.

## Bugs encontrados en esta segunda pasada

1. `Antes $90.000 ahora $82.000` elegía $90.000 porque ambos candidatos heredaban flags de toda la línea.
2. `0058414...` generaba un número `wa.me` incorrecto.
3. `No tiene puesto` quedaba como desconocido.
4. Parking explícito cero era convertido a desconocido por matching.
5. Un precio sobre presupuesto podía ser estricto al estar dentro de la tolerancia.
6. Teléfono + conjunto podía auto-fusionar sin suficientes hechos de distribución.
7. Una tabla corrupta de backup podía convertirse silenciosamente en array vacío durante migración.
8. `loadData()` purgaba físicamente propiedades/favoritos fuera de vigencia en cada arranque.
9. La migración territorial limpiaba pendientes antes de regenerarlos.
10. La auditoría de precio seguía marcada `0511`, por lo que registros ya auditados no recibían la política V0.6.
11. La vigencia externa recorría todas las fuentes por cada maestro, complejidad O(maestros × fuentes).
12. El Worker informaba etapas, pero no progreso durante parsing grande.
13. Inputs móviles pequeños podían activar zoom iOS; faltaban `dvh`, scroll explícito del diálogo y targets táctiles uniformes.

## Bugs corregidos

Todos los 13 defectos anteriores quedaron corregidos y cubiertos por pruebas o validación estática. La purga y el clear territorial permanecen como APIs legacy sin llamadas desde el flujo de arranque; el botón de borrado continúa deshabilitado.

## Arquitectura

**APROBADO en alcance local.**

- Todos los imports relativos resuelven.
- No se detectaron dependencias circulares.
- Los nuevos módulos `core`, `external`, `ingestion` y diagnóstico cargan correctamente.
- IDs críticos de UI son únicos.
- No se detectaron listeners globales duplicados en la inspección de `app.js`.
- `app.js` inicia sin `Can't find variable` ni errores de módulos.
- El Core no importa adaptadores de ingestión; los mecanismos dependen del Core, no al revés.

## Arranque e IndexedDB

- Base vacía aislada: **APROBADO**.
- Interfaz y versión: **APROBADO**.
- Buscar / Compradores / Importar / Guardadas: **APROBADO**.
- Segundo arranque con IndexedDB ya inicializada: **APROBADO** (catálogo persistente 164 zonas/7 conjuntos).
- Base real de ~1.300 maestros/~7.000 fuentes: **NO VERIFICADO**. No se usaron datos reales por regla de seguridad.
- Migración desde una copia completa real V0.5: **NO VERIFICADO**. La migración pura V1→V2 sí está aprobada e idempotente.

## Importación ZIP

- Lector ZIP stored, `_chat.txt`, decoder, fechas y filtro 60 días: **APROBADO**.
- Parser → propiedades y metadata `whatsapp_zip/primary_number`: **APROBADO**.
- Dedupe y múltiples apariciones: **APROBADO**.
- Worker y escritura por lotes: **REVISADO ESTÁTICAMENTE**.
- Progreso de parsing: **APROBADO** mediante callback cada 250 mensajes y mensajes del Worker.
- Chat sintético de 3.000 publicaciones: **APROBADO**, sin trabajo en el hilo UI por diseño Worker.
- Flujo visual selector ZIP → procesamiento → IndexedDB: **NO VERIFICADO E2E**. El navegador de automatización no abrió su selector de archivo; no se atribuye el fallo a la aplicación. El control existe y la capa ZIP real está cubierta por fixture automatizado.
- ZIP actuales reales exportados desde iPhone: **NO VERIFICADO**; se requiere una copia no sensible o prueba manual en entorno separado.

## Dropbox

- Carpetas y constantes de flujo existentes: `CHAT_PENDIENTES`, `CHAT_PROCESADOS`, `CONTACTOS`, `CONTACTOS_PROCESADOS`, `RADAR_RESPALDOS`.
- Estado desconectado/token faltante: **APROBADO**; falla antes de operaciones remotas y no toca IndexedDB.
- Reintento 401 y errores de red/archivo: **REVISADO ESTÁTICAMENTE**.
- Cuenta Dropbox real, movimiento pendiente→procesado y restauración remota: **NO VERIFICADO**, requieren OAuth y archivos reales. No se ejecutaron operaciones destructivas.

## Precio y extracción

**APROBADO para los casos exigidos.**

- $130.000 con 70 m², habitaciones y teléfono.
- Código 25-8282 con $75.000.
- Canon $700 con depósito/adelantados.
- Antes $90.000 / ahora $82.000, conservando candidato anterior.
- Sin precio y solo condominio $120 → `null`.
- Área, habitaciones + estudio, habitación de servicio, baños + servicio, parking 2, parking cero explícito y parking desconocido.
- El precio confirmado fluye parser → master → formato de tarjeta/filtro → matching sin reinterpretación adicional.

## Dedupe

**APROBADO para los escenarios exigidos.**

- Cinco apariciones iguales → un consolidado/cinco fuentes.
- Mismo edificio/metraje no basta.
- Teléfono + conjunto requiere además hechos compatibles.
- Municipio + tipo permanece señal débil.
- Las fuentes conservan registros independientes; el enlace externo a maestro sigue bajo decisión explicable/manual.

## Buyers / matching

**APROBADO para los escenarios exigidos.**

- Parking desconocido → por verificar, nunca 100%.
- Todos los obligatorios cumplidos → puede llegar a 100%.
- Sobreprecio sin tolerancia → excluido.
- Sobreprecio dentro de tolerancia explícita → alternativa, nunca estricto.

## Fuentes externas

- Validación HTTP/HTTPS y rechazo `javascript:`/`data:`: **APROBADO**.
- Metadata pública OpenGraph: **APROBADO con fetch simulado determinista**.
- Fallo CORS/bloqueo: **APROBADO**, devuelve mensaje honesto sin contenido inventado.
- MercadoLibre API pública: **IMPLEMENTADO, NO VERIFICADO EN VIVO** por depender de red/URL real.
- Instagram/Facebook en vivo: **NO VERIFICADO** y puede requerir API/OAuth/servicio autorizado.
- XSS en campos revisados: **APROBADO estáticamente** mediante texto/escape y validación URL; no se ejecuta HTML externo.

## Limpiar, captador y WhatsApp

- Reset temporal del formulario/análisis: **APROBADO en navegador**.
- No llama IndexedDB ni borra capturas guardadas: **APROBADO por inspección**.
- Publisher separado de captador probable: **APROBADO**.
- `0414`, `+58414`, `0058414` → mismo formato internacional: **APROBADO**.
- Enlace solo con teléfono y mensaje prellenado, sin envío automático: **APROBADO**.

## Backup

- `schemaVersion=2`, buyers, fuentes externas, fuentes WhatsApp y aliases territoriales: **APROBADO**.
- Migración V1→V2 repetida dos veces: **APROBADO, idempotente**.
- Tabla corrupta: **APROBADO, rechazada antes de restaurar**.
- Restauración atómica multi-store: **REVISADA ESTÁTICAMENTE**.
- Restauración sobre base real completa: **NO VERIFICADO** por seguridad.
- Tokens/secretos Dropbox: no forman parte de `BACKUP_STORE_NAMES`; **APROBADO**.

## Service Worker / PWA

- Cache `v0600-professional-audit`: **APROBADO estáticamente**.
- Install/activate, `skipWaiting`, `clients.claim`, assets existentes: **APROBADO estáticamente**.
- Eliminación limitada al prefijo propio: **APROBADO**.
- No existen llamadas a borrar IndexedDB/localStorage durante actualización: **APROBADO**.
- Navegación offline real y reemplazo desde una V0.5 instalada: **NO VERIFICADO** en el harness disponible.

## Mobile / iPhone

- Safe areas superior/inferior, padding bajo barra, `100dvh`, scroll de dialogs, input 16 px y targets 44 px: **APROBADO estáticamente**.
- Layout estándar de escritorio y diálogos: **APROBADO en navegador**.
- El override móvil del navegador no se aplicó (reportó 1280×720), por lo que breakpoint 390×844: **NO VERIFICADO**.
- iPhone físico, Safari PWA, Chrome iOS y teclado: **NO VERIFICADO**.

## Segundo WhatsApp

- `SecondaryWhatsAppSource`: **APROBADO como adaptador futuro no configurado**.
- Metadata distingue `whatsapp_zip/primary_number` y `whatsapp_secondary/secondary_number`.
- No sustituye ZIP y no pretende conectarse sin proveedor.
- Operación real requiere WhatsApp Business Platform/proveedor autorizado, número, servidor/webhook y credenciales: **NO VERIFICADO / NO CONFIGURADO**.

## Performance

- Escritura legacy por lotes de 250 y Worker ZIP: conservados.
- Progreso cada 250 mensajes: agregado.
- Vigencia externa indexada por `master_id`: corregido de O(M×S) a O(M+S).
- Render principal limita inicialmente 30 tarjetas y territorio pendiente limita 80.
- Dataset sintético extremo de 3.000 publicaciones: ~11,6–12,7 s en Node. Es estable, pero sigue siendo una operación costosa; ocurre en Worker en navegador.
- Dataset real 1.300/7.000/contactos en iPhone: **NO VERIFICADO**.

## Seguridad e integridad

- `indexedDB.deleteDatabase()`: no existe.
- `localStorage.clear()`: no existe.
- Purga automática de inventario: retirada del arranque.
- Clear de pendientes: retirado de migración automática.
- Borrado masivo UI: deshabilitado.
- URLs externas: allowlist de protocolos.
- Logs: limitados y con redacción básica.

## Riesgos restantes / errores pendientes

No hay fallas automatizadas pendientes. Permanecen riesgos de validación externa:

1. prueba con copia completa de la base real;
2. prueba manual de ZIP real y selector en iPhone;
3. prueba OAuth/errores/movimiento/backup Dropbox en sandbox;
4. prueba de actualización/offline desde instalación V0.5;
5. prueba física Safari/Chrome iOS y teclado;
6. APIs reales de MercadoLibre, Instagram/Facebook y futuro WhatsApp secundario.

Ninguno de estos puntos autoriza producción. Son condiciones para la siguiente fase controlada.
