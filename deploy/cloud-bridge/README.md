# Radar WhatsApp Secondary Cloud Bridge

Contenedor aislado para un único proceso persistente. No contiene PWA, Netlify Blobs, secretos, sesiones ni datos runtime.

## Reglas operativas

- Una sola Machine y un solo volumen lógico `radar_whatsapp_data` montado en `/data`.
- `RADAR_BRIDGE_MODE=test` es el valor seguro inicial. `live` debe habilitarse explícitamente después de revisión.
- Los secretos `RADAR_BRIDGE_INGEST_URL` y `RADAR_BRIDGE_INGEST_TOKEN` se configuran con el almacén de secretos del proveedor, nunca en `fly.toml`.
- El primer QR solo se muestra en una terminal administrativa efímera con `RADAR_BRIDGE_BOOTSTRAP_MODE=true`; nunca por HTTP ni logs persistentes.
- Después de READY, desactivar bootstrap y reiniciar conservando el volumen.
- No escalar horizontalmente. El lock del runtime es una segunda barrera, no una autorización para crear otra Machine.

## Persistencia

`/data/radar-whatsapp-secondary` contiene `session`, caché Chromium, `outbox` y `state`. No contiene secretos. Un cierre ordenado destruye el cliente, pero nunca llama `logout`, por lo que LocalAuth permanece.

## Recursos

La plantilla parte de una CPU compartida y 1 GB de memoria por la carga de Chromium. Debe observarse memoria real antes de ajustar. No se documentan precios: deben consultarse en Fly al momento de provisionar.

Sintaxis contrastada con la [referencia oficial de `fly.toml`](https://fly.io/docs/reference/configuration/). Esta fase no crea app, volumen, Machine ni coste.
