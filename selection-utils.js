const PUBLIC_FIELDS=Object.freeze([
  'property_type','operation','zone','residence','price_usd','area_m2','bedrooms','bathrooms','parking',
  'planta_electrica','planta_100','pozo','tanque','piscina','amoblado','financiamiento','public_description','main_photo_url'
]);

export function randomSelectionSlug(bytes=12,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.getRandomValues)throw new Error('No existe un generador criptográfico seguro.');
  const data=new Uint8Array(bytes);cryptoImpl.getRandomValues(data);
  return [...data].map(x=>x.toString(36).padStart(2,'0')).join('').slice(0,20);
}

export function sanitizePublicProperty(master={}){
  const out={};
  for(const key of PUBLIC_FIELDS)if(master[key]!==undefined&&master[key]!==null&&master[key]!=='')out[key]=master[key];
  out.public_description=String(master.public_description||master.description_public||'').slice(0,2000);
  if(master.main_photo_url){try{const url=new URL(master.main_photo_url);if(url.protocol==='https:')out.main_photo_url=url.toString();else delete out.main_photo_url;}catch{delete out.main_photo_url;}}
  return out;
}

export function buildPublicSelection(selection={},masters=[]){
  const ids=new Set(selection.master_property_ids||[]);
  const properties=(ids.size?masters.filter(master=>ids.has(master.id)):masters).map(sanitizePublicProperty);
  return {
    schema_version:1,slug:selection.public_slug||null,status:selection.status||'active',
    title:String(selection.title||'Selección de propiedades').slice(0,140),
    client_name:String(selection.client_name||'').slice(0,100)||null,
    brand:'Emperatriz Abre Puertas',expires_at:selection.expires_at||null,
    updated_at:selection.updated_at||new Date().toISOString(),properties
  };
}

export function publicSelectionAvailable(payload={},now=Date.now()){
  if(payload.status!=='active')return false;
  const expires=payload.expires_at?Date.parse(payload.expires_at):NaN;
  return !Number.isFinite(expires)||expires>now;
}

export const PUBLIC_SELECTION_FIELDS=PUBLIC_FIELDS;
