# Grupos Inmobiliarios v0.4.12 PRO — Jerarquía Territorial

## Arquitectura
Municipio → Zona/Sector/Urbanización → Conjunto/Torre/Edificio

### Municipios de trabajo
- Valencia
- San Diego
- Naguanagua
- Los Guayos
- Guacara

## Comportamiento del filtro
- `Municipios` es multiselector.
- `Zonas / sectores` es multiselector.
- Si seleccionas uno o varios municipios, el selector de zonas muestra solamente zonas pertenecientes a esos municipios.
- Las zonas se muestran agrupadas por municipio.
- El selector NO se alimenta de frases crudas de los anuncios.
- Textos como “95mts”, “3 habitaciones”, “a pasos del Sambil”, “seguridad 24/7” nunca se convierten en zonas.

## Resolución territorial
Ejemplos validados por el motor:
- Mañongo → Naguanagua
- Doral Country → El Rincón → Naguanagua
- Terramar → Mañongo → Naguanagua
- Villa Serino Country Park → El Remanso → San Diego
- Lo Más Alto → Lomas del Este → Valencia
- Villas Corina → Pueblo de San Diego → San Diego
- Trigal Norte → Valencia

## Catálogo
La semilla v0.4.12 contiene 164 zonas/sectores/urbanizaciones distribuidas entre los cinco municipios y alias de escritura frecuentes.

El catálogo NO pretende ser una lista cerrada. Cuando un chat menciona una zona o conjunto realmente nuevo que no puede vincularse con seguridad, se conserva el sistema de revisión para:
- Vincular a una ubicación existente
- Crear una nueva zona/conjunto
- Descartar la detección

## Puntos de referencia
Avenidas, centros comerciales y frases de cercanía se mantienen como texto buscable, pero no contaminan el catálogo de zonas.
