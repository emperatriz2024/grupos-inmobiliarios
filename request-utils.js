import { BUYER_FEATURES, scoreBuyerMaster } from './buyer-utils.js?v=0601';
import { normLocation } from './location-catalog.js?v=0601';

const TYPE_ALIASES=Object.freeze([
  [/(?:\blocal(?:es)?\b|local(?:es)? comercial(?:es)?)/i,'Local comercial'],
  [/\btown\s*house(?:s)?\b|\bth\b/i,'Townhouse'],
  [/\bapartamento(?:s)?\b|\bapto(?:s)?\b/i,'Apartamento'],
  [/\bpenthouse(?:s)?\b|\bph\b/i,'Penthouse'],
  [/\bcasa(?:s)?\b/i,'Casa'],[/\boficina(?:s)?\b/i,'Oficina'],
  [/\bgalp[oó]n(?:es)?\b/i,'Galpón'],[/\bterreno(?:s)?\b/i,'Terreno']
]);
const FEATURE_ALIASES=Object.freeze([
  [/\bplanta(?: el[eé]ctrica)?\b/i,'planta_electrica'],[/\bplanta\s*100\s*%/i,'planta_100'],
  [/\bpozo\b/i,'pozo'],[/\btanque\b/i,'tanque'],[/\bpiscina\b/i,'piscina'],
  [/\bamoblad[oa]\b/i,'amoblado'],[/\bfinanciamiento\b/i,'financiamiento']
]);

const uniq=values=>[...new Set((values||[]).filter(Boolean))];
const numberOrNull=value=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;};
const normalizedText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function parseCompactMoney(raw=''){
  const clean=String(raw).trim().toLowerCase().replace(/\s+/g,'').replace(/[.,;:]+$/,'');
  if(!clean)return null;
  const suffix=/m(?:il)?$/.test(clean)?1000:/mm|mill[oó]n(?:es)?$/i.test(clean)?1000000:1;
  const numeric=clean.replace(/(?:usd|us\$|\$)/g,'').replace(/(?:millones?|mm|mil|m)$/i,'');
  if(!numeric)return null;
  let value;
  if(/^\d{1,3}(?:\.\d{3})+$/.test(numeric))value=Number(numeric.replace(/\./g,''));
  else if(/^\d{1,3}(?:,\d{3})+$/.test(numeric))value=Number(numeric.replace(/,/g,''));
  else value=Number(numeric.replace(',','.'));
  return Number.isFinite(value)?Math.round(value*suffix):null;
}

function locationMatches(text,catalog){
  const normalized=normLocation(text),zones=[],municipalities=[],complexes=[];
  for(const zone of catalog?.zones||[]){
    const names=[zone.nombre,...(zone.aliases||[])].filter(Boolean);
    if(names.some(name=>normalized.includes(normLocation(name))))zones.push(zone.id);
  }
  for(const municipality of catalog?.municipalities||[]){
    const names=[municipality.nombre,...(municipality.aliases||[])].filter(Boolean);
    if(names.some(name=>normalized.includes(normLocation(name))))municipalities.push(municipality.id);
  }
  for(const complex of catalog?.complexes||[]){
    const names=[complex.nombre,...(complex.aliases||[])].filter(Boolean);
    if(names.some(name=>normalized.includes(normLocation(name))))complexes.push(complex.id);
  }
  return {zone_ids:uniq(zones),municipality_ids:uniq(municipalities),complex_ids:uniq(complexes)};
}

export function normalizeRequestCriteria(input={}){
  const required=uniq(input.required_features);
  return {
    operation:input.operation||null,
    property_types:uniq(input.property_types),municipality_ids:uniq(input.municipality_ids),
    zone_ids:uniq(input.zone_ids),complex_ids:uniq(input.complex_ids),
    min_price:numberOrNull(input.min_price),max_price:numberOrNull(input.max_price),
    min_area:numberOrNull(input.min_area),max_area:numberOrNull(input.max_area),
    min_bedrooms:numberOrNull(input.min_bedrooms),min_bathrooms:numberOrNull(input.min_bathrooms),
    min_parking:numberOrNull(input.min_parking),required_features:required,
    desired_features:uniq(input.desired_features).filter(x=>!required.includes(x)),
    budget_tolerance:Math.max(0,Math.min(10,numberOrNull(input.budget_tolerance)||0)),
    vigency_requirement:input.vigency_requirement||'active'
  };
}

export function parseRequestText(text='',catalog={}){
  const raw=String(text||'').trim(),plain=normalizedText(raw),warnings=[],ambiguities=[];
  const criteria={operation:null,property_types:[],required_features:[],desired_features:[]};
  if(/\b(alquil(?:er|o)|canon|arrend)/i.test(plain))criteria.operation='Alquiler';
  if(/\b(venta|comprar|compro|inversion)/i.test(plain)){
    if(criteria.operation)ambiguities.push('La operación menciona venta y alquiler.');
    else criteria.operation='Venta';
  }
  if(!criteria.operation&&/\b(busco|solicito|necesito|requiero)\b/i.test(plain)&&!/\b(alquil|arrend|canon)\b/i.test(plain))criteria.operation='Venta';
  for(const [rx,type] of TYPE_ALIASES)if(rx.test(plain))criteria.property_types.push(type);
  Object.assign(criteria,locationMatches(raw,catalog));

  const priceMatch=raw.match(/(?:hasta|m[aá]ximo|tope|presupuesto(?:\s+de)?)(?:\s+(?:de|es))?\s*(?:USD|US\$|\$)?\s*([\d.,]+\s*(?:mil|m|mm|mill[oó]n(?:es)?)?)/i);
  if(priceMatch)criteria.max_price=parseCompactMoney(priceMatch[1]);
  const minPriceMatch=raw.match(/(?:desde|m[ií]nimo)\s*(?:USD|US\$|\$)?\s*([\d.,]+\s*(?:mil|m|mm|mill[oó]n(?:es)?)?)/i);
  if(minPriceMatch)criteria.min_price=parseCompactMoney(minPriceMatch[1]);
  const bedrooms=raw.match(/(?:m[ií]nimo\s*)?(\d+)\s*(?:habitaciones?|hab\b)/i);
  const bathrooms=raw.match(/(?:m[ií]nimo\s*)?(\d+)\s*(?:baños?|banos?)/i);
  const parking=raw.match(/(?:m[ií]nimo\s*)?(\d+)\s*(?:puestos?|estacionamientos?)/i);
  const area=raw.match(/(?:m[ií]nimo\s*)?([\d.,]+)\s*(?:m2|m²|mts?²)/i);
  if(bedrooms)criteria.min_bedrooms=Number(bedrooms[1]);
  if(bathrooms)criteria.min_bathrooms=Number(bathrooms[1]);
  if(parking)criteria.min_parking=Number(parking[1]);
  if(area)criteria.min_area=parseCompactMoney(area[1]);
  for(const [rx,feature] of FEATURE_ALIASES)if(rx.test(plain))criteria.desired_features.push(feature);
  if(/\b(obligatori[oa]|indispensable|debe tener|con requisito)\b/i.test(plain)){
    criteria.required_features=[...criteria.desired_features];criteria.desired_features=[];
  }
  if(!criteria.operation)warnings.push('Operación no detectada: confirma venta o alquiler.');
  if(!criteria.property_types.length)warnings.push('Tipo de inmueble no detectado.');
  if(!criteria.max_price&&/\b(hasta|tope|presupuesto|maximo|máximo)\b/i.test(raw))ambiguities.push('El presupuesto máximo no pudo interpretarse con seguridad.');
  if(!criteria.zone_ids.length&&!criteria.municipality_ids.length&&!criteria.complex_ids.length)warnings.push('Ubicación no detectada o no incluida en el catálogo controlado.');
  return {raw_text:raw,criteria:normalizeRequestCriteria(criteria),warnings,ambiguities,requires_confirmation:true};
}

function complexGate(request,master){
  if(!(request.complex_ids||[]).length)return true;
  return request.complex_ids.includes(master.complex_id);
}

export function matchRequestToMasters(request={},masters=[]){
  const criteria=normalizeRequestCriteria(request.criteria||request);
  const exact=[],verify=[],alternatives=[];
  for(const master of masters){
    if(!complexGate(criteria,master))continue;
    const match=scoreBuyerMaster(criteria,master);
    if(!match)continue;
    const vigencyUnknown=criteria.vigency_requirement==='verified'&&!master.last_verified_at&&!['verified','active_verified'].includes(master.status);
    const row={master_id:master.id,master,score:match.score,reasons:match.reasons,gaps:match.gaps,match_kind:match.match_kind};
    if(vigencyUnknown){row.score=Math.min(row.score,79);row.match_kind='por_verificar';row.gaps=[...new Set(['Disponibilidad por confirmar',...row.gaps])];verify.push(row);}
    else if(match.strict_ok)exact.push(row);
    else if(match.match_kind==='por_verificar')verify.push(row);
    else alternatives.push(row);
  }
  const sort=(a,b)=>b.score-a.score||String(b.master.last_seen_at||'').localeCompare(String(a.master.last_seen_at||''));
  return {exact:exact.sort(sort),verify:verify.sort(sort),alternatives:alternatives.sort(sort)};
}

export function requestCriteriaSummary(criteria={},catalog={}){
  const c=normalizeRequestCriteria(criteria),parts=[];
  if(c.operation)parts.push(c.operation);
  if(c.property_types.length)parts.push(c.property_types.join(' o '));
  const zones=c.zone_ids.map(id=>(catalog.zones||[]).find(x=>x.id===id)?.nombre).filter(Boolean);
  const municipalities=c.municipality_ids.map(id=>(catalog.municipalities||[]).find(x=>x.id===id)?.nombre).filter(Boolean);
  if(zones.length)parts.push(zones.join(', '));else if(municipalities.length)parts.push(municipalities.join(', '));
  if(c.max_price!=null)parts.push(`hasta $${c.max_price.toLocaleString('es-VE')}`);
  if(c.min_bedrooms!=null)parts.push(`${c.min_bedrooms}+ habitaciones`);
  const features=[...c.required_features,...c.desired_features].map(key=>BUYER_FEATURES.find(x=>x[0]===key)?.[1]||key);
  if(features.length)parts.push(features.join(', '));
  return parts.join(' · ')||'Criterios por confirmar';
}

export function newMatchingMasterIds(matches={},previouslySent=[]){
  const sent=new Set(previouslySent||[]);
  return [...(matches.exact||[]),...(matches.verify||[]),...(matches.alternatives||[])].map(row=>row.master_id).filter(id=>!sent.has(id));
}
