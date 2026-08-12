# Radar Inmobiliario v0.5.1.1 — Matching Estricto + Auditoría de Precio

## 1. Matching estricto
Los siguientes criterios pasan a ser duros cuando el comprador los especifica:
- operación;
- tipo de inmueble;
- zonas/municipios seleccionados;
- precio máximo, con tolerancia configurable 0%, 5% o 10%;
- habitaciones mínimas;
- baños mínimos;
- puestos mínimos;
- características marcadas como obligatorias.

### Clasificación
- **90–100% / Cumple criterios**: todos los criterios duros conocidos se cumplen.
- **70–79% / Por verificar**: falta un dato duro en la publicación.
- **55–69% / Alternativa**: existe un incumplimiento conocido, pero se conserva en “Todos” como alternativa comercial.
- Inmuebles muy por encima del presupuesto o fuera de operación/tipo/zona no entran.

Un inmueble con 2 habitaciones nunca puede volver a aparecer como 96% si el comprador exige 3.

## 2. Integridad de precios
Se reemplaza el extractor antiguo por uno contextual.

Problema corregido:
En una venta, un monto secundario como `$70` podía ser convertido a `$70.000`. Esto podía provocar que el título mostrara $70.000 aunque el mensaje dijera Precio $130.000.

Nuevo criterio:
- `Precio`, `Ref`, `Inversión`, `Valor`, `Canon` tienen máxima prioridad.
- `130k` y `130 mil` se reconocen explícitamente.
- Un `$70` aislado en una publicación de venta NO se convierte automáticamente a $70.000.
- Líneas con `condominio`, `mantenimiento`, `cuota`, `reserva`, `comisión`, `contrato`, etc. se penalizan y no desplazan el precio principal.
- Si hay varios precios plausibles y contradictorios, el registro queda marcado como **precio ambiguo**.

## 3. Reparación automática
Al abrir v0.5.1.1, Radar reaudita los precios de los registros existentes usando el mensaje original y los corrige sin alterar su fecha ni su vigencia.

No es necesario reimportar los chats para ejecutar esta reparación.
