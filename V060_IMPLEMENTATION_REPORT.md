# RADAR INMOBILIARIO — Informe de implementación V0.6.0

**Edición:** PROFESSIONAL AUDIT (desarrollo, no producción)
**Rama exclusiva:** `radar-v060-professional-audit`
**Commit base y actual:** `e0e043e7699aab0dc830693506aaa1b2289cc4d8`
**Publicación:** no realizada

## Resultado

Se implementó una evolución incremental sobre la arquitectura V0.5.3 sin eliminar el canal ZIP, stores de IndexedDB, datos, funciones de Dropbox ni compatibilidad con respaldos V1. La nueva capa establece políticas conservadoras para evidencia, precios, dedupe, ingestión multi-canal, fuentes externas, respaldos y actualización PWA.

## Cambios realizados

### Extracción y precios

- Se eliminó `ref/referencia` como etiqueta suficiente para confirmar precio.
- Códigos, IDs, referencias internas, cuotas, condominio, servicios y metraje penalizan un candidato monetario.
- Los candidatos guardan rol (`principal`, `current`, `previous`, `rent`, `non_price`, `ambiguous`) y evidencia.
- Dos montos principales igualmente plausibles y materialmente distintos producen `price_usd = null`, estado `ambiguous`; Radar no elige arbitrariamente.
- Una línea explícita `Precio: $130.000` prevalece sobre números ajenos sin contexto.
- Se agregaron `study`, `study_as_bedroom` y `service_bedroom` con evidencia/confianza. `2 + estudio` conserva `bedrooms = 2`.

### Un inmueble, N fuentes

- Se preservó `master_properties` ↔ `source_posts`.
- Las fuentes nuevas reciben metadata camelCase compatible con el requerimiento: `sourceType`, `sourceChannel`, `sourceId`, `importedAt`, `publishedAt`; se mantienen los campos legacy snake_case.
- ZIP usa `whatsapp_zip / primary_number` sin cambiar el identificador legacy `source_type='whatsapp'`.
- La captura externa conserva publicador/vendedor separado del captador probable.

### Dedupe explicable

- `comparePropertyCandidates()` devuelve score, nivel, señales, conflictos y decisión automática.
- Señales de identidad muy fuertes: enlace, referencia, texto canónico idéntico y teléfono + conjunto.
- Mismo tipo/zona son señales débiles.
- Mismo edificio no fusiona por sí solo; la consolidación automática exige score alto más identidad o fingerprint rico sin conflictos.
- La intervención manual existente en Fuentes externas permanece disponible.

### Fuentes externas URL-first

- Se creó el contrato `ExternalSourceAdapter` y adaptadores separados para Instagram, Facebook Marketplace, MercadoLibre y portales.
- `Analizar URL` intenta leer únicamente metadata pública accesible (OpenGraph/metadata).
- MercadoLibre intenta primero su API pública cuando la URL contiene un ID de publicación; luego aplica fallback de metadata.
- CORS, autenticación o bloqueo producen el mensaje honesto “Radar no pudo leer automáticamente esta publicación”; no se inventa texto.
- Se validan URLs y se aceptan solo `http:`/`https:`.
- Se agregó `Limpiar / Nueva publicación`, que limpia formulario, análisis, candidatos y captador probable sin tocar registros guardados.
- Los importes externos solo se convierten en USD comparable cuando la moneda está confirmada.

### Captadores y WhatsApp

- El captador probable muestra confianza, score y apariciones, separado del publicador.
- Si existe teléfono confiable se construye un enlace `wa.me` con consulta prellenada de disponibilidad.
- El mensaje no se envía automáticamente.
- Sin teléfono confiable el botón permanece oculto y sin `href`.
- El mensaje general de contacto se cambió a verificación de disponibilidad y resumen breve.

### Nombres

- Se creó una política reusable: conjunto/residencia válido → nombre explícito válido → tipo + zona → fallback.
- Fragmentos conocidos absurdos y texto accidental no se usan como título.

### Respaldos y migración

- Nuevo `schemaVersion = 2`, `backup_version = 2`, `app_version = 0.6.0`.
- Los respaldos V1 se migran en memoria hacia V2 y reciben metadata de fuente faltante.
- La validación comprueba formato, stores y forma de cada registro antes de escribir.
- La restauración de todos los stores ocurre dentro de una única transacción IndexedDB: si una escritura falla, se aborta el reemplazo completo.
- El resumen informa versión/migración.
- No se incluyen ni consultan tokens Dropbox en el respaldo.
- El borrado masivo quedó deshabilitado en la UI de Professional Audit.

### Segundo WhatsApp e ingestión

- Se creó `SourceIngestion` con adaptadores `WhatsAppZipSource`, `DropboxSource`, `ExternalWebSource` y `SecondaryWhatsAppSource`.
- `SecondaryWhatsAppSource` declara explícitamente `configured: false` y explica que requiere proveedor oficial/autorizado, token/webhook y configuración Business según la solución elegida.
- La ausencia de este proveedor no afecta ZIP, Dropbox ni Core.

### PWA, seguridad y observabilidad

- Identidad visible `V0.6.0 PROFESSIONAL AUDIT`.
- Cache `v0600-professional-audit`, actualización network-first, `skipWaiting`, `clients.claim` y notificación de versión lista.
- Solo se eliminan caches anteriores con prefijo propio; IndexedDB nunca se toca durante la actualización.
- Se agregaron `noopener noreferrer`, validación de enlaces y escape de contenido dinámico en los flujos revisados.
- Diagnóstico moderado en memoria (máximo 100 eventos) con módulo, operación, timestamp, nivel, mensaje y redacción básica de tokens.

## Archivos modificados

- `app.js`
- `db.js`
- `dedupe-utils.js`
- `engine.js`
- `index.html`
- `styles.css`
- `sw.js`

## Archivos creados

- `ARCHITECTURE_AUDIT_V060.md`
- `V060_IMPLEMENTATION_REPORT.md`
- `version.js`
- `diagnostics.js`
- `core/property-policy.js`
- `ingestion/source-ingestion.js`
- `external/adapters.js`
- `tests/professional-audit.test.js`
- `package.json`

## Pruebas y validaciones

`npm test`: **29/29 aprobadas** después de la fase de hardening.

Casos cubiertos:

1. precio $130.000 frente a otro número;
2. código 25-8282 frente a precio $75.000;
3. área 144 m²;
4. 2 habitaciones + estudio;
5. 2 puestos;
6. precio desconocido;
7. cinco apariciones → un maestro/cinco fuentes;
8. dos unidades del mismo edificio no fusionadas;
9. comprador exige puestos y dato ausente no obtiene 100%;
10. backup V1 → V2;
11. teléfono `0414` / `+58414` / `0058` normalizado;
12. política de nombres;
13. adaptador WhatsApp secundario no configurado;
14. seis escenarios estrictos adicionales de precio, incluido antes/ahora, canon y condominio;
15. cero explícito versus estacionamiento desconocido;
16. matching exacto, desconocido y alternativa por tolerancia;
17. dedupe débil/fuerte y teléfono + conjunto;
18. migración idempotente y rechazo de tablas corruptas;
19. lectura de ZIP almacenado y chat sintético de 3.000 publicaciones;
20. adaptadores externos, URL peligrosa, CORS y Dropbox desconectado.

`npm run check`: aprobado.
Validación `node --check` del conjunto JS: aprobada.
Escaneo de patrones prohibidos (`deleteDatabase`, `localStorage.clear`, entrypoints 0.5.3): sin coincidencias.
Prueba local en navegador: carga correcta, cuatro vistas navegables, segundo arranque con IndexedDB inicializada, versión correcta, reset externo correcto, borrado deshabilitado y consola sin errores ni warnings. El flujo visual del selector ZIP no pudo automatizarse con el navegador disponible; está marcado como NO VERIFICADO E2E en el reporte de validación, aunque bytes ZIP, decoder, filtro 60 días y parser sí están cubiertos automáticamente.

`npm run check`: además de sintaxis, valida 24 módulos, imports, ausencia de ciclos, IDs críticos, assets PWA y patrones destructivos prohibidos.

### Correcciones adicionales de hardening

- Se eliminó del arranque la purga destructiva de inventario antiguo y favoritos.
- La migración territorial dejó de limpiar pendientes.
- Se corrigieron precio anterior/actual, normalización `0058`, cero explícito de estacionamiento, matching de sobreprecio y umbral de dedupe.
- Se optimizó vigencia externa para evitar el recorrido maestros × fuentes.
- Se agregó progreso real del parser grande y hardening funcional móvil.

## Compatibilidad

- DB continúa en versión IndexedDB 6 porque no se agregaron ni retiraron stores/índices.
- Se mantienen campos y stores V0.5.x; la metadata V0.6 es aditiva.
- ZIP manual sigue siendo el canal principal.
- Dropbox conserva `CHAT_PENDIENTES`, `CHAT_PROCESADOS`, `CONTACTOS`, `CONTACTOS_PROCESADOS` y `RADAR_RESPALDOS`.
- Restauración acepta respaldos V1 válidos.
- No se llamó `clearDatabase`, `indexedDB.deleteDatabase` ni `localStorage.clear`.

## Limitaciones y trabajo que requiere entorno externo

- Instagram/Facebook pueden bloquear lectura por CORS, login o políticas de plataforma. Automatización completa exige API oficial, OAuth/token, cuenta autorizada o un servicio backend permitido.
- WhatsApp secundario requiere elegir/configurar WhatsApp Business Platform o proveedor autorizado, número, webhook, servidor y credenciales. No se implementó una simulación.
- Dropbox real no se probó contra la cuenta del usuario porque hacerlo requiere OAuth/credenciales y archivos reales; su flujo existente se preservó.
- No se ejecutó migración sobre la base real de ~1.300/7.000 registros en iPhone; las migraciones son aditivas y la restauración fue validada con pruebas puras. Antes de usar con datos reales se recomienda preparar un respaldo V0.5 y probar restauración en un dispositivo secundario.
- El Worker evita congelar la UI, pero el parser todavía reporta progreso por etapas, no por mensaje individual. La escritura sigue usando lotes de 250 con yield.
- No se realizó prueba física en iPhone/Safari ni Chrome iOS; se validó en navegador local de escritorio.

## Git y producción

No se hizo merge, commit, push, force push, deploy, publicación Netlify ni cambio de configuración de producción. `main` y `radar-v050-dev` no fueron modificadas.
