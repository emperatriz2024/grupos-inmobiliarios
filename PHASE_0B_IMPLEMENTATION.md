# Phase 0B — implementación

- `identity-v1` genera candidatos mediante bloques y explica señales/conflictos. `AUTO_LINK` exige evidencia fuerte sin conflicto duro; pHash aislado nunca fusiona.
- SHA-256 identifica bytes exactos. dHash de una muestra gris 9×8 aporta únicamente una señal perceptual mantenible.
- `MediaStorageAdapter` desacopla el proveedor; las pruebas usan memoria. Derechos empiezan en `UNKNOWN` y el uso cliente exige `OWNED` o `AUTHORIZED` más acción explícita.
- OWN/MARKET/UNKNOWN solo cambia por `USER_CONFIRMED`; datos de captación se guardan aparte y se excluyen de serialización pública.
- PostgreSQL `002` e IndexedDB V7 son aditivos. Backup V3 acepta V1/V2 e inicializa stores 0B ausentes sin borrar inventario.
- `RADAR_IDENTITY_MEDIA_ENABLED` permanece apagado salvo valor afirmativo explícito. ZIP y WhatsApp secundario conservan su flujo textual aunque falle media.
