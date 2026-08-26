# Radar Inmobiliario V0.6 — Arquitectura profesional

## Principios de integridad

Radar separa el hecho físico (`master_properties`) de cada evidencia recibida (`source_posts`). Una propiedad puede tener múltiples apariciones sin multiplicarse en búsqueda, matching, solicitudes o selecciones. Los registros legados de `properties` y el importador ZIP permanecen intactos y alimentan la capa maestra mediante `syncRadarCore()`.

```text
WhatsApp ZIP ─┐
WhatsApp secundario ─┼─> extracción > evidencia > normalización > deduplicación
Fuentes externas ────┘                                      │
                                               master_properties
                                      ┌─────────┼──────────────┐
                                   Buscar   Compradores    Solicitudes
                                                           │
                                                    revisión humana
                                                           │
                                                     selección pública
```

Nunca se copian datos de un candidato maestro al análisis de una publicación externa. La evidencia, confianza y conflictos pertenecen al dato observado; el matching solo relaciona entidades.

## Persistencia local y migración

IndexedDB `grupos-inmobiliarios` usa esquema 7. La migración V6→V7 es aditiva y crea:

- `requests`: criterios estructurados, texto original, comprador opcional y fecha de última selección.
- `selections`: lista revisada de `master_property_ids`, estado, expiración, URL y notas internas.
- `selection_history`: inmuebles enviados por solicitud/comprador para detectar opciones nuevas.

No elimina ni vacía ningún store. Los índices nuevos cubren comprador, solicitud, estado, slug y fechas. El respaldo usa esquema 3 e incluye los tres stores nuevos; migraciones V1/V2 rellenan stores ausentes con arreglos vacíos. Tokens, sesiones y secretos nunca forman parte del respaldo.

## Pipeline y fuentes

- `whatsapp_zip`: método estable y obligatorio; conserva historial e inventario existente.
- `whatsapp_secondary`: contrato preparado por `SourceIngestion`; su transporte debe mantenerse separado del PWA.
- Fuentes web: adaptadores detectan plataforma y fallan honestamente ante login walls o datos inaccesibles.
- OCR: debe ejecutarse fuera del hilo principal, conservar el original, reutilizar SHA-256 y producir estados `pending`, `processing`, `completed`, `review` o `failed`. Un OCR dudoso no crea hechos confirmados.

Cada aparición conserva fechas separadas: `published_at`, `importedAt/ingested_at`, `first_seen_at` y `last_seen_at`. La recencia usa `last_seen_at`.

## Solicitudes

`request-utils.js` ofrece un parser controlado de lenguaje natural. Extrae operación, tipos, ubicaciones del catálogo, presupuesto, espacios y características. El resultado siempre se muestra antes de buscar; las ambigüedades nunca se resuelven silenciosamente.

El matching se ejecuta exclusivamente contra `master_properties` y reutiliza las reglas estrictas de compradores:

- `exact`: todos los requisitos obligatorios conocidos y satisfechos.
- `verify`: falta evidencia para confirmar uno o más requisitos.
- `alternative`: existe una desviación conocida permitida por tolerancia.

Una propiedad sin precio no puede ser exacta si existe presupuesto máximo. Una propiedad sobre el tope no puede ser exacta. Varias publicaciones del mismo maestro producen un solo resultado.

## Selecciones y privacidad

La publicación sigue el flujo `solicitud → matching maestro → revisión humana → selección → link`. Nunca se publica directamente un `source_post`.

`selection-utils.js` usa una lista positiva de campos públicos. Se excluyen IDs internos, captadores, teléfonos, grupos, mensajes originales, evidencias, scores, notas y metadatos técnicos. La página pública es mobile-first, `noindex` y solo consume `/api/selections/:slug`.

La Function `netlify/functions/selections.js`:

- usa `@netlify/blobs` con consistencia fuerte y store `radar-public-selections-v060`;
- exige `RADAR_SELECTION_ADMIN_TOKEN` para crear, actualizar o desactivar;
- permite lectura anónima solo a slugs criptográficos activos y no vencidos;
- limita el cuerpo a 250 KB y responde errores genéricos;
- no registra payloads, tokens ni datos inmobiliarios.

La credencial administrativa se introduce en un campo `password`, se utiliza una vez y no se guarda en IndexedDB, localStorage ni archivos. Debe configurarse como secreto únicamente en el contexto de rama antes de probar publicación remota.

## Cache y PWA

El cache `v0601-professional-requests` usa network-first, elimina caches Radar anteriores durante activación e incluye los módulos de Solicitudes y la vista pública. Safari recibe `RADAR_VERSION_READY` al activarse el service worker nuevo.

## Validación

La suite cubre precios, deduplicación, ZIP, matching, respaldo, migración V6→V7, parser de solicitudes, privacidad, expiración/desactivación y autenticación de la API. `npm run check` valida sintaxis, imports, ciclos, IDs críticos y assets del service worker.

## Pendientes que requieren entorno real

- Safari/iPhone físico y ciclo completo de actualización del service worker.
- Netlify Branch Deploy con `RADAR_SELECTION_ADMIN_TOKEN` y Blobs reales.
- Imágenes reales y OCR asíncrono (arquitectura definida; motor OCR no incluido en esta entrega).
- WhatsApp secundario real, QR y sesión (fuera del alcance de esta rama y de esta entrega).
- APIs/OAuth de Instagram, Facebook, MercadoLibre y Dropbox con credenciales del usuario.
