import { normLocation, SEED_ZONES, SEED_LOCATION_CATALOG, resolveLocationRecord } from './location-catalog.js?v=0520';
export function normLoc(s=''){return normLocation(s);}
export const KNOWN_ZONES=[...new Set(SEED_ZONES.flatMap(z=>[z.nombre,...(z.aliases||[])]))].sort((a,b)=>b.length-a.length);
export function extractLocationTerms(text='',existingZone=null){
  const r=resolveLocationRecord(text,SEED_LOCATION_CATALOG,{existingZone});
  return [...new Set([...(r.location_terms||[]),existingZone].filter(Boolean))];
}
export function bestZone(text='',existingZone=null){
  return resolveLocationRecord(text,SEED_LOCATION_CATALOG,{existingZone}).zone||existingZone||null;
}
