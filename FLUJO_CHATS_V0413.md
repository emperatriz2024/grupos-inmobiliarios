# v0.4.13 PRO — Flujo de Chats como Snapshot

## Regla nueva
Cada grupo mantiene UNA sola exportación vigente dentro de CHAT_PROCESADOS.

### Al procesar
1. Descarga ZIP desde CHAT_PENDIENTES.
2. Procesa y actualiza la base local.
3. Guarda el ZIP nuevo en CHAT_PROCESADOS con el mismo nombre.
4. Si ya existía una copia del mismo grupo, la REEMPLAZA silenciosamente.
5. Solo después elimina el ZIP de CHAT_PENDIENTES.

### Resultado
CHAT_PENDIENTES
- Solo contiene archivos que todavía no han sido procesados o que dieron error.
- Después de un proceso correcto queda limpio.

CHAT_PROCESADOS
- Conserva la exportación MÁS RECIENTE de cada grupo.
- No genera Grupo.zip, Grupo (1).zip, Grupo (2).zip...
- Sirve como respaldo actual y como fuente para Reindexar CHAT_PROCESADOS.

### Seguridad
Si falla el guardado en CHAT_PROCESADOS, el archivo NO se elimina de CHAT_PENDIENTES.
Esto permite reintentar sin perder la exportación.
