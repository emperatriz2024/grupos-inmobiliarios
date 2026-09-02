# Configuración V0.6.1 para principiantes

## Antes de comenzar

No uses todavía el número real. Prepara primero un sitio/branch deploy de prueba separado y dos secretos aleatorios distintos. No escribas los secretos en archivos del proyecto, capturas, chats ni comandos que queden en historial compartido.

Variables externas necesarias:

- Bridge local: `RADAR_BRIDGE_INGEST_URL`, `RADAR_BRIDGE_INGEST_TOKEN` y, opcionalmente, `RADAR_BRIDGE_RUNTIME_DIR`.
- Entorno Netlify TEST: `RADAR_BRIDGE_INGEST_TOKEN`, `RADAR_SECONDARY_SYNC_TOKEN` y `RADAR_SECONDARY_ALLOWED_ORIGIN` con la URL exacta del branch deploy TEST.

El endpoint de escritura termina en `/.netlify/functions/secondary-whatsapp-ingest`. El de lectura termina en `/.netlify/functions/secondary-whatsapp-sync`.

## 1. Instalar dependencias

Abre PowerShell en `bridge\whatsapp-secondary` y ejecuta:

```powershell
npm install
```

Esto instala `whatsapp-web.js` y el renderizador de QR. No copies `node_modules` ni la sesión al repositorio.

## 2. Configurar solo la ventana actual de PowerShell

Define las variables en esa terminal. Sustituye los valores de ejemplo localmente; nunca los confirmes en Git:

```powershell
$env:RADAR_BRIDGE_INGEST_URL='https://SITIO-TEST.netlify.app/.netlify/functions/secondary-whatsapp-ingest'
$env:RADAR_BRIDGE_INGEST_TOKEN='SECRETO-TEST-DE-ALTA-ENTROPIA'
```

## 3. Iniciar el bridge

Dentro de `bridge\whatsapp-secondary` ejecuta:

```powershell
npm run start
```

Si no hay sesión aparecerán el estado `WAITING_QR` y un QR en la terminal.

## 4. Vincular el teléfono

1. Abre WhatsApp en el teléfono secundario.
2. Abre **Dispositivos vinculados**.
3. Pulsa **Vincular dispositivo**.
4. Escanea el QR de la terminal.
5. Espera `AUTHENTICATED` y luego `READY`.

La sesión queda fuera de Git. En siguientes inicios normalmente no será necesario escanear de nuevo. Si la sesión expira, volverá a `WAITING_QR`.

## 5. Configurar Radar TEST

1. Abre Radar V0.6.1 en el entorno separado.
2. Entra en **Importar → WhatsApp secundario**.
3. Pulsa **Configurar acceso TEST**.
4. Introduce la URL HTTPS de `secondary-whatsapp-sync`.
5. Introduce manualmente `RADAR_SECONDARY_SYNC_TOKEN`.
6. El token permanece únicamente durante esa sesión/pestaña. Al cerrarla puede ser necesario introducirlo otra vez.

`sessionStorage` evita incluir el token en el bundle, Git o respaldos. Sobrevive a un refresh de la misma pestaña, pero normalmente desaparece al cerrar esa pestaña/sesión. Un script malicioso ejecutado en el mismo origen podría leerlo, por lo que el entorno TEST no debe cargar scripts de terceros innecesarios. Para revocarlo, rota `RADAR_SECONDARY_SYNC_TOKEN` en Netlify TEST y vuelve a introducir el nuevo valor. Para revocar escritura, rota `RADAR_BRIDGE_INGEST_TOKEN` y reinicia el bridge con el valor nuevo.

## 6. Prueba controlada

1. Usa un grupo de prueba, no grupos reales.
2. Envía o recibe una publicación inmobiliaria ficticia en el grupo.
3. Comprueba en el bridge: `GROUP_MESSAGE_RECEIVED`, `QUEUED`, `UPLOADED`.
4. En Radar pulsa **Sincronizar ahora**.
5. Comprueba contadores y **Ver diagnóstico**.
6. Confirma que la publicación entró como fuente `whatsapp_secondary` y que Radar Core aplicó precio/deduplicación.

## Estados y solución básica

- `WAITING_QR`: falta escanear.
- `AUTHENTICATED`: WhatsApp aceptó la sesión.
- `READY`: listener activo.
- `DISCONNECTED`/`RECONNECTING`: espera el backoff; no reinicies repetidamente.
- `ERROR`: revisa URL, variables y conectividad. Los logs nunca deben contener tokens.

No despliegues desde estas instrucciones sin revisión humana de la rama, permisos, variables TEST y política de uso de WhatsApp.

## Retención

La cola TEST elimina mensajes crudos después de 14 días y conserva solo el índice idempotente hasta 30 días. No existe endpoint de borrado público. La purga está limitada por código al store `radar-secondary-whatsapp-v061-test` y nunca nombra un store de producción.
