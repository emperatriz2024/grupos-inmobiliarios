# RADAR INMOBILIARIO — Auditoría de arquitectura V0.6.0

**Estado:** auditoría inicial previa a implementación
**Rama:** `radar-v060-professional-audit`
**Commit base:** `e0e043e7699aab0dc830693506aaa1b2289cc4d8`
**Objetivo:** evolución conservadora, auditable y compatible con la base V0.5.x.

## 1. Resumen ejecutivo

La aplicación es una PWA local-first sin proceso de compilación. Usa módulos ES nativos, IndexedDB, Web Worker para ZIP, OAuth PKCE de Dropbox y un Service Worker. La V0.5.3 ya contiene una capa paralela de `master_properties` y `source_posts`, compradores, matching, territorio y fuentes externas. Esa base permite evolucionar sin reescritura ni borrado de datos.

Los riesgos principales son: política de precio insuficientemente estricta ante múltiples montos; deduplicación binaria y poco explicable; falta de abstracción común de ingestión; restauración destructiva por tabla sin preparación transaccional; falta total de pruebas automatizadas; obtención externa todavía manual; y dos archivos monolíticos (`app.js`, 1.548 líneas, y `db.js`, 993 líneas).

La estrategia V0.6 será incremental: conservar stores y APIs existentes, agregar metadata/versiones con valores por defecto, extraer funciones de dominio puras, endurecer decisiones automáticas y mantener intervención manual. No se borrará IndexedDB, no se limpiará `localStorage`, no se retirará el ZIP y no se incorporarán integraciones ficticias.

## 2. Mapa actual

| Área | Archivo(s) | Responsabilidad observada |
|---|---|---|
| UI y orquestación | `index.html`, `app.js`, `styles.css` | navegación, búsqueda, importación, compradores, fuentes, backup, Dropbox, render HTML |
| Parser | `engine.js`, `intent-utils.js`, `date-utils.js` | chat WhatsApp, intención, extracción estructurada y evidencia |
| Persistencia | `db.js` | esquema IndexedDB v6, CRUD, Core, fuentes, vigencia, compradores, backup |
| Dedupe | `dedupe-utils.js`, `external-source-utils.js` | consolidación WhatsApp y candidatos externos |
| Búsqueda | `search-utils.js`, `location-utils.js` | filtros, normalización, relevancia y vigencia |
| Territorio | `location-catalog.js` | catálogo, alias, candidatos pendientes y matching territorial |
| Contactos | `contact-utils.js` | lectura CSV/VCF/JSON, normalización y resolución |
| Dropbox | `dropbox.js` | OAuth PKCE, carpetas, descarga, movimiento y respaldos |
| ZIP | `zip-reader.js`, `worker.js` | descompresión y procesamiento fuera del hilo UI |
| PWA | `sw.js`, `manifest.webmanifest` | precache, network-first y actualización |

No hay `package.json`, runner de pruebas, lint ni CI local. Hay dos archivos de 2 bytes (`App` y `grupos_inmobiliarios_mobile_v02`) cuyo propósito no está documentado; se conservan.

## 3. Modelo de datos

IndexedDB `grupos-inmobiliarios`, versión 6, contiene:

- legado: propiedades, importaciones y favoritos;
- directorio: contactos;
- territorio: municipios, zonas, conjuntos y pendientes;
- Radar Core: inmuebles maestros y publicaciones fuente;
- CRM: compradores y matches;
- sincronización: cola.

La relación maestro/fuente ya existe y debe ser la autoridad conceptual: un maestro puede tener N `source_posts`. La tabla legado debe seguir disponible durante la migración. Los registros fuente actuales necesitan metadata uniforme: `sourceType`, `sourceChannel`, `sourceId`, `importedAt`, `publishedAt`, manteniendo simultáneamente los nombres snake_case existentes para compatibilidad.

### Riesgos de datos

1. `masterSnapshot` puede propagar campos de una aparición a un maestro sin conservar evidencia por campo completa.
2. El precio del maestro puede refrescarse por recencia aunque la evidencia no sea inequívoca.
3. La restauración limpia y repuebla cada store secuencialmente; un fallo intermedio puede dejar una base parcialmente reemplazada.
4. `clearDatabase()` existe como API exportada; no debe invocarse en flujos V0.6.
5. El backup usa `backup_version: 1` y `app_version: 0.5.3`; falta `schemaVersion`, migración explícita y prevalidación profunda.

## 4. Parser y trazabilidad

Fortalezas: limpieza Unicode, detección MDY/DMY, filtro de demanda, extracción detallada con línea de evidencia y confianza, separación `2 + estudio` por regex de etiqueta, y procesamiento en Worker.

Riesgos:

- los candidatos de precio se eligen por score aunque dos precios principales incompatibles puedan ser ambiguos;
- `ref` se considera etiqueta comercial, pudiendo confundir códigos como `25-8282`;
- no hay modelo explícito para precio anterior, cuota, financiamiento y precio principal;
- estudio y habitación de servicio no se guardan como campos separados;
- la evidencia no incluye campo fuente, posición y método de extracción de forma uniforme;
- el nombre visible cae en `residence || property_type`, sin política reusable de título.

## 5. Deduplicación

`consolidateProperties` usa buckets y `sameProperty()` booleano. Es conservador entre captadores, pero no expone score, señales ni nivel al usuario. El bucket puede impedir comparar candidatos válidos, mientras reglas basadas en mismo captador/residencia y hechos pueden fusionar unidades distintas del mismo edificio.

La V0.6 requiere un resultado explicable con señales muy fuertes, fuertes, medias y débiles; umbral automático alto; conflictos explícitos; y sugerencias sin fusión para niveles probable/débil. Mismo edificio nunca será suficiente.

## 6. Compradores y matching

La lógica actual ya distingue estricto, alternativa y por verificar, y limita scores con datos obligatorios desconocidos. Esto es una buena base. Deben agregarse pruebas de regresión y asegurar que 100% solo ocurra cuando todos los obligatorios solicitados sean conocidos y cumplidos. Los criterios opcionales no deben compensar incumplimientos ni ausencias obligatorias.

## 7. Fuentes externas

Existe captura manual con candidatos, publicador separado de captador probable, vigencia independiente y evidencia. Falta el flujo URL-first y adaptadores aislados. Un navegador PWA no puede leer de forma confiable páginas con CORS, autenticación o protección anti-bot.

Se implementará un contrato `ExternalSourceAdapter` con detección de capacidad y fallos honestos. Solo metadata pública legítimamente accesible podrá convertirse en borrador. Instagram/Facebook informarán bloqueo cuando corresponda. MercadoLibre quedará preparado para API pública. Campos manuales seguirán como fallback. No se simularán respuestas.

## 8. Contactos y WhatsApp

La normalización venezolana existe, pero debe centralizarse y probarse para `0`, `+58` y `0058`. La resolución ambigua ya evita mostrar teléfono. El mensaje actual solicita “envíame esta propiedad”; debe cambiar al flujo de verificación de disponibilidad y solo abrir `wa.me`, nunca enviar automáticamente. Publicador y captador probable deben conservarse como entidades semánticamente distintas.

## 9. Territorio y búsqueda

El catálogo mantiene municipios, zonas, conjuntos y pendientes. Los desconocidos pasan por revisión, lo cual debe conservarse. Hay normalización de acentos y alias. Se revisarán entradas automáticas para impedir contaminación y se mantendrán coincidencias multi-zona/municipio con precisión.

## 10. ZIP, Dropbox y rendimiento

El ZIP se procesa en Worker, evitando el bloqueo principal durante parsing. La escritura IndexedDB usa lotes y yields. El progreso del Worker solo informa etapas, no avance granular de parsing; es una limitación a documentar. Dropbox aplica OAuth PKCE, reintenta tras 401 y mueve archivos solo después de procesarlos. Los errores no limpian la base, comportamiento que debe preservarse.

Tokens Dropbox se guardan en `localStorage`; no están incluidos en los stores respaldados. La App Key es pública y no es un secreto. Los refresh tokens no deben entrar en exportaciones ni logs.

## 11. Seguridad

La UI usa plantillas `innerHTML`, mayormente con `esc()`. Debe centralizarse validación de URLs y evitar interpolar esquemas peligrosos. Los enlaces externos deben aceptar solo `http:`/`https:` y usar `noopener noreferrer`. Ningún HTML externo debe interpretarse. El logging debe redactar tokens, URLs sensibles y texto personal excesivo.

## 12. PWA y UX móvil

El Service Worker es network-first con cache versionado `0530` y `skipWaiting`, pero no comunica al cliente que hay versión nueva y usa claves de caché distintas para URLs con/sin query. Debe actualizarse a V0.6, purgar únicamente caches propios anteriores y preservar IndexedDB. Se revisarán safe areas, altura dinámica, botones táctiles, modales y reset del formulario externo.

## 13. Código muerto y duplicación

- Funciones de scoring antiguas (`criterionScore`, `priceScore`, `areaScore`, `featuresScore`) conviven con la ruta efectiva de `scoreBuyerMaster`; son candidatas a retirada futura, no se eliminarán en esta fase conservadora.
- Normalización, tokenización, Jaccard, parseo numérico y escape se repiten en varios módulos.
- `app.js` contiene dominio de fuentes, backup y contactos además de UI.
- `db.js` mezcla migraciones, repositorios y políticas de negocio.
- Los dos archivos de 2 bytes no tienen referencias detectadas; se conservarán por la regla de no eliminar.

## 14. Plan de implementación seguro

1. Introducir constantes de versión, metadata de origen, diagnóstico y contratos de ingestión sin alterar stores existentes.
2. Endurecer precio y extracción, incluyendo ambigüedad y clasificación de montos.
3. Convertir dedupe en score explicable con umbral automático conservador.
4. Añadir adaptadores externos y flujo URL-first con fallback honesto y botón limpiar.
5. Fortalecer nombres, teléfonos, WhatsApp y matching.
6. Elevar backup a schema V2 con migración V1→V2, validación previa y restauración preparada de forma transaccional cuando sea viable.
7. Actualizar PWA/UX y cache a V0.6 sin tocar IndexedDB.
8. Incorporar pruebas Node para funciones puras y los 12 casos obligatorios.

## 15. Invariantes de compatibilidad

- No llamar `indexedDB.deleteDatabase()` ni `localStorage.clear()`.
- No eliminar stores ni registros por migración automática.
- Conservar nombres de stores, claves e índices existentes.
- Aceptar respaldos V1 y migrarlos en memoria antes de restaurar.
- Mantener ZIP como canal principal y Dropbox como transporte opcional.
- Mantener la aplicación operativa sin proveedor para WhatsApp secundario.
- No afirmar datos sin evidencia; desconocido se conserva como `null`/por verificar.
- No realizar merge, deploy, push ni cambios de producción.

## 16. Adenda de validación y hardening

La segunda auditoría independiente confirmó los límites generales del diseño y corrigió varios supuestos de la primera fase:

- Se retiró del arranque la purga física de propiedades/favoritos antiguos. La vigencia se aplica como filtro; el historial no se destruye.
- La migración territorial inicial ya no limpia `location_pending` antes de recalcular.
- La migración de respaldo ahora rechaza tablas presentes con tipo inválido; antes podía convertirlas silenciosamente en arrays vacíos.
- El precio `Antes $90.000 ahora $82.000` reveló que ambos montos heredaban contexto de toda la línea. La selección ahora usa el marcador contextual más cercano anterior al monto.
- `No tiene puesto` se representa como cero con evidencia alta; ausencia de texto continúa como `null`.
- Matching distingue cero conocido de dato desconocido y nunca convierte sobreprecio en coincidencia estricta: requiere tolerancia para mostrarse como alternativa.
- Dedupe exige al menos dos hechos compatibles además de teléfono + conjunto para auto-fusión.
- `refreshExternalMasterVigency` pasó de filtrar todas las fuentes por cada maestro a un índice `Map` por maestro.
- ZIP grande informa progreso cada 250 mensajes desde el Worker.
- Se añadieron `100dvh`, scroll de diálogo, inputs móviles de 16 px y targets táctiles mínimos.
- La comprobación automatizada valida imports locales, ciclos, IDs críticos, assets del Service Worker y operaciones prohibidas.

Estado validado: 29/29 pruebas automatizadas, 24 módulos JS sin ciclos y arranque/navegación local sin errores de consola. Las pruebas con base real, Dropbox real, iPhone físico y plataformas externas autenticadas permanecen fuera del entorno de validación y no se presumen aprobadas.
