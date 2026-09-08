# WhatsApp Intelligence Collector

Arquitectura de producción: el Radar y sus Functions viven en Netlify; el cliente de WhatsApp vive en un servicio Docker persistente con disco privado. El navegador nunca recibe secretos M2M.

El collector conserva `LocalAuth` en `/data`, publica el QR efímero mediante el proxy del Radar, recorre grupos con cursor durable, descarga originales, genera thumbnails, solicita extracción multimodal y finalmente encola el evento normalizado. Radar converge esos eventos con Property Twin y ejecuta Demand Engine al sincronizar.

Variables privadas del collector: `RADAR_COLLECTOR_M2M_TOKEN`, `RADAR_BRIDGE_INGEST_TOKEN`, `RADAR_BRIDGE_INGEST_URL`, `RADAR_MEDIA_INGEST_URL` y `RADAR_INTELLIGENCE_URL`. Netlify conserva `RADAR_COLLECTOR_URL`, los dos tokens M2M y la configuración de AI Gateway. Ninguna se configura desde la interfaz.

El ZIP se conserva exclusivamente como fallback operativo.
