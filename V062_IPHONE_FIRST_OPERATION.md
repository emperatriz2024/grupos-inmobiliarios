# Radar iPhone First

La PC puede estar apagada: el segundo número continúa vinculado al bridge cloud y la nube conserva los mensajes. Al abrir Radar en el iPhone, Radar intenta sincronizar; también lo hace al volver después de varios minutos, al entrar en Importar y cada cinco minutos mientras está visible. “Sincronizar ahora” queda disponible.

- Si el iPhone pierde Internet, la nube conserva la cola; Radar reintenta al recuperar conexión.
- Si Radar está cerrado, el bridge sigue capturando y Netlify conserva los eventos.
- Si WhatsApp pierde vinculación, la captura se pausa y el estado pasa a “Requiere volver a vincular WhatsApp”. La sesión no se borra automáticamente.
- Solo hace falta otro QR si WhatsApp invalida la sesión. Se muestra únicamente en una terminal administrativa temporal, nunca en Radar ni en una URL pública.
- Radar procesa el texto con el mismo Radar Core: un mensaje no inmobiliario no crea una propiedad.

La PWA no intenta permanecer activa en background; la continuidad pertenece al bridge cloud.
