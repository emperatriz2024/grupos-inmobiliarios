const A={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
function n(s=''){return String(s).toLowerCase().replace(/[áéíóúüñ]/g,c=>A[c]||c).replace(/[^\p{L}\p{N}$%+./\-\s]/gu,' ').replace(/\s+/g,' ').trim();}

const PROPERTY=/\b(apartamento|apto|casa|quinta|town\s*house|townhouse|town\s*home|townhome|\bth\b|penthouse|\bph\b|terreno|parcela|local|oficina|galpon|anexo|inmueble|apart[o-]?quinta)\b/i;
const REQUEST_HEAD=/^(?:.{0,45}\b)?(?:solicito|solicitamos|solicitud(?:es)?|se\s+solicita|busco|buscamos|se\s+busca|ando\s+buscando|estoy\s+buscando|estamos\s+buscando|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|tengo\s+(?:un\s+)?cliente\s+(?:buscando|que\s+busca)|requiero|requerimos|se\s+requiere|necesito|necesitamos|en\s+busqueda\s+de|requerimiento)\b/i;
const REQUEST_TARGET=/\b(?:solicito|solicitamos|se\s+solicita|busco|buscamos|se\s+busca|ando\s+buscando|estoy\s+buscando|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|requiero|requerimos|se\s+requiere|necesito|necesitamos)\b.{0,110}\b(apartamento|apto|casa|quinta|town\s*house|townhouse|town\s*home|townhome|th|penthouse|ph|terreno|parcela|local|oficina|galpon|anexo|inmueble)\b/i;
const REQUEST_BUDGET=/\b(?:presupuesto|maximo|tope)\b.{0,35}(?:\$|usd|us\$)?\s*\d/i;
const LISTING_STRONG=/\b(?:en\s+venta|vende|vendo|alquiler|alquilo|canon|nueva\s+captacion|captacion|ofrece\s+en|te\s+presenta|precio\s+(?:de\s+)?venta|inversion|ref(?:erencia)?\.?\s*[:$])\b/i;

export function isDemandRequest(text=''){
  const x=n(text); if(!x) return false;
  const head=x.slice(0,300);
  // Clear request language at the beginning, aimed at a property.
  if(REQUEST_HEAD.test(head) && (PROPERTY.test(head) || REQUEST_BUDGET.test(x))) return true;
  if(REQUEST_TARGET.test(x)) return true;
  // “solicitud” as the post title is a demand post. Avoid catching rental conditions later in a listing.
  if(/^.{0,70}\bsolicitud(?:es)?\b/i.test(head) && !LISTING_STRONG.test(head.slice(0,80))) return true;
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
  if(/\b(?:residencias?|res\.|urbanizacion|urb\.|conjunto\s+residencial)\b/i.test(x)) s+=1;
  return s;
}
