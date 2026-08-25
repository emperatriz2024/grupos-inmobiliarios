# V0.6.2 — Preparación de despliegue Fly TEST

Esta fase no crea recursos.

1. Revisar `deploy/cloud-bridge/Dockerfile` y construir desde la raíz.
2. Copiar `fly.toml.example` fuera de Git como `fly.toml` y sustituir nombre/región.
3. Crear exactamente una app TEST, una Machine y un volumen `radar_whatsapp_data` montado en `/data`.
4. Configurar como secretos `RADAR_BRIDGE_INGEST_URL` y `RADAR_BRIDGE_INGEST_TOKEN`.
5. Desplegar primero con `RADAR_BRIDGE_MODE=test`; validar health, persistencia y reinicio.
6. Para el primer vínculo, usar temporalmente `live` y `RADAR_BRIDGE_BOOTSTRAP_MODE=true` en una terminal administrativa segura. No capturar logs. Tras READY, desactivar bootstrap y reiniciar.
7. Confirmar count=1, `auto_stop_machines="off"`, restart always y health `/health`.

El volumen contiene sesión, Chromium, outbox y estado. No contiene secretos. Nunca ejecutar dos Machines contra la misma sesión. Consultar recursos y precios vigentes antes de provisionar; Chromium requiere observación real de memoria.

La plantilla sigue la [configuración oficial de Fly](https://fly.io/docs/reference/configuration/): mount, `http_service`, autostop desactivado, checks y restart policy.
