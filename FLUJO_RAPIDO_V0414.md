# v0.4.14 PRO — Procesamiento rápido y bandeja limpia

## Qué cambia
- `CHAT_PENDIENTES` funciona como bandeja temporal: después de un proceso correcto, el ZIP se mueve y desaparece de Pendientes.
- `CHAT_PROCESADOS` mantiene una sola copia vigente por grupo.
- El reemplazo se hace dentro de Dropbox, de servidor a servidor; el iPhone ya no vuelve a subir el ZIP después de descargarlo.
- El historial local conserva solo el último estado de cada grupo, en lugar de acumular una importación nueva cada vez.
- Si el archivo de Dropbox es exactamente igual al último procesado (`content_hash`), se archiva sin volver a analizarlo.
- Después de que v0.4.14 tenga un punto de control para un grupo, las exportaciones siguientes analizan solo novedades con 48 horas de solapamiento de seguridad.
- La lista completa de propiedades se recarga una sola vez al terminar toda la cola, no después de cada ZIP.

## Seguridad
- Si el procesamiento o el movimiento falla, ese ZIP permanece en `CHAT_PENDIENTES` para reintentar.
- La vigencia máxima sigue siendo 60 días.
- El solapamiento de 48 horas evita perder mensajes cercanos al último procesamiento.
