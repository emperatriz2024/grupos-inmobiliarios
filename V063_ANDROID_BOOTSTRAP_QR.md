# Bootstrap QR local y temporal

No ejecutar durante esta fase.

El QR debe mostrarse en el iPhone porque WhatsApp está en el mismo Android que Termux. `bootstrap-qr.sh` detiene el servicio normal, genera un token aleatorio en memoria y abre temporalmente `0.0.0.0:8090` solo en la LAN. Imprime una URL `http://IP-ANDROID:8090/bootstrap/TOKEN`.

1. Ambos teléfonos deben estar en la misma red local confiable.
2. Abre la URL en el iPhone.
3. En el Android: WhatsApp → Dispositivos vinculados → Vincular dispositivo.
4. Escanea con Android el QR mostrado en el iPhone.
5. Al recibir AUTHENTICATED o READY, el endpoint se cierra, el token se invalida y el QR se borra de memoria.

El token expira en cinco minutos. El QR no se guarda, no aparece en logs, Netlify ni Radar. No abras el puerto en el router ni uses una URL pública. Si expira, inicia una sesión nueva.
