# Radar Inmobiliario v0.5.2.2 — Marketplace Metadata + Dedupe

## Qué cambia
Las publicaciones externas ya no dependen solo de la descripción.

Radar captura por separado:
- título del anuncio;
- precio publicado;
- moneda/interpretación;
- publicador o vendedor mostrado;
- teléfono mostrado;
- URL;
- fecha;
- descripción.

## Precio
El precio mostrado por Marketplace se conserva siempre como dato externo.
Solo se convierte en `price_usd` si el usuario confirma explícitamente `USD`.

Esto evita asumir que una etiqueta de moneda de la plataforma equivale a USD.

## Duplicados
Cuando el precio externo está confirmado como USD:
- diferencia <=8%: suma evidencia;
- 8–20%: pequeña penalización;
- 20–40%: penalización importante;
- >40%: conflicto fuerte;
- >60%: se descarta como duplicado salvo evidencia de identidad excepcionalmente fuerte.

Ejemplo de control:
$90.000 vs $25.000 = diferencia >60%, por lo que no debe aparecer como duplicado fuerte salvo evidencia extraordinaria.

## Publicador vs captador
Se muestran por separado:
- Publicador/vendedor mostrado: dato literal de la publicación.
- Captador probable: inferencia histórica de Radar.

Nunca se reemplaza uno por otro.
