# Changelog V0.6 — Solicitudes profesionales

## Problemas identificados

- No existía un módulo que convirtiera necesidades comerciales en consultas sobre inmuebles maestros.
- No había historial para distinguir propiedades ya enviadas de opciones nuevas.
- IndexedDB no tenía stores para solicitudes, selecciones ni envíos.
- No existía una representación pública con lista positiva de campos ni expiración/desactivación.
- El cache V0.6 no conocía los nuevos módulos.

## Implementación

- Parser controlado de solicitudes en lenguaje natural con confirmación visible.
- Formulario estructurado para operación, tipos, zonas, presupuesto, espacios y características.
- Matching maestro separado en exactas, por verificar y alternativas.
- Selección manual, selección masiva revisable e historial comercial.
- Migración aditiva IndexedDB V6→V7 y respaldo V3.
- Sanitización pública sin IDs internos, captadores, teléfonos, grupos, mensajes, notas ni scores.
- Function autenticada para crear/actualizar/desactivar y lectura pública por slug criptográfico.
- Vista pública mobile-first con expiración y estado desactivado.
- Cache `v0601-professional-requests` y validación estática ampliada.
- Exclusión explícita de `.netlify`, sesiones y caches de WhatsApp en `.gitignore`.

## Pruebas añadidas

- Locales hasta $40.000.
- Casa/townhouse en cuatro zonas hasta $150.000.
- Un maestro con varias fuentes aparece una vez.
- Precio ausente queda por verificar.
- Selección contiene exactamente los maestros elegidos.
- Payload público no filtra información interna.
- Link vencido o desactivado no entrega inventario.
- Propiedad ya enviada no vuelve a marcarse como nueva.
- Escrituras requieren Bearer y validan auth antes de inicializar Blobs.
- Migración V6→V7 conserva inventario y respalda stores nuevos.

## Riesgos y límites

- No se desplegó ni se probó contra Netlify Blobs real.
- Publicar links requiere configurar `RADAR_SELECTION_ADMIN_TOKEN` solo en el contexto de rama.
- OCR, WhatsApp real y APIs externas continúan requiriendo fases y credenciales separadas.
- La validación Safari/iPhone debe realizarse en dispositivo físico.
