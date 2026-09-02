# Radar Inmobiliario v0.5.2 — Fuentes Externas

## Objetivo
Ampliar Radar más allá de los grupos de WhatsApp sin romper el inventario actual.

## Captura asistida
En Importar → Fuentes externas:
1. seleccionar fuente;
2. colocar fecha;
3. pegar URL;
4. colocar cuenta/asesor si se conoce;
5. pegar el texto completo de la publicación;
6. Analizar.

Radar extrae operación, tipo, ubicación, residencia, precio, metraje, habitaciones, baños, puestos y extras.

## Detector de duplicados
Antes de guardar, compara la publicación contra los inmuebles maestros utilizando:
- operación;
- tipo;
- zona;
- residencia/conjunto;
- metraje;
- habitaciones;
- baños;
- puestos;
- precio;
- similitud del texto con publicaciones fuente existentes.

Clasificación:
- 82%+ probable inmueble existente;
- 62–81% posible duplicado, requiere revisión;
- menos de 62% se recomienda tratarlo como nuevo.

## Captador probable
Radar NO afirma quién es el captador real.
Calcula una probabilidad basada en:
- fuente más antigua conocida;
- recurrencia del mismo agente/teléfono;
- presencia del mismo agente en varias fuentes;
- existencia de teléfono.

Esto permite priorizar a quién contactar sin confundir republicador con captador.

## Vigencia
El módulo destaca publicaciones de hasta 20 días.
Si la fecha supera 20 días, pregunta antes de guardar.

## Compradores
Al guardar una fuente externa, Radar recalcula los compradores automáticamente.
La fuente y el inmueble maestro también quedan incluidos en el respaldo de Dropbox.
