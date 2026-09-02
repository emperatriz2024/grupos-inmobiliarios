# Radar Inmobiliario v0.5.3 — Vigencia Inteligente

## Objetivo
Evitar que inventario externo viejo o no disponible siga entrando en el matching de compradores.

## Reglas
- 0–7 días: Recién publicada.
- 8–15 días: Vigente probable.
- 16–20 días: Verificar vigencia.
- Más de 20 días: Vencida por antigüedad.
- Confirmación manual: vigencia confirmada por 7 días.
- No disponible: excluida cuando no existe otra fuente activa del mismo inmueble.

## Importante
Las fuentes WhatsApp conservan su regla de 60 días.
La vigencia se calcula por fuente. Un inmueble maestro puede seguir activo si otra fuente del mismo inmueble continúa vigente.

## Matching
El matching de compradores excluye:
- inmuebles maestros `stale`;
- no disponibles;
- inventario exclusivamente externo con más de 20 días sin verificación reciente.

## Acciones
En Importar > Fuentes externas > Vigencia Inteligente:
- Confirmar vigente.
- No disponible.
- Reactivar revisión.
- Abrir publicación.
- Recalcular vigencia.
