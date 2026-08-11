const A={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
export function normLoc(s=''){return String(s).toLowerCase().replace(/[áéíóúüñ]/g,c=>A[c]||c).replace(/[^\p{L}\p{N}\s\-]/gu,' ').replace(/\s+/g,' ').trim();}

export const KNOWN_ZONES=[
'Lomas del Este','Lomas de Los Mangos','Lomas de la Hacienda','Lomas del Country','Los Nísperos','Los Nisperos',
'Mañongo','Naguanagua','Tazajal','El Rincón','Manantial','La Granja','Piedra Pintada','Guaparo Norte','Guaparo','Guataparo','Altos de Guataparo',
'Valles de Camoruco','Valle de Camoruco','Valle Blanco','El Parral','Los Mangos','El Bosque','Prebo III','Prebo II','Prebo I','Prebo',
'La Viña','La Trigaleña','Trigaleña','Trigal Norte','Trigal Centro','Trigal Sur','Las Chimeneas','Agua Blanca','Sabana Larga','Campo Alegre',
'San Diego','Pueblo de San Diego','La Esmeralda','Los Faroles','Valle de Oro','La Cumaca','Paso Real','Tulipán','Terrazas de San Diego','Pueblo Viejo',
'Paraparal','Ciudad Alianza','Guacara','La Isabelica','Flor Amarillo','El Remanso','Los Jarales','La Quizanda','Zona Industrial La Quizanda',
'Los Caobos','La Candelaria','El Viñedo','La Alegría','La Campiña','La Entrada','El Trigal','Carabobo'
].sort((a,b)=>b.length-a.length);

function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function cleanCandidate(v=''){
  v=String(v).replace(/[“”"'*•_]/g,' ').replace(/\s+/g,' ').trim();
  v=v.split(/\s+(?:valencia|edo\.?|estado|carabobo|res\.?|residencias?|edif\.?|edificio|conj\.?|conjunto|precio|ref\.?|cerca\b|diagonal\b|frente\b|\d{1,2}\s*(?:hab|habitaciones?|banos?|baños?|puestos?|p\s*\/?\s*e)|\d{2,5}\s*(?:m2|mts2|metros?))/i)[0];
  v=v.replace(/\([^)]*\).*$/,'').replace(/[,:;.\-]+$/,'').trim();
  if(v.length<3||v.length>42||v.split(/\s+/).length>7) return null;
  if(/\d{3,}|\$|\b(?:venta|alquiler|apartamento|casa|townhouse|habitacion|banos?|mts?|precio|oportunidad)\b/i.test(v)) return null;
  return v;
}
export function extractLocationTerms(text='', existingZone=null){
  const raw=String(text); const n=normLoc(raw); const out=[]; const seen=new Set();
  const add=v=>{v=cleanCandidate(v); if(!v)return; const k=normLoc(v); if(!k||seen.has(k))return; if([...seen].some(x=>k.startsWith(x+' ')))return; seen.add(k); out.push(v);};
  if(existingZone) add(existingZone);
  for(const z of KNOWN_ZONES){const zn=normLoc(z); if(new RegExp(`(^|\\W)${esc(zn)}(?=$|\\W)`,'i').test(n)) add(z);}
  const rxs=[
    /\b(?:urb(?:anizaci[oó]n)?\.?|urbanizaci[oó]n)\s*[:\-]?\s*([^\n,;|]{3,55})/gi,
    /\b(?:zona|sector)\s*[:\-]?\s*([^\n,;|]{3,45})/gi
  ];
  for(const rx of rxs){for(const m of raw.matchAll(rx)) add(m[1]);}
  return out;
}
export function bestZone(text='', existingZone=null){return extractLocationTerms(text,existingZone)[0]||existingZone||null;}
