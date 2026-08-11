import { isDemandRequest } from './intent-utils.js?v=0412';
import { extractLocationTerms, bestZone } from './location-utils.js?v=0412';
import { detectDateOrderFromDates, parseFlexibleDate, toISODate } from './date-utils.js?v=0412';
import { cleanPhone, personAliasKeys } from './contact-utils.js?v=0412';
import { SEED_MUNICIPALITIES, SEED_ZONES, SEED_COMPLEXES, normLocation, slugLocation, resolveLocationRecord } from './location-catalog.js?v=0412';

const DB_NAME = 'grupos-inmobiliarios';
const DB_VERSION = 5;
const PROP_STORE = 'properties';
const IMPORT_STORE = 'imports';
const FAV_STORE = 'favorites';
const CONTACT_STORE = 'contacts';
const MUNICIPALITY_STORE='municipalities';
const ZONE_STORE='zones';
const COMPLEX_STORE='complexes';
const LOCATION_PENDING_STORE='location_pending';

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
export async function clearDatabase() {
  const db = await openDB();
  const stores = [PROP_STORE, IMPORT_STORE, FAV_STORE, CONTACT_STORE, MUNICIPALITY_STORE, ZONE_STORE, COMPLEX_STORE, LOCATION_PENDING_STORE];
  await Promise.all(stores.map(name => new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.objectStore(name).clear();
  })));
  db.close();
}
