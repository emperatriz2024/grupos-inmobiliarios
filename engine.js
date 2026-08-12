import { isDemandRequest, listingIntentScore } from './intent-utils.js?v=0500';
import { extractLocationTerms, bestZone } from './location-utils.js?v=0500';
import { resolveLocationRecord } from './location-catalog.js?v=0500';
import { detectDateOrderFromText, parseFlexibleDate, toISODate } from './date-utils.js?v=0500';
/* Grupos Inmobiliarios — Motor v0.1
   Núcleo portable para navegador/iPhone. Recibe el texto _chat.txt ya extraído.
*/

const INVIS_RE = /[\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff\u00ad]/g;
const NBSP_RE = /[\u00a0\u202f]/g;
const ACCENTS = {á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};

export function cleanText(s='') {
  return s
    .replace(INVIS_RE, '')
    .replace(NBSP_RE, ' ')
    .replace(/([0-9])\ufe0f?\u20e3/g, '$1')
    .replaceAll('💲', '$')
    .replaceAll('💯', '100%');
}

export function normalizeText(s='') {
  let x = cleanText(s).toLowerCase().replace(/[áéíóúüñ]/g, c => ACCENTS[c] || c);
  x = x.replace(/https?:\/\/\S+/gi, ' ');
  x = x.replace(/[^\p{L}\p{N}_$%/+.\-\s]/gu, ' ');
  return x.replace(/\s+/g, ' ').trim();
}

const START_RE = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?\]\s*(.*?):\s*(.*)$/i;

function parseMessageDate(dateStr, order='MDY') {
  const ts=parseFlexibleDate(dateStr,order,'MDY');
  return ts ? new Date(ts) : null;
}

function cutoffForDays(maxAgeDays, now=Date.now()) {
  const d = new Date(now);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - maxAgeDays);
  return d;
}

export function parseWhatsAppText(text, group='Grupo', options={}) {
  const maxAgeDays = Number(options.maxAgeDays ?? 60);
  const now = options.now ?? Date.now();
  const cutoff = maxAgeDays > 0 ? cutoffForDays(maxAgeDays, now) : null;
  // WhatsApp export follows the device locale. Your current exports are MDY,
  // but we detect it automatically so the engine also supports DMY exports.
  const dateOrder = detectDateOrderFromText(text, 'MDY');

  const rows = [];
  let current = null;
  let totalMessages = 0;
  let skippedOld = 0;

  const flush = () => {
    if (!current) return;
    current.text = current.lines.join('\n').trim();
    delete current.lines;
    rows.push(current);
    current = null;
  };

  for (const raw of cleanText(text).split(/\r?\n/)) {
    const line = raw.trimStart();
    const m = line.match(START_RE);

    if (m) {
      flush();
      totalMessages++;

      const msgDate = parseMessageDate(m[1], dateOrder);
      if (cutoff && msgDate && msgDate < cutoff) {
        skippedOld++;
        current = null; // no acumulamos ni las líneas del mensaje viejo
        continue;
      }

      let hour = Number(m[2]);
      const ap = m[5].toLowerCase();
      if (ap === 'p' && hour !== 12) hour += 12;
      if (ap === 'a' && hour === 12) hour = 0;

      current = {
        date: m[1],
        date_iso: toISODate(m[1], dateOrder, 'MDY'),
        date_order: dateOrder,
        time: `${String(hour).padStart(2,'0')}:${m[3]}:${m[4] || '00'}`,
        sender: m[6].replace(/^~\s*/, '').trim(),
        group,
        lines: [m[7]]
      };
    } else if (current) {
      current.lines.push(line);
    }
  }

  flush();
  rows.totalMessages = totalMessages;
  rows.skippedOld = skippedOld;
  rows.maxAgeDays = maxAgeDays;
  rows.dateOrder = dateOrder;
  rows.cutoffDate = cutoff ? cutoff.toISOString().slice(0,10) : null;
  return rows;
}

const SYSTEM_BITS = [
  'los mensajes y las llamadas estan cifrados','se unio con el enlace del grupo','anadio a ',
  'quito a ','cambio su numero de telefono','fijo un mensaje','desfijo un mensaje',
  'se actualizo la duracion de los mensajes','activo la privacidad avanzada del chat',
  'desactivo la privacidad avanzada del chat','esperando el mensaje. esto puede tomar tiempo',
  'creo el grupo','cambio el asunto','cambio la descripcion','cambio el icono'
];

const RE_TERMS = /\b(venta|vendo|vende|alquiler|alquilo|alquila|canon|apartamento|apto\.?|town\s*house|townhouse|townhause|town\s*home|casa|quinta|vivienda|penthouse|ph\b|terreno|parcela|local\s+comercial|oficina|galpon|inmueble|habitaciones?|banos?|estacionamientos?|puestos?|mts?2|m2|precio|ref\.?|residencias?|urbanizacion|conjunto)\b/gi;
const MONEY_RE = /(?:us\s*\$|usd\s*\$?|\$)\s*\d|\b\d{2,3}(?:[.,]\d{3})+\s*\$|\b\d{2,3}\s*k\b/i;

export function isPropertyPost(text) {
  const n = normalizeText(text);
  if (n.length < 20) return false;
  if (SYSTEM_BITS.some(x => n.includes(x))) return false;
  if (['imagen omitida','video omitido','audio omitido','sticker omitido','documento omitido','gif omitido'].includes(n)) return false;
  if (isDemandRequest(text)) return false;
  // Deliberately inclusive: false negatives are more expensive than imperfect fields.
  return listingIntentScore(text) >= 3;
}

const TYPES = [
  ['Apartamento', /\b(apartamento|apto\.?)\b/i],
  ['Anexo', /\banexo\b/i],
  ['Townhouse', /\b(town\s*house|townhouse|townhause|town\s*home|townhome|t\s*\/\s*h|th)\b/i],
  ['Penthouse', /\b(pent\s*house|penthouse|ph)\b/i],
  ['Casa', /\b(casa|quinta|vivienda|chalet|aparto[\s-]?quinta)\b/i],
  ['Terreno', /\b(terreno|parcela|lote)\b/i],
  ['Local comercial', /\blocal(?:\s+comercial)?\b/i],
  ['Oficina', /\boficina\b/i],
  ['Galpón', /\bgalpon\b/i]
];

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseNumber(raw) {
  let x = String(raw).trim().replace(/\s/g,'');
  if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return Number(x.replace(/[.,]/g,''));
  if (x.includes(',') && x.includes('.')) {
    const pos = Math.max(x.lastIndexOf(','), x.lastIndexOf('.'));
    if (x.length-pos-1 <= 2) return Number(x.slice(0,pos).replace(/[.,]/g,'')+'.'+x.slice(pos+1));
    return Number(x.replace(/[.,]/g,''));
  }
  if (x.includes(',')) {
    const [a,b] = x.split(/,(?=[^,]*$)/);
    return b.length <= 2 ? Number(a.replace(/,/g,'')+'.'+b) : Number(x.replace(/,/g,''));
  }
  if (x.includes('.')) {
    const pos=x.lastIndexOf('.'), b=x.slice(pos+1);
    return b.length <=2 ? Number(x.slice(0,pos).replace(/\./g,'')+'.'+b) : Number(x.replace(/\./g,''));
  }
  return Number(x);
}

function extractPrice(text, operation=null) {
  const t=cleanText(text);
  const found=[];
  const pats=[
    /(?:US\s*\$|USD\s*\$?|\$)\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]{2,7}(?:[.,][0-9]{1,2})?)/gi,
    /\b([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{2,7})\s*(?:US\$|USD|\$)/gi,
    /\b([0-9]{2,3}(?:[.,][0-9]+)?)\s*k\b/gi,
    /\b([0-9]{2,3}(?:[.,][0-9]+)?)\s*mil\b/gi,
    /\b(?:precio(?:\s+de\s+(?:venta|inversion))?|ref(?:erencia)?\.?|canon)\s*[:.\-]?\s*(?:us\s*\$|usd)?\s*([0-9]{2,3}(?:[.,][0-9]{3})+|[0-9]{2,7})/gi
  ];
  pats.forEach((rx,idx)=>{
    for(const m of t.matchAll(rx)){
      let v=parseNumber(m[1]);
      if(idx===2 || idx===3) v*=1000;
      if(v>=10 && v<=50000000) found.push({pos:m.index,value:v,priority:idx===4?-1:0});
    }
  });
  found.sort((a,b)=>a.priority-b.priority || a.pos-b.pos);
  let value=found[0]?.value ?? null;
  if(operation==='Venta' && value!=null && value>=10 && value<1000) value*=1000;
  return value;
}

function firstNumber(n, patterns) {
  for (const rx of patterns) {
    const m=n.match(rx); if(m) return parseNumber(m[1]);
  }
  return null;
}

function extractResidence(text) {
  const raw=cleanText(text);
  const prefix=/\b(?:residencias?|resd\.?|res\.|conjunto(?:\s+residencial)?|conj\.?\s*(?:res\.?)?)\s*[:\-]?\s*[“"']?([^\n,;]{3,60})/i;
  for (const line0 of raw.split('\n').slice(0,18)) {
    if (/https?:\/\//i.test(line0)) continue;
    const m=line0.match(prefix); if(!m) continue;
    let v=m[1].replace(/^[ *•\-:,.“”"']+|[ *•\-:,.“”"']+$/g,'');
    v=v.split(/\s{2,}|\s+ubicad[oa]\b|\s+valencia\b|\s+estado\b|\s+de\s+\d{2,5}\b|\s+consta\b/i)[0].trim();
    if (!/^(de|una|un)\b/i.test(v) && v.length>2) return v;
  }
  // Common Venezuelan residence names are often posted as a standalone line: “Villas Corina”, “Villa Serino”.
  for(const line0 of raw.split('\n').slice(0,14)){
    const line=line0.replace(/^[ *•\-:,.“”"']+|[ *•\-:,.“”"']+$/g,'').trim();
    if(/^villas?\s+[\p{L}0-9][\p{L}0-9 .'-]{2,38}$/iu.test(line) && !/\b(?:venta|alquiler|casa|townhouse|apartamento|precio)\b/i.test(line)) return line;
  }
  return null;
}

function extractPhone(text) {
  const m=text.match(/(?:\+?58[\s\-.]?)?(0?4(?:12|14|16|24|26))[\s\-.]?([0-9]{3})[\s\-.]?([0-9]{4})/);
  if(!m) return null;
  return '0'+m[1].replace(/^0/,'')+m[2]+m[3];
}

export function extractProperty(message, options={}) {
  const n=normalizeText(message.text);
  if(!isPropertyPost(message.text)) return null;
  const rent=n.match(/\b(alquiler|alquilo|alquila|canon|arrendamiento|arrendo)\b/i);
  const sale=n.match(/\b(venta|vendo|vende|en venta|precio de venta|inversion)\b/i);
  let operation=null;
  if(rent && !sale) operation='Alquiler'; else if(sale && !rent) operation='Venta';
  else if(rent && sale) operation = rent.index < sale.index ? 'Alquiler':'Venta';
  let propertyType=null; for(const [label,rx] of TYPES){if(rx.test(n)){propertyType=label;break;}}
  const residenceDetected=extractResidence(message.text);
  const smartLocation=resolveLocationRecord(message.text,options.locationCatalog||null,{existingComplex:residenceDetected});
  const locationTerms=smartLocation.location_terms?.length?smartLocation.location_terms:extractLocationTerms(message.text);
  const zone=smartLocation.zone||bestZone(message.text,locationTerms[0]||null);
  const price=extractPrice(message.text, operation);
  const rec={
    group:message.group,date:message.date,date_iso:message.date_iso,date_order:message.date_order,time:message.time,sender:message.sender,
    operation,property_type:propertyType,
    municipality_id:smartLocation.municipality_id,municipality:smartLocation.municipality,
    zone_id:smartLocation.zone_id,zone,zone_detected:smartLocation.zone_detected,zone_detected_norm:smartLocation.zone_detected_norm,zone_confidence:smartLocation.zone_confidence,zone_matches:smartLocation.zone_matches,
    complex_id:smartLocation.complex_id,complex_detected:smartLocation.complex_detected,complex_detected_norm:smartLocation.complex_detected_norm,complex_confidence:smartLocation.complex_confidence,location_requires_review:smartLocation.requires_review,
    location_terms:locationTerms,residence:smartLocation.complex||smartLocation.complex_detected||null,price_usd:price,
    area_m2:firstNumber(n,[/\b(\d{1,3}(?:[.,]\d{3})+|\d{2,5}(?:[.,]\d{1,2})?)\s*(?:m2|mt2|mts2|mts\s*2|mtrs?2?|mts?|metros(?:\s+cuadrados?)?)\b/i]),
    bedrooms:firstNumber(n,[/\b(\d{1,2})\s*(?:h|hab|habs|habitaciones?)\b/i,/\bhabitaciones?\s*[:\-]?\s*(\d{1,2})\b/i]),
    bathrooms:firstNumber(n,[/\b(\d{1,2})(?:[.,]5)?\s*(?:b|banos?)\b/i,/\bbanos?\s*[:\-]?\s*(\d{1,2})/i]),
    parking:firstNumber(n,[/\b(\d{1,2})\s*(?:p\s*\/?\s*e|puestos?(?:\s+de)?\s+estacionamiento|estacionamientos?)\b/i,/\bpuestos?\s*[:\-]?\s*(\d{1,2})/i]),
    phone:extractPhone(message.text),
    planta_electrica:/\bplanta\s+(?:electrica|100|50|total|parcial)|\bplanta\s*100\s*%/i.test(n),
    planta_100:/\bplanta(?:\s+electrica)?\s*(?:100\s*%|total)\b/i.test(n),
    pozo:/\bpozo(?:\s+de\s+agua|\s+profundo)?\b/i.test(n),
    tanque:/\btanque(?:\s+subterraneo|\s+de\s+agua)?\b/i.test(n),
    amoblado:/\b(amoblad[oa]|semi\s*amoblad[oa]|equipad[oa])\b/i.test(n),
    financiamiento:/\b(financiamiento|financia|cuotas?|inicial)\b/i.test(n),
    piscina:/\bpiscina\b/i.test(n),
    text:message.text,
    normalized:n
  };
  rec.id = simpleHash(n);
  rec.location_pending=(smartLocation.pending||[]).map(x=>({...x,property_id:rec.id,group:message.group,sender:message.sender,date:message.date,date_iso:message.date_iso,sample_text:message.text.slice(0,1800)}));
  return rec;
}

function messageDateTime(dateStr, timeStr='00:00:00', dateIso=null, dateOrder='MDY') {
  const baseTs=dateIso ? parseFlexibleDate(dateIso,'auto','MDY') : parseFlexibleDate(dateStr,dateOrder,'MDY');
  if(!baseTs) return 0;
  const d=new Date(baseTs);
  const p=String(timeStr).split(':').map(Number);
  d.setHours(p[0]||0,p[1]||0,p[2]||0,0);
  return d.getTime();
}

function splitMultiListingMessage(message){
  const text=String(message.text||'');
  if(isDemandRequest(text)) return [];
  const rx=/^\s*(\d{1,2})\s*[\)\.]\s+/gm;
  const marks=[...text.matchAll(rx)];
  if(marks.length<2) return [message];
  const header=text.slice(0,marks[0].index).trim();
  const parts=[];
  for(let i=0;i<marks.length;i++){
    const from=marks[i].index+marks[i][0].length;
    const to=i+1<marks.length?marks[i+1].index:text.length;
    const body=text.slice(from,to).trim();
    const candidate=(header?header+'\n':'')+body;
    if(candidate.length>=35 && isPropertyPost(candidate)) parts.push({...message,text:candidate});
  }
  // Only split if at least two genuine listing fragments were found; otherwise preserve original.
  return parts.length>=2?parts:[message];
}

export function processChatText(text, group='Grupo', options={}) {
  const maxAgeDays = Number(options.maxAgeDays ?? 60);
  const messages = parseWhatsAppText(text, group, {maxAgeDays, now: options.now ?? Date.now()});

  const properties=[];
  let requestsSkipped=0;
  let multiItemsCreated=0;
  for(const m of messages){
    if(isDemandRequest(m.text)){ requestsSkipped++; continue; }
    const parts=splitMultiListingMessage(m);
    if(parts.length>1) multiItemsCreated += parts.length;
    for(const part of parts){
      const r=extractProperty(part,{locationCatalog:options.locationCatalog});
      if(r) properties.push(r);
    }
  }

  const unique=new Map();
  for(const r of properties){
    const source={group:r.group,sender:r.sender,date:r.date,date_iso:r.date_iso,date_order:r.date_order,time:r.time,phone:r.phone};
    if(!unique.has(r.id)) {
      unique.set(r.id,{...r,appearances:1,sources:[source]});
    } else {
      const x=unique.get(r.id);
      x.appearances++;
      x.sources.push(source);

      // La tarjeta principal usa SIEMPRE la publicación más reciente.
      if (messageDateTime(r.date,r.time,r.date_iso,r.date_order) > messageDateTime(x.date,x.time,x.date_iso,x.date_order)) {
        x.date=r.date; x.date_iso=r.date_iso; x.date_order=r.date_order; x.time=r.time; x.sender=r.sender; x.group=r.group;
        if (r.phone) x.phone=r.phone;
      }
    }
  }

  return {
    messages:messages.length,
    messages_total:messages.totalMessages ?? messages.length,
    messages_skipped_age:messages.skippedOld ?? 0,
    max_age_days:maxAgeDays,
    cutoff_date:messages.cutoffDate ?? null,
    date_order:messages.dateOrder ?? 'MDY',
    requests_skipped:requestsSkipped,
    multi_items_created:multiItemsCreated,
    properties_detected:properties.length,
    location_pendings:properties.flatMap(p=>p.location_pending||[]),
    unique:[...unique.values()]
  };
}

function simpleHash(s) {
  // Fast deterministic non-cryptographic ID for local dedupe.
  let h1=0x811c9dc5;
  for(let i=0;i<s.length;i++){h1^=s.charCodeAt(i);h1=Math.imul(h1,0x01000193);}
  return (h1>>>0).toString(16).padStart(8,'0');
}
