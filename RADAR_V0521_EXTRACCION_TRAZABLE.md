# Radar Inmobiliario v0.5.2.1 — Extracción trazable

## Corrección principal
`Estacionamiento: 2 puestos` ahora tiene prioridad explícita y debe devolver:
- Puestos: 2
- Evidencia: `Estacionamiento: 2 puestos`
- Confianza: alta

Se añadieron extractores trazables para:
- precio;
- metraje;
- habitaciones;
- baños;
- puestos.

## Nueva interfaz
Antes de guardar una fuente externa, Radar muestra:
`Dato: valor ← “línea original”`

Así puedes comprobar de dónde salió cada valor.

## Seguridad
Este hotfix NO reescribe los 1.384 inmuebles actuales.
Solo mejora:
- análisis de fuentes externas;
- futuras importaciones que utilicen el extractor actualizado.

Si faltan precio, habitaciones, baños o puestos, Radar avisa antes de guardar.

## Caso de prueba
Usar nuevamente la publicación de Monte Serino.
La línea `Estacionamiento: 2 puestos` debe producir `Puestos: 2`.
