import { isDemandRequest } from './intent-utils.js?v=0522';
import { extractLocationTerms, bestZone } from './location-utils.js?v=0522';
import { detectDateOrderFromDates, parseFlexibleDate, toISODate } from './date-utils.js?v=0522';
import { cleanPhone, personAliasKeys } from './contact-utils.js?v=0522';
import { SEED_MUNICIPALITIES, SEED_ZONES, SEED_COMPLEXES, normLocation, slugLocation, resolveLocationRecord } from './location-catalog.js?v=0522';

const DB_NAME = 'grupos-inmobiliarios';
const DB_VERSION = 6;
const PROP_STORE = 'properties';
const IMPORT_STORE = 'imports';
const FAV_STORE = 'favorites';
const CONTACT_STORE = 'contacts';
const MUNICIPALITY_STORE='municipalities';
const ZONE_STORE='zones';
const COMPLEX_STORE='complexes';
const LOCATION_PENDING_STORE='location_pending';
// Radar Core v0.5.0: the legacy WhatsApp inventory remains untouched.
// These stores form the new multi-source layer that can later receive Instagram,
// portals, Marketplace-assisted captures and server synchronization.
const MASTER_STORE='master_properties';
const SOURCE_POST_STORE='source_posts';
const BUYER_STORE='buyers';
const MATCH_STORE='matches';
const SYNC_QUEUE_STORE='sync_queue';


function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROP_STORE)) {
        const s = db.createObjectStore(PROP_STORE, { keyPath: 'id' });
        s.createIndex('group', 'group', { unique: false });
        s.createIndex('zone', 'zone', { unique: false });
        s.createIndex('property_type', 'property_type', { unique: false });
        s.createIndex('price_usd', 'price_usd', { unique: false });
      }
      if (!db.objectStoreNames.contains(IMPORT_STORE)) {
        db.createObjectStore(IMPORT_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(FAV_STORE)) {
        db.createObjectStore(FAV_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONTACT_STORE)) {
        db.createObjectStore(CONTACT_STORE, { keyPath: 'phone' });
      }
      if(!db.objectStoreNames.contains(MUNICIPALITY_STORE)) db.createObjectStore(MUNICIPALITY_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(ZONE_STORE)) db.createObjectStore(ZONE_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(COMPLEX_STORE)) db.createObjectStore(COMPLEX_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(LOCATION_PENDING_STORE)){
        const lp=db.createObjectStore(LOCATION_PENDING_STORE,{keyPath:'id'});
        lp.createIndex('status','status',{unique:false});lp.createIndex('kind','kind',{unique:false});
      }
      if(!db.objectStoreNames.contains(MASTER_STORE)){
        const s=db.createObjectStore(MASTER_STORE,{keyPath:'id'});
        s.createIndex('operation','operation',{unique:false});
        s.createIndex('property_type','property_type',{unique:false});
        s.createIndex('municipality_id','municipality_id',{unique:false});
        s.createIndex('zone_id','zone_id',{unique:false});
        s.createIndex('complex_id','complex_id',{unique:false});
        s.createIndex('status','status',{unique:false});
        s.createIndex('last_seen_at','last_seen_at',{unique:false});
      }
      if(!db.objectStoreNames.contains(SOURCE_POST_STORE)){
        const s=db.createObjectStore(SOURCE_POST_STORE,{keyPath:'id'});
        s.createIndex('master_id','master_id',{unique:false});
        s.createIndex('source_type','source_type',{unique:false});
        s.createIndex('legacy_property_id','legacy_property_id',{unique:false});
        s.createIndex('published_at','published_at',{unique:false});
        s.createIndex('agent_phone','agent_phone',{unique:false});
      }
      if(!db.objectStoreNames.contains(BUYER_STORE)){
        const s=db.createObjectStore(BUYER_STORE,{keyPath:'id'});
        s.createIndex('status','status',{unique:false});
        s.createIndex('updated_at','updated_at',{unique:false});
      }
      if(!db.objectStoreNames.contains(MATCH_STORE)){
        const s=db.createObjectStore(MATCH_STORE,{keyPath:'id'});
        s.createIndex('buyer_id','buyer_id',{unique:false});
        s.createIndex('master_id','master_id',{unique:false});
        s.createIndex('score','score',{unique:false});
      }
      if(!db.objectStoreNames.contains(SYNC_QUEUE_STORE)){
        const s=db.createObjectStore(SYNC_QUEUE_STORE,{keyPath:'id',autoIncrement:true});
        s.createIndex('status','status',{unique:false});
        s.createIndex('created_at','created_at',{unique:false});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function mergeProperties(records, onProgress) {
  const db = await openDB();
  let added = 0, updated = 0;
  const BATCH = 250;

  for (let start = 0; start < records.length; start += BATCH) {
    const batch = records.slice(start, start + BATCH);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PROP_STORE, 'readwrite');
      const store = tx.objectStore(PROP_STORE);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      for (const rec of batch) {
        const get = store.get(rec.id);
        get.onsuccess = () => {
          const old = get.result;
          if (!old) {
            store.put({
              ...rec,
              appearances: Math.max(1, (rec.sources || []).length, rec.appearances || 1),
              first_seen_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString()
            });
            added++;
            return;
          }

          const seen = new Set((old.sources || []).map(
            s => `${s.group}|${s.sender}|${s.date}|${s.time}|${s.phone || ''}`
          ));
          const mergedSources = [...(old.sources || [])];

          for (const s of rec.sources || []) {
            const k = `${s.group}|${s.sender}|${s.date}|${s.time}|${s.phone || ''}`;
            if (!seen.has(k)) {
              seen.add(k);
              mergedSources.push(s);
            }
          }

          store.put({
            ...old,
            ...rec,
            appearances: Math.max(1, mergedSources.length),
            sources: mergedSources,
            first_seen_at: old.first_seen_at || new Date().toISOString(),
            last_seen_at: new Date().toISOString()
          });
          updated++;
        };
      }
    });

    onProgress?.(Math.min(records.length, start + BATCH), records.length);
    await new Promise(r => setTimeout(r, 0));
  }

  db.close();
  return { added, updated };
}


export async function patchPropertyPriceAudits(records=[]){
  if(!records.length)return {updated:0};
  const db=await openDB();let updated=0;const BATCH=250;
  for(let i=0;i<records.length;i+=BATCH){
    const batch=records.slice(i,i+BATCH);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROP_STORE,'readwrite'),store=tx.objectStore(PROP_STORE);
      for(const rec of batch){
        const req=store.get(rec.id);
        req.onsuccess=()=>{
          const old=req.result;if(!old)return;
          store.put({...old,
            price_usd:rec.price_usd??null,
            price_confidence:rec.price_confidence||'missing',
            price_audit_status:rec.price_audit_status||'ok',
            price_evidence:rec.price_evidence||null,
            price_audit_version:'0511',
            price_audited:true
          });updated++;
        };
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    await new Promise(r=>setTimeout(r,0));
  }
  db.close();return {updated};
}

export async function addImport(summary) {
  const db = await openDB();
  const tx = db.transaction(IMPORT_STORE, 'readwrite');
  const id = await reqP(tx.objectStore(IMPORT_STORE).add({
    ...summary,
    imported_at: new Date().toISOString()
  }));
  db.close();
  return id;
}

export async function getStats() {
  const db = await openDB();
  const tx = db.transaction([PROP_STORE, IMPORT_STORE, FAV_STORE], 'readonly');
  const properties = await reqP(tx.objectStore(PROP_STORE).count());
  const imports = await reqP(tx.objectStore(IMPORT_STORE).count());
  const favorites = await reqP(tx.objectStore(FAV_STORE).count());
  db.close();
  return { properties, imports, favorites };
}

export async function getRecentImports(limit = 8) {
  const db = await openDB();
  const tx = db.transaction(IMPORT_STORE, 'readonly');
  const store = tx.objectStore(IMPORT_STORE);
  const out = [];
  await new Promise((resolve, reject) => {
    const req = store.openCursor(null, 'prev');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const c = req.result;
      if (!c || out.length >= limit) return resolve();
      out.push(c.value);
      c.continue();
    };
  });
  db.close();
  return out;
}

export async function getAllProperties() {
  const db = await openDB();
  const tx = db.transaction(PROP_STORE, 'readonly');
  const items = await reqP(tx.objectStore(PROP_STORE).getAll());
  db.close();
  return items;
}

export async function getPropertiesByIds(ids=[]) {
  const db = await openDB();
  const tx = db.transaction(PROP_STORE, 'readonly');
  const store = tx.objectStore(PROP_STORE);
  const out = [];
  for (const id of ids) {
    const p = await reqP(store.get(id));
    if (p) out.push(p);
  }
  db.close();
  return out;
}

export async function getFavoriteIds() {
  const db = await openDB();
  const tx = db.transaction(FAV_STORE, 'readonly');
  const rows = await reqP(tx.objectStore(FAV_STORE).getAll());
  db.close();
  return new Set(rows.map(x => x.id));
}

export async function toggleFavorite(id) {
  const db = await openDB();
  const tx = db.transaction(FAV_STORE, 'readwrite');
  const store = tx.objectStore(FAV_STORE);
  const current = await reqP(store.get(id));
  if (current) store.delete(id);
  else store.put({id, saved_at: new Date().toISOString()});
  await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
  db.close();
  return !current;
}



function mergeAliasRows(old,row){
  return {...row,...old,aliases:[...new Set([...(old?.aliases||[]),...(row.aliases||[]),old?.nombre,row.nombre].filter(Boolean))]};
}
export async function ensureLocationCatalogSeed(){
  const db=await openDB();
  const current=await new Promise((resolve,reject)=>{
    const tx=db.transaction([MUNICIPALITY_STORE,ZONE_STORE,COMPLEX_STORE],'readonly');
    Promise.all([
      reqP(tx.objectStore(MUNICIPALITY_STORE).getAll()),
      reqP(tx.objectStore(ZONE_STORE).getAll()),
      reqP(tx.objectStore(COMPLEX_STORE).getAll())
    ]).then(([municipalities,zones,complexes])=>resolve({municipalities,zones,complexes})).catch(reject);
  });
  const approvedZones=(current.zones||[]).filter(x=>['ia_aprobada','user_approved'].includes(x.fuente));
  const approvedComplexes=(current.complexes||[]).filter(x=>['ia_aprobada','user_approved'].includes(x.fuente));
  const oldZones=new Map((current.zones||[]).map(x=>[x.id,x]));
  const oldComplexes=new Map((current.complexes||[]).map(x=>[x.id,x]));

  await new Promise((resolve,reject)=>{
    const tx=db.transaction([MUNICIPALITY_STORE,ZONE_STORE,COMPLEX_STORE],'readwrite');
    const ms=tx.objectStore(MUNICIPALITY_STORE),zs=tx.objectStore(ZONE_STORE),cs=tx.objectStore(COMPLEX_STORE);
    ms.clear();zs.clear();cs.clear();
    for(const row of SEED_MUNICIPALITIES) ms.put(row);
    for(const row of SEED_ZONES){
      const prev=oldZones.get(row.id);
      zs.put(prev?mergeAliasRows(prev,row):row);
    }
    for(const row of SEED_COMPLEXES){
      const prev=oldComplexes.get(row.id);
      cs.put(prev?mergeAliasRows(prev,row):row);
    }
    for(const row of approvedZones) if(!SEED_ZONES.some(x=>x.id===row.id)) zs.put(row);
    for(const row of approvedComplexes) if(!SEED_COMPLEXES.some(x=>x.id===row.id)) cs.put(row);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
}

export async function getLocationCatalog(){
  const db=await openDB(),tx=db.transaction([MUNICIPALITY_STORE,ZONE_STORE,COMPLEX_STORE],'readonly');
  const municipalities=await reqP(tx.objectStore(MUNICIPALITY_STORE).getAll()),zones=await reqP(tx.objectStore(ZONE_STORE).getAll()),complexes=await reqP(tx.objectStore(COMPLEX_STORE).getAll());db.close();
  return {municipalities,zones,complexes};
}
export async function getLocationStats(){
  const cat=await getLocationCatalog(),pending=await getLocationPendings('pending');
  return {municipalities:cat.municipalities.filter(x=>x.activo!==false).length,zones:cat.zones.filter(x=>x.activo!==false).length,complexes:cat.complexes.filter(x=>x.activo!==false).length,pending:pending.length};
}
function pendingId(x){return `${x.kind}|${normLocation(x.detected||'')}|${x.zone_id||''}`;}
export async function recordLocationPendings(items=[]){
  if(!items.length)return {added:0,updated:0};const db=await openDB();let added=0,updated=0;
  await new Promise((resolve,reject)=>{const tx=db.transaction(LOCATION_PENDING_STORE,'readwrite'),s=tx.objectStore(LOCATION_PENDING_STORE);
    for(const x of items){if(!x?.kind||!x?.detected)continue;const id=pendingId(x),q=s.get(id);q.onsuccess=()=>{const old=q.result,propIds=[...new Set([...(old?.property_ids||[]),x.property_id].filter(Boolean))],samples=[...(old?.samples||[])];
      if(x.sample_text&&!samples.some(v=>v===x.sample_text))samples.unshift(x.sample_text);if(samples.length>3)samples.length=3;
      if(old){s.put({...old,...x,id,status:old.status||'pending',seen_count:Number(old.seen_count||0)+1,property_ids:propIds,samples,last_seen_at:new Date().toISOString()});updated++;}
      else{s.put({...x,id,status:'pending',seen_count:1,property_ids:propIds,samples,created_at:new Date().toISOString(),last_seen_at:new Date().toISOString()});added++;}}}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return {added,updated};
}
export async function clearLocationPendings(){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(LOCATION_PENDING_STORE,'readwrite');
    tx.objectStore(LOCATION_PENDING_STORE).clear();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
export async function getLocationPendings(status='pending'){
  const db=await openDB(),tx=db.transaction(LOCATION_PENDING_STORE,'readonly'),s=tx.objectStore(LOCATION_PENDING_STORE),rows=await reqP(s.getAll());db.close();
  return rows.filter(x=>!status||x.status===status).sort((a,b)=>(b.seen_count||0)-(a.seen_count||0)||String(b.last_seen_at||'').localeCompare(String(a.last_seen_at||'')));
}
async function updatePending(id,patch){const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(LOCATION_PENDING_STORE,'readwrite'),s=tx.objectStore(LOCATION_PENDING_STORE),q=s.get(id);q.onsuccess=()=>{if(q.result)s.put({...q.result,...patch,updated_at:new Date().toISOString()});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
export async function linkLocationPending(id,targetId){
  const rows=await getLocationPendings(null),p=rows.find(x=>x.id===id);if(!p)throw new Error('Detección no encontrada');const db=await openDB();
  await new Promise((resolve,reject)=>{const storeName=p.kind==='zone'?ZONE_STORE:COMPLEX_STORE,tx=db.transaction(storeName,'readwrite'),s=tx.objectStore(storeName),q=s.get(targetId);q.onsuccess=()=>{const r=q.result;if(!r)throw new Error('Destino no encontrado');s.put({...r,aliases:[...new Set([...(r.aliases||[]),r.nombre,p.detected].filter(Boolean))],fuente:r.fuente||'manual'});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  await updatePending(id,{status:'resolved',resolution:'linked',target_id:targetId});return p;
}
export async function createZoneFromPending(id,municipalityId,name){
  const rows=await getLocationPendings(null),p=rows.find(x=>x.id===id);if(!p)throw new Error('Detección no encontrada');const nombre=String(name||p.detected).trim(),zone={id:`zone_${slugLocation(nombre)}_${municipalityId.replace(/^mun_/,'')}`,nombre,municipio_id:municipalityId,aliases:[nombre,p.detected],fuente:'ia_aprobada',activo:true};
  const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(ZONE_STORE,'readwrite');tx.objectStore(ZONE_STORE).put(zone);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();await updatePending(id,{status:'resolved',resolution:'created',target_id:zone.id});return {pending:p,zone};
}
export async function createComplexFromPending(id,zoneId,name,tipo='conjunto_cerrado'){
  const rows=await getLocationPendings(null),p=rows.find(x=>x.id===id);if(!p)throw new Error('Detección no encontrada');const nombre=String(name||p.detected).trim(),row={id:`complex_${slugLocation(nombre)}_${zoneId.replace(/^zone_/,'')}`,nombre,zona_id:zoneId,tipo,aliases:[nombre,p.detected],fuente:'ia_aprobada',activo:true};
  const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(COMPLEX_STORE,'readwrite');tx.objectStore(COMPLEX_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();await updatePending(id,{status:'resolved',resolution:'created',target_id:row.id});return {pending:p,complex:row};
}
export async function discardLocationPending(id){await updatePending(id,{status:'discarded',resolution:'discarded'});}
export async function rematchAllPropertyLocations(catalog){
  const db=await openDB();let updated=0;const pendings=[];
  await new Promise((resolve,reject)=>{const tx=db.transaction(PROP_STORE,'readwrite'),s=tx.objectStore(PROP_STORE),q=s.openCursor();q.onerror=()=>reject(q.error);q.onsuccess=()=>{const c=q.result;if(!c)return;const p=c.value,loc=resolveLocationRecord(p.text||'',catalog,{existingZone:p.zone,existingComplex:p.residence});
      const next={...p,municipality_id:loc.municipality_id,municipality:loc.municipality,zone_id:loc.zone_id,zone:loc.zone||p.zone||null,zone_detected:loc.zone_detected,zone_detected_norm:loc.zone_detected_norm,zone_confidence:loc.zone_confidence,zone_matches:loc.zone_matches,complex_id:loc.complex_id,complex_detected:loc.complex_detected,complex_detected_norm:loc.complex_detected_norm,complex_confidence:loc.complex_confidence,location_requires_review:loc.requires_review,location_terms:[...new Set([...(loc.location_terms||[]),...(p.location_terms||[])])],residence:loc.complex||p.residence||loc.complex_detected||null};
      c.update(next);for(const x of loc.pending||[])pendings.push({...x,property_id:p.id,group:p.group,sender:p.sender,date:p.date,date_iso:p.date_iso,sample_text:(p.text||'').slice(0,1800)});updated++;c.continue();};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();await recordLocationPendings(pendings);return {updated,pending:pendings.length};
}

export async function upsertContacts(records=[],sourceLabel='contactos'){
  const db=await openDB();let added=0,updated=0;
  const clean=records.map(r=>{const phone=cleanPhone(r.phone),aliases=[...new Set([...(r.aliases||[]),r.display_name].filter(Boolean))];
    return {...r,phone,aliases,alias_keys:[...new Set([...(r.alias_keys||[]),...aliases.flatMap(personAliasKeys)])],sources:[...new Set([...(r.sources||[]),sourceLabel].filter(Boolean))]};}).filter(r=>r.phone&&r.alias_keys.length);
  await new Promise((resolve,reject)=>{const tx=db.transaction(CONTACT_STORE,'readwrite'),store=tx.objectStore(CONTACT_STORE);
    for(const r of clean){const q=store.get(r.phone);q.onsuccess=()=>{const old=q.result;if(!old){store.put({...r,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});added++;}
      else{store.put({...old,...r,display_name:old.display_name||r.display_name,aliases:[...new Set([...(old.aliases||[]),...(r.aliases||[])])],alias_keys:[...new Set([...(old.alias_keys||[]),...(r.alias_keys||[])])],sources:[...new Set([...(old.sources||[]),...(r.sources||[])])],updated_at:new Date().toISOString()});updated++;}}}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return {added,updated,total:clean.length};
}
export async function learnContactsFromProperties(records=[]){
  const rows=[];for(const p of records){if(p?.sender&&p?.phone)rows.push({phone:p.phone,display_name:p.sender,aliases:[p.sender],alias_keys:personAliasKeys(p.sender),sources:['publicación']});
    for(const s of p?.sources||[])if(s?.sender&&s?.phone)rows.push({phone:s.phone,display_name:s.sender,aliases:[s.sender],alias_keys:personAliasKeys(s.sender),sources:['publicación']});}
  return upsertContacts(rows,'aprendido de publicaciones');
}
export async function getAllContacts(){const db=await openDB(),tx=db.transaction(CONTACT_STORE,'readonly'),rows=await reqP(tx.objectStore(CONTACT_STORE).getAll());db.close();return rows;}
export async function getContactStats(){const contacts=await getAllContacts(),aliases=new Set();for(const c of contacts)for(const a of c.alias_keys||[])aliases.add(a);return {contacts:contacts.length,aliases:aliases.size};}

function parseLocalDate(dateStr='', order='auto') {
  return parseFlexibleDate(dateStr,order,'MDY');
}

export async function purgeOldProperties(maxAgeDays=60) {
  const db=await openDB();
  const cutoff=new Date();
  cutoff.setHours(0,0,0,0);
  cutoff.setDate(cutoff.getDate()-Number(maxAgeDays));
  const cutoffTs=cutoff.getTime();

  let removed=0, refreshed=0, migrated=0, oldSourcesRemoved=0;

  await new Promise((resolve,reject)=>{
    const tx=db.transaction([PROP_STORE,FAV_STORE],'readwrite');
    const props=tx.objectStore(PROP_STORE);
    const favs=tx.objectStore(FAV_STORE);
    const req=props.openCursor();

    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const c=req.result;
      if(!c) return;

      const p=c.value;
      if(isDemandRequest(p.text||'')){
        c.delete(); favs.delete(p.id); removed++; c.continue(); return;
      }
      const allRaw=[
        p.date,
        ...(p.sources||[]).map(s=>s.date)
      ].filter(Boolean);

      // Existing records came from the same WhatsApp export. Infer order from
      // unambiguous dates; if all are ambiguous, current app defaults to MDY.
      const inferredOrder=p.date_order || detectDateOrderFromDates(allRaw,'MDY');

      const rawSources=(p.sources||[]).length ? p.sources : [{
        group:p.group,sender:p.sender,date:p.date,date_iso:p.date_iso,
        date_order:p.date_order,time:p.time,phone:p.phone
      }];

      const normalizedSources=rawSources.map(s=>{
        const order=s.date_order || inferredOrder;
        const iso=s.date_iso || toISODate(s.date,order,'MDY');
        const ts=iso ? parseFlexibleDate(iso,'auto','MDY') : parseFlexibleDate(s.date,order,'MDY');
        return {...s,date_order:order,date_iso:iso,_ts:ts};
      }).filter(s=>s._ts);

      const recentSources=normalizedSources.filter(s=>s._ts>=cutoffTs);
      oldSourcesRemoved += Math.max(0, normalizedSources.length-recentSources.length);

      if(!recentSources.length){
        c.delete();
        favs.delete(p.id);
        removed++;
        c.continue();
        return;
      }

      recentSources.sort((a,b)=>{
        if(a._ts!==b._ts) return b._ts-a._ts;
        return String(b.time||'').localeCompare(String(a.time||''));
      });

      const latest=recentSources[0];
      const cleanSources=recentSources.map(({_ts,...s})=>s);

      const locationTerms=(p.location_terms&&p.location_terms.length)?p.location_terms:extractLocationTerms(p.text||'',p.zone);
      const updated={
        ...p,
        zone:p.zone||bestZone(p.text||'',locationTerms[0]||null),
        location_terms:locationTerms,
        date:latest.date,
        date_iso:latest.date_iso,
        date_order:latest.date_order || inferredOrder,
        time:latest.time || p.time,
        sender:latest.sender || p.sender,
        group:latest.group || p.group,
        phone:latest.phone || p.phone,
        sources:cleanSources,
        appearances:Math.max(1,cleanSources.length)
      };

      if(!p.date_iso || p.date_order!==updated.date_order) migrated++;
      c.update(updated);
      refreshed++;
      c.continue();
    };

    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });

  db.close();
  return {
    removed,refreshed,migrated,oldSourcesRemoved,
    cutoff:cutoff.toISOString().slice(0,10)
  };
}
// ---------- Radar Core v0.5.0 -------------------------------------------------
// Stable, deterministic 32-bit hash used only for internal IDs (not security).
function radarHash(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}
function sourceDateTime(source={},fallback={}){
  const iso=source.date_iso||fallback.date_iso||null;
  const raw=source.date||fallback.date||null;
  const order=source.date_order||fallback.date_order||'MDY';
  const ts=iso?parseFlexibleDate(iso,'auto','MDY'):parseFlexibleDate(raw,order,'MDY');
  if(!ts)return fallback.last_seen_at||fallback.first_seen_at||new Date().toISOString();
  const d=new Date(ts),parts=String(source.time||fallback.time||'00:00:00').split(':').map(Number);
  d.setHours(parts[0]||0,parts[1]||0,parts[2]||0,0);return d.toISOString();
}
function legacySources(p={}){
  const rows=(p.sources&&p.sources.length)?p.sources:[{group:p.group,sender:p.sender,date:p.date,date_iso:p.date_iso,date_order:p.date_order,time:p.time,phone:p.phone}];
  return rows.filter(Boolean);
}
function masterSnapshot(p={},id,existing=null){
  const now=new Date().toISOString();
  return {
    ...(existing||{}),id,
    operation:p.operation||existing?.operation||null,property_type:p.property_type||existing?.property_type||null,
    municipality_id:p.municipality_id||existing?.municipality_id||null,municipality:p.municipality||existing?.municipality||null,
    zone_id:p.zone_id||existing?.zone_id||null,zone:p.zone||existing?.zone||null,
    complex_id:p.complex_id||existing?.complex_id||null,residence:p.residence||existing?.residence||null,
    price_usd:p.price_audited===true?(p.price_usd??null):(p.price_usd??existing?.price_usd??null),
    price_confidence:p.price_confidence||existing?.price_confidence||null,
    price_audit_status:p.price_audit_status||existing?.price_audit_status||null,
    price_evidence:p.price_evidence||existing?.price_evidence||null,
    price_audited:p.price_audited===true||existing?.price_audited===true,
    area_m2:p.area_m2??existing?.area_m2??null,
    bedrooms:p.bedrooms??existing?.bedrooms??null,bathrooms:p.bathrooms??existing?.bathrooms??null,parking:p.parking??existing?.parking??null,
    planta_electrica:!!(p.planta_electrica||existing?.planta_electrica),planta_100:!!(p.planta_100||existing?.planta_100),
    pozo:!!(p.pozo||existing?.pozo),tanque:!!(p.tanque||existing?.tanque),amoblado:!!(p.amoblado||existing?.amoblado),
    financiamiento:!!(p.financiamiento||existing?.financiamiento),piscina:!!(p.piscina||existing?.piscina),
    status:existing?.status||'active_unverified',vigency_score:existing?.vigency_score??null,
    probable_captor_id:existing?.probable_captor_id||null,captor_score:existing?.captor_score??null,
    legacy_ids:[...new Set([...(existing?.legacy_ids||[]),...(p.merged_ids||[p.id]).filter(Boolean)])],
    source_types:[...new Set([...(existing?.source_types||[]),'whatsapp'])],
    created_at:existing?.created_at||now,updated_at:now,
    first_seen_at:existing?.first_seen_at||p.first_seen_at||now,last_seen_at:p.last_seen_at||existing?.last_seen_at||now
  };
}
async function allByIndex(store,indexName,key){
  return reqP(store.index(indexName).getAll(key));
}

// Builds/refreshes the parallel multi-source layer from the current WhatsApp DB.
// It never rewrites or deletes legacy `properties` records.
export async function syncRadarCore(rawRecords=[],consolidatedRecords=[]){
  const db=await openDB(),now=new Date().toISOString();
  let mastersCreated=0,mastersUpdated=0,mastersMerged=0,sourcesUpserted=0;

  // Load the parallel layer once, compute changes in memory, then commit in a
  // single IndexedDB transaction. This matters on iPhone with large inventories.
  const existingSources=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).getAll());
  const allMasters=await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).getAll());
  const postMap=new Map(existingSources.map(x=>[x.id,x]));
  const masterMap=new Map(allMasters.map(x=>[x.id,x]));
  const legacyToMasters=new Map();
  for(const src of existingSources){
    if(!src.legacy_property_id||!src.master_id)continue;
    if(!legacyToMasters.has(src.legacy_property_id))legacyToMasters.set(src.legacy_property_id,new Set());
    legacyToMasters.get(src.legacy_property_id).add(src.master_id);
  }
  const rawMap=new Map(rawRecords.map(x=>[x.id,x]));
  const mastersToDelete=new Set();
  const touchedMasters=new Set();

  for(const consolidated of consolidatedRecords){
    const legacyIds=[...new Set((consolidated.merged_ids||[consolidated.id]).filter(Boolean))];
    const linked=[...new Set(legacyIds.flatMap(id=>[...(legacyToMasters.get(id)||[])]))].filter(id=>masterMap.has(id)&&!mastersToDelete.has(id));
    let masterId=linked[0]||`mp_${radarHash(legacyIds.slice().sort().join('|')||consolidated.id||now)}`;
    let existing=masterMap.get(masterId)||null;

    if(linked.length>1){
      const candidates=linked.map(id=>masterMap.get(id)).filter(Boolean).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
      masterId=candidates[0]?.id||masterId;existing=masterMap.get(masterId)||existing;
      for(const duplicateId of linked.filter(id=>id!==masterId)){
        mastersToDelete.add(duplicateId);masterMap.delete(duplicateId);mastersMerged++;
        for(const [postId,post] of postMap){
          if(post.master_id===duplicateId)postMap.set(postId,{...post,master_id:masterId,updated_at:now});
        }
        for(const [legacyId,set] of legacyToMasters){if(set.delete(duplicateId))set.add(masterId);}
      }
    }

    const master=masterSnapshot(consolidated,masterId,existing);
    masterMap.set(masterId,master);touchedMasters.add(masterId);
    if(existing)mastersUpdated++;else mastersCreated++;

    for(const legacyId of legacyIds){
      const p=rawMap.get(legacyId);if(!p)continue;
      for(const src of legacySources(p)){
        const sourceKey=[legacyId,src.group||p.group||'',src.sender||p.sender||'',src.date_iso||src.date||p.date_iso||p.date||'',src.time||p.time||'',src.phone||p.phone||''].join('|');
        const postId=`src_wa_${radarHash(sourceKey)}`,old=postMap.get(postId);
        postMap.set(postId,{
          ...(old||{}),id:postId,master_id:masterId,source_type:'whatsapp',legacy_property_id:legacyId,
          channel_name:src.group||p.group||null,agent_name:src.sender||p.sender||null,agent_phone:src.phone||p.phone||null,
          published_at:sourceDateTime(src,p),detected_at:old?.detected_at||p.first_seen_at||now,last_detected_at:p.last_seen_at||old?.last_detected_at||now,
          external_id:null,external_url:null,external_code:null,original_text:p.text||'',normalized_text:p.normalized||'',
          observed_price:p.price_usd??null,observed_area_m2:p.area_m2??null,observed_residence:p.residence||null,
          municipality_id:p.municipality_id||null,zone_id:p.zone_id||null,complex_id:p.complex_id||null,
          created_at:old?.created_at||now,updated_at:now
        });
        sourcesUpserted++;
        if(!legacyToMasters.has(legacyId))legacyToMasters.set(legacyId,new Set());legacyToMasters.get(legacyId).add(masterId);
      }
    }
  }

  const counts=new Map();for(const post of postMap.values())if(!mastersToDelete.has(post.master_id))counts.set(post.master_id,(counts.get(post.master_id)||0)+1);
  for(const masterId of touchedMasters){const m=masterMap.get(masterId);if(m)masterMap.set(masterId,{...m,source_count:counts.get(masterId)||0,updated_at:now});}

  await new Promise((resolve,reject)=>{
    const tx=db.transaction([MASTER_STORE,SOURCE_POST_STORE],'readwrite'),ms=tx.objectStore(MASTER_STORE),ss=tx.objectStore(SOURCE_POST_STORE);
    for(const id of mastersToDelete)ms.delete(id);
    for(const masterId of touchedMasters){const m=masterMap.get(masterId);if(m)ms.put(m);}
    // Existing historical source posts are not deleted; only current/changed rows
    // are put again. This preserves the future price/publication history.
    for(const post of postMap.values()){
      if(touchedMasters.has(post.master_id)||post.updated_at===now)ss.put(post);
    }
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();return {mastersCreated,mastersUpdated,mastersMerged,sourcesUpserted};
}

export async function getRadarCoreStats(){
  const db=await openDB(),tx=db.transaction([MASTER_STORE,SOURCE_POST_STORE,BUYER_STORE,MATCH_STORE,SYNC_QUEUE_STORE],'readonly');
  const [masters,sources,buyers,matches,queue]=await Promise.all([
    reqP(tx.objectStore(MASTER_STORE).count()),reqP(tx.objectStore(SOURCE_POST_STORE).count()),reqP(tx.objectStore(BUYER_STORE).count()),reqP(tx.objectStore(MATCH_STORE).count()),reqP(tx.objectStore(SYNC_QUEUE_STORE).count())
  ]);db.close();return {masters,sources,buyers,matches,queue};
}

export async function getMasterProperties(){const db=await openDB(),rows=await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).getAll());db.close();return rows;}
export async function getSourcePostsByMaster(masterId){const db=await openDB(),tx=db.transaction(SOURCE_POST_STORE,'readonly'),rows=await allByIndex(tx.objectStore(SOURCE_POST_STORE),'master_id',masterId);db.close();return rows;}




// ---------- Fuentes externas v0.5.2 ------------------------------------------
function externalSourceId(capture={}){
  const key=[capture.source_type||'otro',capture.external_url||'',capture.published_at||'',capture.agent_name||'',capture.original_text||''].join('|');
  return `src_ext_${radarHash(key)}`;
}

function externalMasterSnapshot(parsed={},id,existing=null,capture={}){
  const now=new Date().toISOString();
  const published=capture.published_at||now;
  const shouldRefreshPrice=!existing?.price_usd || (parsed.price_usd&&Date.parse(published)>=Date.parse(existing?.last_seen_at||'1970-01-01'));
  return {
    ...(existing||{}),id,
    operation:parsed.operation||existing?.operation||null,
    property_type:parsed.property_type||existing?.property_type||null,
    municipality_id:parsed.municipality_id||existing?.municipality_id||null,
    municipality:parsed.municipality||existing?.municipality||null,
    zone_id:parsed.zone_id||existing?.zone_id||null,
    zone:parsed.zone||existing?.zone||null,
    complex_id:parsed.complex_id||existing?.complex_id||null,
    residence:parsed.residence||existing?.residence||null,
    price_usd:shouldRefreshPrice?(parsed.price_usd??existing?.price_usd??null):(existing?.price_usd??parsed.price_usd??null),
    price_confidence:parsed.price_confidence||existing?.price_confidence||null,
    price_audit_status:parsed.price_audit_status||existing?.price_audit_status||null,
    price_evidence:parsed.price_evidence||existing?.price_evidence||null,
    price_audited:parsed.price_audited===true||existing?.price_audited===true,
    area_m2:parsed.area_m2??existing?.area_m2??null,
    bedrooms:parsed.bedrooms??existing?.bedrooms??null,
    bathrooms:parsed.bathrooms??existing?.bathrooms??null,
    parking:parsed.parking??existing?.parking??null,
    planta_electrica:!!(parsed.planta_electrica||existing?.planta_electrica),
    planta_100:!!(parsed.planta_100||existing?.planta_100),
    pozo:!!(parsed.pozo||existing?.pozo),
    tanque:!!(parsed.tanque||existing?.tanque),
    amoblado:!!(parsed.amoblado||existing?.amoblado),
    financiamiento:!!(parsed.financiamiento||existing?.financiamiento),
    piscina:!!(parsed.piscina||existing?.piscina),
    status:existing?.status||'active_unverified',
    vigency_score:existing?.vigency_score??null,
    probable_captor_id:existing?.probable_captor_id||null,
    captor_score:existing?.captor_score??null,
    legacy_ids:existing?.legacy_ids||[],
    source_types:[...new Set([...(existing?.source_types||[]),capture.source_type||'otro'])],
    created_at:existing?.created_at||now,
    updated_at:now,
    first_seen_at:existing?.first_seen_at||published,
    last_seen_at:Date.parse(published)>Date.parse(existing?.last_seen_at||'1970-01-01')?published:(existing?.last_seen_at||published)
  };
}

export async function getAllSourcePosts(){
  const db=await openDB(),rows=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).getAll());db.close();return rows;
}
export async function getExternalSourcePosts(){
  const db=await openDB(),rows=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).getAll());db.close();
  return rows.filter(x=>x.source_type!=='whatsapp').sort((a,b)=>String(b.published_at||b.detected_at||'').localeCompare(String(a.published_at||a.detected_at||'')));
}
export async function getExternalSourceStats(){
  const rows=await getExternalSourcePosts();
  return {
    total:rows.length,
    instagram:rows.filter(x=>x.source_type==='instagram').length,
    marketplace:rows.filter(x=>x.source_type==='marketplace').length,
    portals:rows.filter(x=>['mercadolibre','remax','rentahouse','skygroup','portal'].includes(x.source_type)).length
  };
}
export async function externalUrlExists(url=''){
  if(!url)return null;
  const rows=await getExternalSourcePosts();
  return rows.find(x=>String(x.external_url||'').trim()===String(url).trim())||null;
}

export async function upsertExternalCapture({capture,parsed,masterId=null,captor=null}={}){
  if(!capture||!parsed)throw new Error('Faltan datos para guardar la fuente externa.');
  const db=await openDB(),now=new Date().toISOString();
  let id=masterId||null,existing=null;
  if(id)existing=await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).get(id));
  if(!id)id=`mp_ext_${radarHash([parsed.normalized||parsed.text||'',capture.external_url||'',capture.published_at||now].join('|'))}`;
  const master=externalMasterSnapshot(parsed,id,existing,capture);
  if(captor){
    master.probable_captor_name=captor.name||null;
    master.probable_captor_phone=captor.phone||null;
    master.captor_score=captor.score??null;
  }

  const postId=externalSourceId(capture);
  const oldPost=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).get(postId));
  const source={
    ...(oldPost||{}),id:postId,master_id:id,source_type:capture.source_type||'otro',legacy_property_id:null,
    channel_name:capture.channel_name||capture.publisher_name||capture.agent_name||null,
    agent_name:capture.publisher_name||capture.agent_name||null,
    publisher_name:capture.publisher_name||capture.agent_name||null,
    publisher_phone:capture.publisher_phone||capture.agent_phone||parsed.phone||null,
    agent_phone:capture.publisher_phone||capture.agent_phone||parsed.phone||null,
    published_at:capture.published_at||now,detected_at:oldPost?.detected_at||now,last_detected_at:now,
    external_id:capture.external_id||null,external_url:capture.external_url||null,external_code:capture.external_code||null,
    external_title:capture.external_title||null,
    listed_price_raw:capture.listed_price_raw||null,
    listed_price_value:capture.listed_price_value??null,
    listed_price_currency:capture.listed_price_currency||'UNVERIFIED',
    original_text:capture.original_text||parsed.text||'',normalized_text:parsed.normalized||'',
    observed_price:parsed.price_usd??null,observed_area_m2:parsed.area_m2??null,observed_residence:parsed.residence||null,
    observed_bedrooms:parsed.bedrooms??null,observed_bathrooms:parsed.bathrooms??null,observed_parking:parsed.parking??null,
    extraction_evidence:parsed.extraction_evidence||null,extraction_confidence:parsed.extraction_confidence||null,
    municipality_id:parsed.municipality_id||null,zone_id:parsed.zone_id||null,complex_id:parsed.complex_id||null,
    created_at:oldPost?.created_at||now,updated_at:now
  };

  await new Promise((resolve,reject)=>{
    const tx=db.transaction([MASTER_STORE,SOURCE_POST_STORE],'readwrite');
    tx.objectStore(MASTER_STORE).put(master);tx.objectStore(SOURCE_POST_STORE).put(source);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
  return {master,source,linked:!!existing};
}

// ---------- Mis Compradores v0.5.1 -------------------------------------------
export async function getBuyers(){
  const db=await openDB(),rows=await reqP(db.transaction(BUYER_STORE,'readonly').objectStore(BUYER_STORE).getAll());db.close();
  return rows.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
}
export async function getBuyer(id){
  const db=await openDB(),row=await reqP(db.transaction(BUYER_STORE,'readonly').objectStore(BUYER_STORE).get(id));db.close();return row||null;
}
export async function saveBuyer(record={}){
  const now=new Date().toISOString();
  const id=record.id||(`buyer_${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():radarHash(now+Math.random())}`);
  const row={
    ...record,id,
    name:String(record.name||'').trim(),
    phone:String(record.phone||'').trim(),
    status:record.status||'active',
    urgency:record.urgency||'media',
    property_types:[...new Set(record.property_types||[])],
    municipality_ids:[...new Set(record.municipality_ids||[])],
    zone_ids:[...new Set(record.zone_ids||[])],
    required_features:[...new Set(record.required_features||[])],
    desired_features:[...new Set(record.desired_features||[])],
    created_at:record.created_at||now,updated_at:now
  };
  const db=await openDB();
  await new Promise((resolve,reject)=>{const tx=db.transaction(BUYER_STORE,'readwrite');tx.objectStore(BUYER_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  db.close();return row;
}
export async function deleteBuyer(id){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([BUYER_STORE,MATCH_STORE],'readwrite');
    tx.objectStore(BUYER_STORE).delete(id);
    const idx=tx.objectStore(MATCH_STORE).index('buyer_id'),req=idx.openCursor(IDBKeyRange.only(id));
    req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
export async function replaceBuyerMatches(buyerId,rows=[]){
  const db=await openDB(),now=new Date().toISOString();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(MATCH_STORE,'readwrite'),store=tx.objectStore(MATCH_STORE),idx=store.index('buyer_id');
    const req=idx.openCursor(IDBKeyRange.only(buyerId));
    req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  const BATCH=250;
  for(let i=0;i<rows.length;i+=BATCH){
    const batch=rows.slice(i,i+BATCH);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(MATCH_STORE,'readwrite'),store=tx.objectStore(MATCH_STORE);
      for(const row of batch){
        store.put({...row,id:row.id||`match_${radarHash(`${buyerId}|${row.master_id}`)}`,buyer_id:buyerId,created_at:row.created_at||now,updated_at:now});
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  db.close();return rows.length;
}
export async function getMatchesForBuyer(buyerId){
  const db=await openDB(),tx=db.transaction(MATCH_STORE,'readonly'),rows=await allByIndex(tx.objectStore(MATCH_STORE),'buyer_id',buyerId);db.close();
  return rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
}
export async function getAllMatches(){
  const db=await openDB(),rows=await reqP(db.transaction(MATCH_STORE,'readonly').objectStore(MATCH_STORE).getAll());db.close();return rows;
}

// ---------- Radar Backup v0.5.0.2 --------------------------------------------
const BACKUP_STORES=[
  PROP_STORE,IMPORT_STORE,FAV_STORE,CONTACT_STORE,MUNICIPALITY_STORE,ZONE_STORE,
  COMPLEX_STORE,LOCATION_PENDING_STORE,MASTER_STORE,SOURCE_POST_STORE,BUYER_STORE,
  MATCH_STORE,SYNC_QUEUE_STORE
];

export async function exportDatabaseSnapshot(){
  const db=await openDB();
  const stores={};
  const counts={};
  try{
    for(const name of BACKUP_STORES){
      const rows=await reqP(db.transaction(name,'readonly').objectStore(name).getAll());
      stores[name]=rows;
      counts[name]=rows.length;
    }
  }finally{db.close();}
  return {
    format:'radar-inmobiliario-backup',
    backup_version:1,
    app_version:'0.5.2.2',
    db_name:DB_NAME,
    db_version:DB_VERSION,
    created_at:new Date().toISOString(),
    origin:typeof location!=='undefined'?location.origin:null,
    counts,
    stores
  };
}

function validateBackupSnapshot(snapshot){
  if(!snapshot||snapshot.format!=='radar-inmobiliario-backup'||Number(snapshot.backup_version)!==1) throw new Error('Este archivo no es un respaldo válido de Radar Inmobiliario.');
  if(!snapshot.stores||typeof snapshot.stores!=='object') throw new Error('El respaldo no contiene las tablas esperadas.');
  for(const name of BACKUP_STORES){if(snapshot.stores[name]!=null&&!Array.isArray(snapshot.stores[name])) throw new Error(`La tabla ${name} del respaldo está dañada.`);}
  return true;
}

async function replaceStoreRows(db,name,rows=[]){
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(name,'readwrite');
    tx.objectStore(name).clear();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  const BATCH=250;
  for(let start=0;start<rows.length;start+=BATCH){
    const batch=rows.slice(start,start+BATCH);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(name,'readwrite'),store=tx.objectStore(name);
      for(const row of batch) store.put(row);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    await new Promise(r=>setTimeout(r,0));
  }
}

export async function restoreDatabaseSnapshot(snapshot,onProgress){
  validateBackupSnapshot(snapshot);
  const db=await openDB();
  try{
    for(let i=0;i<BACKUP_STORES.length;i++){
      const name=BACKUP_STORES[i],rows=snapshot.stores[name]||[];
      onProgress?.({store:name,index:i+1,total:BACKUP_STORES.length,rows:rows.length});
      await replaceStoreRows(db,name,rows);
    }
  }finally{db.close();}
  return {restored_at:new Date().toISOString(),counts:snapshot.counts||{}};
}

export function backupSnapshotSummary(snapshot){
  validateBackupSnapshot(snapshot);
  const c=snapshot.counts||{};
  return {
    properties:Number(c[PROP_STORE]||snapshot.stores?.[PROP_STORE]?.length||0),
    masters:Number(c[MASTER_STORE]||snapshot.stores?.[MASTER_STORE]?.length||0),
    sources:Number(c[SOURCE_POST_STORE]||snapshot.stores?.[SOURCE_POST_STORE]?.length||0),
    contacts:Number(c[CONTACT_STORE]||snapshot.stores?.[CONTACT_STORE]?.length||0),
    buyers:Number(c[BUYER_STORE]||snapshot.stores?.[BUYER_STORE]?.length||0),
    matches:Number(c[MATCH_STORE]||snapshot.stores?.[MATCH_STORE]?.length||0),
    created_at:snapshot.created_at||null
  };
}

export async function clearDatabase() {
  const db = await openDB();
  const stores = [PROP_STORE, IMPORT_STORE, FAV_STORE, CONTACT_STORE, MUNICIPALITY_STORE, ZONE_STORE, COMPLEX_STORE, LOCATION_PENDING_STORE, MASTER_STORE, SOURCE_POST_STORE, BUYER_STORE, MATCH_STORE, SYNC_QUEUE_STORE];
  await Promise.all(stores.map(name => new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.objectStore(name).clear();
  })));
  db.close();
}
