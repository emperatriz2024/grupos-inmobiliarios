const A={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
function n(s=''){return String(s).toLowerCase().replace(/[áéíóúüñ]/g,c=>A[c]||c).replace(/[^\p{L}\p{N}$%+./\-\s]/gu,' ').replace(/\s+/g,' ').trim();}

const PROPERTY=/\b(apartamento|apto|apartamento|casa|quinta|vivienda|town\s*house|townhouse|town\s*home|townhome|townhause|\bth\b|penthouse|\bph\b|terreno|parcela|lote|local|oficina|galpon|anexo|inmueble|apart[o-]?quinta)\b/i;
const STRONG_REQUEST_START=/^(?:urgente\s+)?(?:solicito|solicitamos|solicitud(?:es)?|se\s+solicita|se\s+solicitan|busco|buscamos|se\s+busca|se\s+buscan|ando\s+buscando|estoy\s+buscando|estamos\s+buscando|buscando\s+para\s+cliente|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|tengo\s+(?:un\s+)?cliente(?:\s+que)?\s+(?:busca|buscando|requiere|necesita)|requiero|requerimos|se\s+requiere|necesito|necesitamos|en\s+busqueda\s+de|requerimiento|demanda)\b/i;
const EARLY_REQUEST=/\b(?:solicito|solicitamos|solicitud(?:es)?|se\s+solicita|busco|buscamos|se\s+busca|ando\s+buscando|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|tengo\s+(?:un\s+)?cliente|requiero|requerimos|necesito|necesitamos|requerimiento)\b/i;
const REQUEST_BUDGET=/\b(?:presupuesto|maximo|maxima|tope|rango|canon)\b.{0,40}(?:\$|usd|us\$)?\s*\d/i;
const LISTING_START=/^(?:.{0,25}\b)?(?:en\s+venta|venta\b|vendo|vende|se\s+vende|en\s+alquiler|alquiler\b|alquilo|alquila|se\s+alquila|canon\b|nueva\s+captacion|captacion\b|oportunidad\b|precio\b|hermos[oa]\b|excelente\b|amplio\b|moderno\b|comodo\b)/i;
const LISTING_STRONG=/\b(?:en\s+venta|se\s+vende|vendo|en\s+alquiler|se\s+alquila|alquilo|canon|nueva\s+captacion|captacion|precio\s+(?:de\s+)?venta|ref(?:erencia)?\.?\s*[:$])\b/i;

export function isDemandRequest(text=''){
  const x=n(text); if(!x) return false;
  const head=x.slice(0,260);
  const first=x.slice(0,130);

  // Highest-confidence rule: the post itself starts as a request.
  if(STRONG_REQUEST_START.test(head)) return true;

  // Request language early in the post + property/budget/zone context.
  const req=EARLY_REQUEST.exec(head);
  if(req && req.index<115){
    const around=head.slice(req.index, Math.min(head.length, req.index+155));
    if(PROPERTY.test(around) || REQUEST_BUDGET.test(around) || /\bzonas?\b/.test(around)) return true;
  }

  // “Solicitud” / “requerimiento” as title, but not a listing that later asks for rental paperwork.
  if(/^(?:urgente\s+)?(?:solicitud(?:es)?|requerimiento|demanda)\b/.test(head) && !LISTING_START.test(first)) return true;

  // “Tengo cliente...” is always demand when it appears as the post opening.
  if(/^.{0,35}\btengo\s+(?:un\s+)?cliente\b/.test(first) && PROPERTY.test(head)) return true;

  return false;
}

export function listingIntentScore(text=''){
  const x=n(text); if(isDemandRequest(x)) return -99;
  let s=0;
  if(PROPERTY.test(x)) s+=2;
  if(LISTING_STRONG.test(x)) s+=3;
  if(/(?:\$|usd|us\$)\s*\d|\b\d{2,3}(?:[.,]\d{3})+\s*\$|\b\d{2,3}\s*(?:mil|k)\b/i.test(x)) s+=2;
  if(/\b\d{1,2}\s*(?:hab|habitaciones?|banos?|puestos?|p\s*\/?\s*e)\b/i.test(x)) s+=1;
  if(/\b(?:m2|mts2|metros\s+cuadrados?)\b/i.test(x)) s+=1;
  if(/\b(?:residencias?|res\.|urbanizacion|urb\.|conjunto\s+residencial|villa(?:s)?)\b/i.test(x)) s+=1;
  // Inclusive by design: real listings are more valuable than perfect metadata.
  return s;
}
