import {norm} from './search-utils.js?v=0784';
import {normLoc,extractLocationTerms} from './location-utils.js?v=0783';
import {isDemandRequest} from './intent-utils.js?v=0783';
import {propertyTimestamp} from './date-utils.js?v=0783';
const SEARCH_ALIAS=[
  [/\b(?:town\s*house|townhouse|townhause|town\s*home|townhome|\bth\b)\b/g,'townhouse'],
  [/\b(?:apto|apartamento)\b/g,'apartamento'],
  [/\b(?:quinta|vivienda|chalet|casa)\b/g,'casa'],
  [/\b(?:pent\s*house|penthouse|\bph\b)\b/g,'penthouse'],
  [/\b(?:galpon|galpón)\b/g,'galpon']
];
function canonSearch(s=''){let x=norm(s);for(const [rx,v] of SEARCH_ALIAS)x=x.replace(rx,v);return x.replace(/\s+/g,' ').trim();}
function editDistance1(a,b){
  if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,d=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++d>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return d+(i<a.length||j<b.length?1:0)<=1;
}

export function prepareFilters(filters={}){
  const today=new Date();today.setHours(0,0,0,0);
  return {...filters,today:today.getTime(),residence:norm(filters.residence||''),queryWords:canonSearch(filters.q||'').split(' ').filter(Boolean)};
}
export function createSearchRecord(p){
  const timestamp=propertyTimestamp(p),day=new Date(timestamp);day.setHours(0,0,0,0);
  const normalizedSearchText=canonSearch([p.operation,p.property_type,p.municipality,p.zone,p.zone_detected,p.residence,p.complex_detected,p.sender,p.group,...(p.location_terms||[]),p.text,p.normalized].filter(Boolean).join(' '));
  const normalizedLocation=normLoc([p.municipality,p.zone,p.zone_detected,p.residence,p.complex_detected,...(p.location_terms||[]),...(p.zone_matches||[]).map(x=>x.nombre),...extractLocationTerms(p.text||'',p.zone),p.text].filter(Boolean).join(' '));
  const record={...p,timestamp,day:day.getTime(),time:String(p.time||''),normalizedSearchText,words:normalizedSearchText.split(' ').filter(Boolean),normalizedLocation,normalizedMunicipality:normLoc([p.municipality,p.zone,p.text].filter(Boolean).join(' ')),normalizedResidence:norm(p.residence||''),normalizedText:norm(p.text||''),isDemand:isDemandRequest(p.text||''),hasPhone:!!(p.phone||p.resolved_phone)};
  for(const key of ['text','location_terms','zone_matches','normalized','sender','group','date','date_iso','date_order'])delete record[key];
  return record;
}
export function matchesSearchRecord(p, f) {
  const days=p.timestamp?Math.floor((f.today-p.day)/86400000):9999;
  if(days<0||days>60||p.isDemand)return false;
  for(const t of f.queryWords){
    if(p.normalizedSearchText.includes(t))continue;
    if(t.length>=5&&p.words.some(w=>w.length>=4&&editDistance1(t,w)))continue;
    return false;
  }
  if (f.operation && p.operation !== f.operation) return false;
  const types=Array.isArray(f.property_types)?f.property_types.filter(Boolean):[];
  if(types.length && !types.includes(p.property_type)) return false;

  const municipalityIds=Array.isArray(f.municipality_ids)?f.municipality_ids.filter(Boolean):[];
  if(municipalityIds.length && p.municipality_id && !municipalityIds.includes(p.municipality_id)) return false;
  if(municipalityIds.length && !p.municipality_id){
    const names=(f.municipality_names||[]).filter(Boolean);
    const mhay=p.normalizedMunicipality;
    if(names.length && !names.some(x=>mhay.includes(normLoc(x)))) return false;
  }

  const zoneIds=Array.isArray(f.zone_ids)?f.zone_ids.filter(Boolean):[];
  if(zoneIds.length && p.zone_id && !zoneIds.includes(p.zone_id)) return false;

  const zones=Array.isArray(f.zones)?f.zones.filter(Boolean):[];
  if(zones.length){
    const locationHay=p.normalizedLocation;
    if(!zones.some(z=>locationHay.includes(normLoc(z)))) return false;
  }

  const residence = f.residence;
  if (residence && !p.normalizedResidence.includes(residence) && !p.normalizedText.includes(residence)) return false;

  const minPrice = Number(f.min_price || 0);
  const maxPrice = Number(f.max_price || 0);
  if (minPrice && (!p.price_usd || Number(p.price_usd) < minPrice)) return false;
  if (maxPrice && (!p.price_usd || Number(p.price_usd) > maxPrice)) return false;

  const minBeds = Number(f.bedrooms || 0);
  if (minBeds && (!p.bedrooms || Number(p.bedrooms) < minBeds)) return false;

  const minBaths = Number(f.bathrooms || 0);
  if (minBaths && (!p.bathrooms || Number(p.bathrooms) < minBaths)) return false;

  const minParking = Number(f.parking || 0);
  if (minParking && (!p.parking || Number(p.parking) < minParking)) return false;

  const minArea = Number(f.min_area || 0);
  const maxArea = Number(f.max_area || 0);
  if (minArea && (!p.area_m2 || Number(p.area_m2) < minArea)) return false;
  if (maxArea && (!p.area_m2 || Number(p.area_m2) > maxArea)) return false;

  for (const key of ['planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina']) {
    if (f[key] && !p[key]) return false;
  }

  if (f.only_phone && !p.hasPhone) return false;
  if (f.max_age_days) {
    const r = {days};
    if (r.days > Number(f.max_age_days)) return false;
  }
  return true;
}

