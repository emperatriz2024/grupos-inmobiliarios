import { isDemandRequest } from './intent-utils.js?v=0530';
import { extractLocationTerms, bestZone } from './location-utils.js?v=0530';
import { detectDateOrderFromDates, parseFlexibleDate, toISODate } from './date-utils.js?v=0530';
import { cleanPhone, personAliasKeys } from './contact-utils.js?v=0530';
import { SEED_MUNICIPALITIES, SEED_ZONES, SEED_COMPLEXES, normLocation, slugLocation, resolveLocationRecord } from './location-catalog.js?v=0530';
import { APP_VERSION, BACKUP_SCHEMA_VERSION } from './version.js';
import {legacyBuyerToClientDemand,consolidateMarketDemands,isDemandActive,matchPrefilteredCandidates,OpportunityEngine} from './core/radar/demand-engine.js';
import {reconcileReadiness} from './core/radar/readiness-engine.js';

const DB_NAME = 'grupos-inmobiliarios';
const DB_VERSION = 11;
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
const SOURCE_ATTACHMENT_STORE='source_attachments';
const MEDIA_ASSET_STORE='media_assets';
const PROPERTY_MEDIA_STORE='property_media';
const IDENTITY_LINK_STORE='property_identity_links';
const PROPERTY_REDIRECT_STORE='property_redirects';
const OWN_LISTING_STORE='own_listing_details';
const REVIEW_QUEUE_STORE='review_queue';
const CLIENT_STORE='clients';
const DEMAND_STORE='demands';
const MATCH_RUN_STORE='match_runs';
const MATCH_CANDIDATE_STORE='match_candidates';
const OPPORTUNITY_STORE='opportunities';
const OPPORTUNITY_SCORE_STORE='opportunity_scores';
const OPPORTUNITY_EVENT_STORE='opportunity_events';
const DEMAND_SOURCE_STORE='demand_sources';
const READINESS_STORE='readiness_assessments';
const ENRICHMENT_TASK_STORE='enrichment_tasks';
const PROPERTY_PACKAGE_STORE='property_packages';
const PACKAGE_MEDIA_STORE='package_media';


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
      if(!db.objectStoreNames.contains(SOURCE_ATTACHMENT_STORE)){
        const s=db.createObjectStore(SOURCE_ATTACHMENT_STORE,{keyPath:'id'});s.createIndex('source_message_id','source_message_id',{unique:false});s.createIndex('sha256','sha256',{unique:false});
      }
      if(!db.objectStoreNames.contains(MEDIA_ASSET_STORE)){
        const s=db.createObjectStore(MEDIA_ASSET_STORE,{keyPath:'id'});s.createIndex('workspace_sha256',['workspace_id','sha256'],{unique:true});s.createIndex('phash','phash',{unique:false});
      }
      if(!db.objectStoreNames.contains(PROPERTY_MEDIA_STORE)){
        const s=db.createObjectStore(PROPERTY_MEDIA_STORE,{keyPath:'id'});s.createIndex('property_id','property_id',{unique:false});s.createIndex('media_asset_id','media_asset_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(IDENTITY_LINK_STORE)){
        const s=db.createObjectStore(IDENTITY_LINK_STORE,{keyPath:'id'});s.createIndex('property_a_id','property_a_id',{unique:false});s.createIndex('property_b_id','property_b_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(PROPERTY_REDIRECT_STORE)) db.createObjectStore(PROPERTY_REDIRECT_STORE,{keyPath:'old_property_id'});
      if(!db.objectStoreNames.contains(OWN_LISTING_STORE)){
        const s=db.createObjectStore(OWN_LISTING_STORE,{keyPath:'property_id'});s.createIndex('workspace_id','workspace_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(REVIEW_QUEUE_STORE)){
        const s=db.createObjectStore(REVIEW_QUEUE_STORE,{keyPath:'id'});s.createIndex('status','status',{unique:false});s.createIndex('review_type','review_type',{unique:false});
      }
      if(!db.objectStoreNames.contains(CLIENT_STORE)){
        const s=db.createObjectStore(CLIENT_STORE,{keyPath:'id'});s.createIndex('legacy_buyer_id','legacy_buyer_id',{unique:true});s.createIndex('status','status',{unique:false});
      }
      if(!db.objectStoreNames.contains(DEMAND_STORE)){
        const s=db.createObjectStore(DEMAND_STORE,{keyPath:'id'});s.createIndex('client_id','client_id',{unique:false});s.createIndex('origin','origin',{unique:false});s.createIndex('status','status',{unique:false});s.createIndex('source_fingerprint','source_fingerprint',{unique:true});
      }
      if(!db.objectStoreNames.contains(MATCH_RUN_STORE)){
        const s=db.createObjectStore(MATCH_RUN_STORE,{keyPath:'id'});s.createIndex('started_at','started_at',{unique:false});
      }
      if(!db.objectStoreNames.contains(MATCH_CANDIDATE_STORE)){
        const s=db.createObjectStore(MATCH_CANDIDATE_STORE,{keyPath:'id'});s.createIndex('match_run_id','match_run_id',{unique:false});s.createIndex('demand_id','demand_id',{unique:false});s.createIndex('property_id','property_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(OPPORTUNITY_STORE)){
        const s=db.createObjectStore(OPPORTUNITY_STORE,{keyPath:'id'});s.createIndex('demand_id','demand_id',{unique:false});s.createIndex('property_id','property_id',{unique:false});s.createIndex('status','status',{unique:false});s.createIndex('opportunity_type','opportunity_type',{unique:false});
      }
      if(!db.objectStoreNames.contains(OPPORTUNITY_SCORE_STORE)){
        const s=db.createObjectStore(OPPORTUNITY_SCORE_STORE,{keyPath:'id'});s.createIndex('opportunity_id','opportunity_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(OPPORTUNITY_EVENT_STORE)){
        const s=db.createObjectStore(OPPORTUNITY_EVENT_STORE,{keyPath:'id'});s.createIndex('opportunity_id','opportunity_id',{unique:false});s.createIndex('event_type','event_type',{unique:false});
      }
      if(!db.objectStoreNames.contains(DEMAND_SOURCE_STORE)){
        const s=db.createObjectStore(DEMAND_SOURCE_STORE,{keyPath:'id'});s.createIndex('demand_id','demand_id',{unique:false});s.createIndex('source_reference','source_reference',{unique:false});s.createIndex('observed_at','observed_at',{unique:false});
      }
      if(!db.objectStoreNames.contains(READINESS_STORE)){
        const s=db.createObjectStore(READINESS_STORE,{keyPath:'id'});s.createIndex('opportunity_id','opportunity_id',{unique:false});s.createIndex('property_id','property_id',{unique:false});s.createIndex('status','status',{unique:false});s.createIndex('current_key','current_key',{unique:true});
      }
      if(!db.objectStoreNames.contains(ENRICHMENT_TASK_STORE)){
        const s=db.createObjectStore(ENRICHMENT_TASK_STORE,{keyPath:'id'});s.createIndex('opportunity_id','opportunity_id',{unique:false});s.createIndex('property_id','property_id',{unique:false});s.createIndex('status','status',{unique:false});
      }
      if(!db.objectStoreNames.contains(PROPERTY_PACKAGE_STORE)){
        const s=db.createObjectStore(PROPERTY_PACKAGE_STORE,{keyPath:'id'});s.createIndex('opportunity_id','opportunity_id',{unique:true});s.createIndex('property_id','property_id',{unique:false});
      }
      if(!db.objectStoreNames.contains(PACKAGE_MEDIA_STORE)){
        const s=db.createObjectStore(PACKAGE_MEDIA_STORE,{keyPath:'id'});s.createIndex('package_id','package_id',{unique:false});s.createIndex('media_asset_id','media_asset_id',{unique:false});s.createIndex('status','status',{unique:false});
      }
      if(req.oldVersion>0&&req.oldVersion<11){
        const readiness=req.transaction.objectStore(READINESS_STORE);if(readiness.indexNames.contains('opportunity_id'))readiness.deleteIndex('opportunity_id');readiness.createIndex('opportunity_id','opportunity_id',{unique:false});if(!readiness.indexNames.contains('current_key'))readiness.createIndex('current_key','current_key',{unique:true});
        const packageMedia=req.transaction.objectStore(PACKAGE_MEDIA_STORE);if(!packageMedia.indexNames.contains('status'))packageMedia.createIndex('status','status',{unique:false});
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
            price_audit_version:rec.price_audit_version||'0600',
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

export async function findImportByFileHash(fileHash) {
  if(!fileHash)return null;
  const db=await openDB(),tx=db.transaction(IMPORT_STORE,'readonly'),store=tx.objectStore(IMPORT_STORE);
  const found=await new Promise((resolve,reject)=>{const req=store.openCursor(null,'prev');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const cursor=req.result;if(!cursor)return resolve(null);if(cursor.value?.file_hash===fileHash)return resolve(cursor.value);cursor.continue();};});
  db.close();return found;
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
export function masterSnapshot(p={},id,existing=null){
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
    study:p.study??existing?.study??false,study_as_bedroom:p.study_as_bedroom??existing?.study_as_bedroom??false,
    service_bedroom:p.service_bedroom??existing?.service_bedroom??false,
    planta_electrica:!!(p.planta_electrica||existing?.planta_electrica),planta_100:!!(p.planta_100||existing?.planta_100),
    pozo:!!(p.pozo||existing?.pozo),tanque:!!(p.tanque||existing?.tanque),amoblado:!!(p.amoblado||existing?.amoblado),
    financiamiento:!!(p.financiamiento||existing?.financiamiento),piscina:!!(p.piscina||existing?.piscina),
    status:existing?.status||'active_unverified',vigency_score:existing?.vigency_score??null,
    probable_captor_id:existing?.probable_captor_id||null,captor_score:existing?.captor_score??null,
    legacy_ids:[...new Set([...(existing?.legacy_ids||[]),...(p.merged_ids||[p.id]).filter(Boolean)])],
    source_types:[...new Set([...(existing?.source_types||[]),'whatsapp'])],
    ownership_scope:p.ownership_scope||existing?.ownership_scope||'UNKNOWN',ownership_provenance:existing?.ownership_provenance||null,
    created_at:existing?.created_at||now,updated_at:now,
    first_seen_at:existing?.first_seen_at||p.first_seen_at||now,last_seen_at:p.last_seen_at||existing?.last_seen_at||now
  };
}
export function inferReliablePropertyType(primaryType,evidenceRows=[]){
  if(String(primaryType||'').trim())return primaryType;
  const groups=new Map();
  for(const row of evidenceRows){const value=row?.property_type||row?.observed_property_type;if(!String(value||'').trim())continue;const key=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(value);}
  return groups.size===1?[...groups.values()][0][0]:null;
}
export function planLegacyMasterArchive(canonical,duplicate,posts=[],now=new Date().toISOString()){
  if(!canonical?.id||!duplicate?.id||canonical.id===duplicate.id)throw new Error('invalid_master_merge_plan');
  return {
    canonical:{...canonical,legacy_ids:[...new Set([...(canonical.legacy_ids||[]),...(duplicate.legacy_ids||[])])],updated_at:now},
    archived:{...duplicate,status:'ARCHIVED',redirected_to:canonical.id,updated_at:now},
    redirect:{old_property_id:duplicate.id,canonical_property_id:canonical.id,merged_at:now,reason:'legacy_core_consolidation',decision_reference:null},
    sources:posts.map(post=>post.master_id===duplicate.id?{...post,master_id:canonical.id,updated_at:now}:post)
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
  const mastersToArchive=new Set(),redirectsToUpsert=new Map();
  const touchedMasters=new Set();

  for(const consolidated of consolidatedRecords){
    const legacyIds=[...new Set((consolidated.merged_ids||[consolidated.id]).filter(Boolean))];
    const linked=[...new Set(legacyIds.flatMap(id=>[...(legacyToMasters.get(id)||[])]))].filter(id=>masterMap.has(id)&&!mastersToArchive.has(id));
    let masterId=linked[0]||`mp_${radarHash(legacyIds.slice().sort().join('|')||consolidated.id||now)}`;
    let existing=masterMap.get(masterId)||null;

    const mergedLegacyIds=[];
    if(linked.length>1){
      const candidates=linked.map(id=>masterMap.get(id)).filter(Boolean).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
      masterId=candidates[0]?.id||masterId;existing=masterMap.get(masterId)||existing;
      for(const duplicateId of linked.filter(id=>id!==masterId)){
        const duplicate=masterMap.get(duplicateId),plan=planLegacyMasterArchive(existing,duplicate,[...postMap.values()],now);mastersToArchive.add(duplicateId);mastersMerged++;mergedLegacyIds.push(...(duplicate?.legacy_ids||[]));existing=plan.canonical;masterMap.set(masterId,existing);masterMap.set(duplicateId,plan.archived);touchedMasters.add(duplicateId);redirectsToUpsert.set(duplicateId,plan.redirect);for(const post of plan.sources)postMap.set(post.id,post);
        for(const [legacyId,set] of legacyToMasters){if(set.delete(duplicateId))set.add(masterId);}
      }
    }

    const typeEvidence=[...legacyIds.map(id=>rawMap.get(id)).filter(Boolean),...[...postMap.values()].filter(post=>post.master_id===masterId)];
    const propertyType=inferReliablePropertyType(consolidated.property_type,typeEvidence);
    const master=masterSnapshot({...consolidated,property_type:propertyType,merged_ids:[...legacyIds,...mergedLegacyIds]},masterId,existing);
    masterMap.set(masterId,master);touchedMasters.add(masterId);
    if(existing)mastersUpdated++;else mastersCreated++;

    for(const legacyId of legacyIds){
      const p=rawMap.get(legacyId);if(!p)continue;
      for(const src of legacySources(p)){
        const sourceKey=[legacyId,src.group||p.group||'',src.sender||p.sender||'',src.date_iso||src.date||p.date_iso||p.date||'',src.time||p.time||'',src.phone||p.phone||''].join('|');
        const postId=`src_wa_${radarHash(sourceKey)}`,old=postMap.get(postId);
        postMap.set(postId,{
          ...(old||{}),id:postId,master_id:masterId,source_type:'whatsapp',legacy_property_id:legacyId,
          sourceType:p.sourceType||'whatsapp_zip',sourceChannel:p.sourceChannel||'primary_number',sourceId:p.sourceId||postId,
          importedAt:p.importedAt||old?.importedAt||now,publishedAt:sourceDateTime(src,p),
          channel_name:src.group||p.group||null,agent_name:src.sender||p.sender||null,agent_phone:src.phone||p.phone||null,
          published_at:sourceDateTime(src,p),detected_at:old?.detected_at||p.first_seen_at||now,last_detected_at:p.last_seen_at||old?.last_detected_at||now,
          external_id:null,external_url:null,external_code:null,original_text:p.text||'',normalized_text:p.normalized||'',
          observed_price:p.price_usd??null,observed_area_m2:p.area_m2??null,observed_residence:p.residence||null,observed_property_type:p.property_type||null,
          municipality_id:p.municipality_id||null,zone_id:p.zone_id||null,complex_id:p.complex_id||null,
          created_at:old?.created_at||now,updated_at:now
        });
        sourcesUpserted++;
        if(!legacyToMasters.has(legacyId))legacyToMasters.set(legacyId,new Set());legacyToMasters.get(legacyId).add(masterId);
      }
    }
  }

  const counts=new Map();for(const post of postMap.values())counts.set(post.master_id,(counts.get(post.master_id)||0)+1);
  for(const masterId of touchedMasters){const m=masterMap.get(masterId);if(m)masterMap.set(masterId,{...m,source_count:counts.get(masterId)||0,updated_at:now});}

  await new Promise((resolve,reject)=>{
    const tx=db.transaction([MASTER_STORE,SOURCE_POST_STORE,PROPERTY_REDIRECT_STORE],'readwrite'),ms=tx.objectStore(MASTER_STORE),ss=tx.objectStore(SOURCE_POST_STORE),rs=tx.objectStore(PROPERTY_REDIRECT_STORE);
    for(const masterId of touchedMasters){const m=masterMap.get(masterId);if(m)ms.put(m);}
    // Existing historical source posts are not deleted; only current/changed rows
    // are put again. This preserves the future price/publication history.
    for(const post of postMap.values()){
      if(touchedMasters.has(post.master_id)||post.updated_at===now)ss.put(post);
    }
    for(const redirect of redirectsToUpsert.values())rs.put(redirect);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();return {mastersCreated,mastersUpdated,mastersMerged,sourcesUpserted,touchedMasterIds:[...touchedMasters]};
}

export async function getRadarCoreStats(){
  const db=await openDB(),tx=db.transaction([MASTER_STORE,SOURCE_POST_STORE,BUYER_STORE,MATCH_STORE,SYNC_QUEUE_STORE],'readonly');
  const [masterRows,sources,buyers,matches,queue]=await Promise.all([
    reqP(tx.objectStore(MASTER_STORE).getAll()),reqP(tx.objectStore(SOURCE_POST_STORE).count()),reqP(tx.objectStore(BUYER_STORE).count()),reqP(tx.objectStore(MATCH_STORE).count()),reqP(tx.objectStore(SYNC_QUEUE_STORE).count())
  ]);db.close();return {masters:masterRows.filter(row=>row.status!=='ARCHIVED'&&!row.redirected_to).length,sources,buyers,matches,queue};
}

export async function getMasterProperties({includeArchived=false}={}){const db=await openDB(),rows=await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).getAll());db.close();return includeArchived?rows:rows.filter(row=>row.status!=='ARCHIVED'&&!row.redirected_to);}
export async function getSourcePostsByMaster(masterId){const db=await openDB(),tx=db.transaction(SOURCE_POST_STORE,'readonly'),rows=await allByIndex(tx.objectStore(SOURCE_POST_STORE),'master_id',masterId);db.close();return rows;}

export async function setMasterOwnership(propertyId,ownershipScope){
  if(!['OWN','MARKET','UNKNOWN'].includes(ownershipScope))throw new Error('Ámbito de propiedad inválido.');
  const db=await openDB(),tx=db.transaction([MASTER_STORE,SYNC_QUEUE_STORE],'readwrite'),store=tx.objectStore(MASTER_STORE),row=await reqP(store.get(propertyId));
  if(!row){db.close();throw new Error('Inmueble maestro no encontrado.');}
  const changedAt=new Date().toISOString();store.put({...row,ownership_scope:ownershipScope,ownership_provenance:'USER_CONFIRMED',updated_at:changedAt});tx.objectStore(SYNC_QUEUE_STORE).add({status:'pending',entity_type:'master_property',entity_id:propertyId,operation:'PROPERTY_OWNERSHIP_CHANGED',payload_json:{previous:row.ownership_scope||'UNKNOWN',scope:ownershipScope,provenance:'USER_CONFIRMED'},created_at:changedAt});
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return ownershipScope;
}
export async function getOwnListingDetails(propertyId){const db=await openDB(),row=await reqP(db.transaction(OWN_LISTING_STORE,'readonly').objectStore(OWN_LISTING_STORE).get(propertyId));db.close();return row||null;}
export async function saveOwnListingDetails(record={}){
  if(!record.property_id)throw new Error('property_id requerido.');const db=await openDB(),now=new Date().toISOString(),tx=db.transaction(OWN_LISTING_STORE,'readwrite'),store=tx.objectStore(OWN_LISTING_STORE),old=await reqP(store.get(record.property_id));
  const row={...old,...record,workspace_id:record.workspace_id||old?.workspace_id||'local',agreement_type:record.agreement_type||old?.agreement_type||'UNKNOWN',currency:record.currency||old?.currency||'USD',documents_status:record.documents_status||old?.documents_status||'UNKNOWN',media_authorization_status:record.media_authorization_status||old?.media_authorization_status||'UNKNOWN',created_at:old?.created_at||now,updated_at:now};store.put(row);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return row;
}
export async function recordSourceAttachments(records=[]){if(!records.length)return 0;for(const row of records){const resolved=row.provenance_status==='RESOLVED';if(resolved&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(row.source_message_id||'')))throw new Error('source_message_id interno inválido.');if(!resolved&&(row.source_message_id!=null||!row.external_message_id))throw new Error('Attachment pendiente requiere external_message_id y source_message_id nulo.');}const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(SOURCE_ATTACHMENT_STORE,'readwrite'),store=tx.objectStore(SOURCE_ATTACHMENT_STORE);records.forEach(row=>store.put(row));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return records.length;}




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
    study:parsed.study??existing?.study??false,study_as_bedroom:parsed.study_as_bedroom??existing?.study_as_bedroom??false,
    service_bedroom:parsed.service_bedroom??existing?.service_bedroom??false,
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
    sourceType:capture.source_type||'external_web',sourceChannel:capture.source_channel||capture.source_type||'external_web',sourceId:capture.source_id||postId,
    importedAt:oldPost?.importedAt||now,publishedAt:capture.published_at||now,
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
    availability_status:oldPost?.availability_status||'unverified',
    last_verified_at:oldPost?.last_verified_at||null,
    verified_until:oldPost?.verified_until||null,
    availability_note:oldPost?.availability_note||null,
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


function _daysSinceDb(raw){
  const t=raw?Date.parse(raw):NaN;
  return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):9999;
}
function _sourceLiveForMaster(s={}){
  if(s.source_type==='whatsapp')return _daysSinceDb(s.published_at||s.detected_at)<=60;
  if(['unavailable','sold'].includes(s.availability_status))return false;
  if(s.availability_status==='verified'&&s.last_verified_at&&_daysSinceDb(s.last_verified_at)<=7)return true;
  return _daysSinceDb(s.published_at||s.detected_at)<=20;
}
export async function updateExternalSourceVerification(sourceId,status='verified',note=''){
  const db=await openDB();
  const source=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).get(sourceId));
  if(!source){db.close();throw new Error('No se encontró la publicación externa.');}
  const now=new Date().toISOString();
  const updated={...source,availability_status:status,availability_note:note||null,updated_at:now};
  if(status==='verified'){
    updated.last_verified_at=now;
    updated.verified_until=new Date(Date.now()+7*86400000).toISOString();
    updated.last_detected_at=now;
  }else if(['unavailable','sold'].includes(status)){
    updated.last_verified_at=now;
    updated.verified_until=null;
  }else{
    updated.verified_until=null;
  }

  const all=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).getAll());
  const masterId=updated.master_id;
  const master=masterId?await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).get(masterId)):null;
  const related=all.filter(x=>x.master_id===masterId&&x.id!==sourceId).concat(updated);
  const live=related.filter(_sourceLiveForMaster);
  const hasVerified=live.some(x=>x.source_type!=='whatsapp'&&x.availability_status==='verified'&&x.last_verified_at&&_daysSinceDb(x.last_verified_at)<=7);
  const nextMaster=master?{
    ...master,
    status:live.length?(hasVerified?'active_verified':'active_unverified'):'stale',
    vigency_score:live.length?(hasVerified?100:70):0,
    last_verified_at:hasVerified?now:(master.last_verified_at||null),
    updated_at:now
  }:null;

  await new Promise((resolve,reject)=>{
    const stores=nextMaster?[SOURCE_POST_STORE,MASTER_STORE]:[SOURCE_POST_STORE];
    const tx=db.transaction(stores,'readwrite');
    tx.objectStore(SOURCE_POST_STORE).put(updated);
    if(nextMaster)tx.objectStore(MASTER_STORE).put(nextMaster);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
  return {source:updated,master:nextMaster};
}
export async function refreshExternalMasterVigency(){
  const db=await openDB();
  const sources=await reqP(db.transaction(SOURCE_POST_STORE,'readonly').objectStore(SOURCE_POST_STORE).getAll());
  const masters=await reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).getAll());
  const byMaster=new Map();
  for(const source of sources){if(!source.master_id)continue;const rows=byMaster.get(source.master_id)||[];rows.push(source);byMaster.set(source.master_id,rows);}
  const changed=[];
  for(const master of masters){
    const related=byMaster.get(master.id)||[];
    if(!related.some(x=>x.source_type!=='whatsapp'))continue;
    const live=related.filter(_sourceLiveForMaster);
    const hasVerified=live.some(x=>x.source_type!=='whatsapp'&&x.availability_status==='verified'&&x.last_verified_at&&_daysSinceDb(x.last_verified_at)<=7);
    const status=live.length?(hasVerified?'active_verified':'active_unverified'):'stale';
    const vigency_score=live.length?(hasVerified?100:70):0;
    if(master.status!==status||master.vigency_score!==vigency_score){
      changed.push({...master,status,vigency_score,updated_at:new Date().toISOString()});
    }
  }
  if(changed.length){
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(MASTER_STORE,'readwrite'),s=tx.objectStore(MASTER_STORE);
      changed.forEach(x=>s.put(x));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  db.close();return changed.length;
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

// ---------- Demand → Match → Opportunity (Phase 0C) -------------------------
export async function saveDemandRecords(records=[]){
  if(!records.length)return 0;const db=await openDB(),now=new Date().toISOString(),existingDemands=await reqP(db.transaction(DEMAND_STORE,'readonly').objectStore(DEMAND_STORE).getAll()),existingSources=await reqP(db.transaction(DEMAND_SOURCE_STORE,'readonly').objectStore(DEMAND_SOURCE_STORE).getAll()),consolidated=consolidateMarketDemands(records,existingDemands,existingSources);
  await new Promise((resolve,reject)=>{const tx=db.transaction([DEMAND_STORE,DEMAND_SOURCE_STORE],'readwrite'),store=tx.objectStore(DEMAND_STORE),sources=tx.objectStore(DEMAND_SOURCE_STORE);for(const record of consolidated.demands)store.put({...record,origin:record.origin||'MANUAL',status:record.status||'ACTIVE',created_at:record.created_at||now,updated_at:record.updated_at||now});for(const source of consolidated.sources)sources.put(source);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  db.close();return records.length;
}
export async function getClients(){const db=await openDB(),rows=await reqP(db.transaction(CLIENT_STORE,'readonly').objectStore(CLIENT_STORE).getAll());db.close();return rows;}
export async function getDemands({origin=null,status=null}={}){const db=await openDB(),rows=await reqP(db.transaction(DEMAND_STORE,'readonly').objectStore(DEMAND_STORE).getAll());db.close();return rows.filter(row=>(!origin||row.origin===origin)&&(!status||row.status===status));}
export async function getOpportunities({includeInvalidated=true}={}){const db=await openDB(),rows=await reqP(db.transaction(OPPORTUNITY_STORE,'readonly').objectStore(OPPORTUNITY_STORE).getAll());db.close();return includeInvalidated?rows:rows.filter(row=>row.status==='ACTIVE');}
export async function getOpportunityScores(){const db=await openDB(),rows=await reqP(db.transaction(OPPORTUNITY_SCORE_STORE,'readonly').objectStore(OPPORTUNITY_SCORE_STORE).getAll());db.close();return rows;}
export async function getOpportunityEvents(){const db=await openDB(),rows=await reqP(db.transaction(OPPORTUNITY_EVENT_STORE,'readonly').objectStore(OPPORTUNITY_EVENT_STORE).getAll());db.close();return rows;}
export async function getDemandSources(demandId=null){const db=await openDB(),rows=await reqP(db.transaction(DEMAND_SOURCE_STORE,'readonly').objectStore(DEMAND_SOURCE_STORE).getAll());db.close();return demandId?rows.filter(row=>row.demand_id===demandId):rows;}

export async function mirrorLegacyBuyersToDemands(){
  const db=await openDB(),buyers=await reqP(db.transaction(BUYER_STORE,'readonly').objectStore(BUYER_STORE).getAll()),now=new Date().toISOString();
  await new Promise((resolve,reject)=>{const tx=db.transaction([CLIENT_STORE,DEMAND_STORE],'readwrite'),clients=tx.objectStore(CLIENT_STORE),demands=tx.objectStore(DEMAND_STORE);for(const buyer of buyers){const pair=legacyBuyerToClientDemand(buyer);clients.put(pair.client);demands.put(pair.demand);}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  db.close();return {buyers:buyers.length,clients:buyers.length,demands:buyers.length,mirrored_at:now};
}

export async function runDemandOpportunityMatching({trigger_type='FULL_RECALC',trigger_entity_id=null,territoryOntology=null,now=Date.now()}={}){
  const db=await openDB(),startedAt=new Date().toISOString(),runId=`match_run_${radarHash(`${startedAt}|${trigger_type}|${trigger_entity_id||''}`)}`;
  const [demands,properties,opportunities,scores,events]=await Promise.all([
    reqP(db.transaction(DEMAND_STORE,'readonly').objectStore(DEMAND_STORE).getAll()),reqP(db.transaction(MASTER_STORE,'readonly').objectStore(MASTER_STORE).getAll()),
    reqP(db.transaction(OPPORTUNITY_STORE,'readonly').objectStore(OPPORTUNITY_STORE).getAll()),reqP(db.transaction(OPPORTUNITY_SCORE_STORE,'readonly').objectStore(OPPORTUNITY_SCORE_STORE).getAll()),reqP(db.transaction(OPPORTUNITY_EVENT_STORE,'readonly').objectStore(OPPORTUNITY_EVENT_STORE).getAll())
  ]);
  const expired=demands.filter(row=>row.origin==='MARKET'&&row.status==='ACTIVE'&&!isDemandActive(row,now)).map(row=>({...row,status:'EXPIRED',updated_at:new Date(now).toISOString()})),active=demands.map(row=>expired.find(x=>x.id===row.id)||row).filter(row=>row.status==='ACTIVE');
  const entityIds=Array.isArray(trigger_entity_id)?trigger_entity_id.filter(Boolean):trigger_entity_id?[trigger_entity_id]:[],demandTrigger=/DEMAND|CLIENT/.test(trigger_type),propertyTrigger=/INVENTORY|PROPERTY|OWNERSHIP|PRICE/.test(trigger_type);let scope=trigger_type==='FULL_RECALC'?{full:true}:demandTrigger?{full:false,demandIds:entityIds}:propertyTrigger?{full:false,propertyIds:entityIds}:{full:false};
  if(!scope.full&&expired.length)scope={...scope,demandIds:[...new Set([...(scope.demandIds||[]),...expired.map(row=>row.id)])]};
  const matched=matchPrefilteredCandidates(active,properties,{territoryOntology,now,demandIds:scope.demandIds,propertyIds:scope.propertyIds}),candidates=matched.candidates;
  const engine=new OpportunityEngine({opportunities,scores,events}),state=engine.reconcile(candidates,active,scope),completedAt=new Date().toISOString();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([DEMAND_STORE,MATCH_RUN_STORE,MATCH_CANDIDATE_STORE,OPPORTUNITY_STORE,OPPORTUNITY_SCORE_STORE,OPPORTUNITY_EVENT_STORE],'readwrite');
    for(const row of expired)tx.objectStore(DEMAND_STORE).put(row);
    tx.objectStore(MATCH_RUN_STORE).put({id:runId,workspace_id:'local',trigger_type,trigger_entity_id,started_at:startedAt,completed_at:completedAt,status:'COMPLETED',metadata_json:{...matched.stats,demands:active.length,properties:properties.length,candidates:candidates.length,scope}});
    const candidateStore=tx.objectStore(MATCH_CANDIDATE_STORE);for(const row of candidates)candidateStore.put({...row,id:`${runId}_${row.id}`,match_run_id:runId,created_at:completedAt});
    const opportunityStore=tx.objectStore(OPPORTUNITY_STORE);for(const row of state.opportunities)opportunityStore.put(row);
    const scoreStore=tx.objectStore(OPPORTUNITY_SCORE_STORE);for(const row of state.scores)scoreStore.put(row);
    const eventStore=tx.objectStore(OPPORTUNITY_EVENT_STORE);state.events.forEach((row,index)=>eventStore.put({...row,id:row.id||`op_event_${radarHash(`${row.opportunity_id}|${row.event_type}|${row.occurred_at}|${index}`)}`}));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
  const readinessScope=scope.full?{full:true}:scope.propertyIds?.length?{propertyIds:scope.propertyIds}:{opportunityIds:state.opportunities.filter(row=>scope.demandIds?.includes(row.demand_id)).map(row=>row.id)};
  const readiness=await runOpportunityReadiness({...readinessScope,now});
  return {run_id:runId,demands:active.length,properties:properties.length,candidates:candidates.length,opportunities:state.opportunities.filter(row=>row.status==='ACTIVE').length,prefilter:matched.stats,scope,readiness};
}

// ---------- Ready-to-send + enrichment (Phase 0D) --------------------------
export async function getReadinessAssessments({currentOnly=false}={}){const db=await openDB(),rows=await reqP(db.transaction(READINESS_STORE,'readonly').objectStore(READINESS_STORE).getAll());db.close();return currentOnly?rows.filter(row=>row.is_current===true||row.current_key===row.opportunity_id):rows;}
export async function getLatestReadinessAssessment(opportunityId){const rows=await getReadinessAssessments();return rows.filter(row=>row.opportunity_id===opportunityId).sort((a,b)=>String(b.assessed_at).localeCompare(String(a.assessed_at)))[0]||null;}
export async function getEnrichmentTasks(){const db=await openDB(),rows=await reqP(db.transaction(ENRICHMENT_TASK_STORE,'readonly').objectStore(ENRICHMENT_TASK_STORE).getAll());db.close();return rows;}
export async function getPropertyPackages(){const db=await openDB(),rows=await reqP(db.transaction(PROPERTY_PACKAGE_STORE,'readonly').objectStore(PROPERTY_PACKAGE_STORE).getAll());db.close();return rows;}
export async function getPackageMedia(){const db=await openDB(),rows=await reqP(db.transaction(PACKAGE_MEDIA_STORE,'readonly').objectStore(PACKAGE_MEDIA_STORE).getAll());db.close();return rows;}

export async function runOpportunityReadiness({full=false,opportunityIds=[],propertyIds=[],now=Date.now()}={}){
  if(!full&&!opportunityIds.length&&!propertyIds.length)return {evaluated:0,assessments:0,tasks:0,packages:0,scope:{full:false,opportunityIds:[],propertyIds:[]}};
  const db=await openDB();
  const read=name=>reqP(db.transaction(name,'readonly').objectStore(name).getAll());
  const [opportunities,properties,sourcePosts,mediaAssets,propertyMedia,identityLinks,reviewQueue,existingAssessments,existingTasks,existingPackages,existingPackageMedia]=await Promise.all([read(OPPORTUNITY_STORE),read(MASTER_STORE),read(SOURCE_POST_STORE),read(MEDIA_ASSET_STORE),read(PROPERTY_MEDIA_STORE),read(IDENTITY_LINK_STORE),read(REVIEW_QUEUE_STORE),read(READINESS_STORE),read(ENRICHMENT_TASK_STORE),read(PROPERTY_PACKAGE_STORE),read(PACKAGE_MEDIA_STORE)]);
  const scope={full,opportunityIds:[...new Set(opportunityIds)],propertyIds:[...new Set(propertyIds)]};
  const result=reconcileReadiness({opportunities,properties,sourcePosts,mediaAssets,propertyMedia,identityLinks,reviewQueue,scope,now});
  const assessedIds=new Set(result.assessments.map(row=>row.opportunity_id)),packageIds=new Set(result.packages.map(row=>row.id)),at=new Date(now).toISOString();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([READINESS_STORE,ENRICHMENT_TASK_STORE,PROPERTY_PACKAGE_STORE,PACKAGE_MEDIA_STORE,OPPORTUNITY_EVENT_STORE],'readwrite'),assessments=tx.objectStore(READINESS_STORE),tasks=tx.objectStore(ENRICHMENT_TASK_STORE),packages=tx.objectStore(PROPERTY_PACKAGE_STORE),packageMediaStore=tx.objectStore(PACKAGE_MEDIA_STORE),events=tx.objectStore(OPPORTUNITY_EVENT_STORE);
    const emit=(opportunityId,eventType,payload)=>events.put({id:`readiness_event_${radarHash(`${opportunityId}|${eventType}|${at}`)}`,opportunity_id:opportunityId,event_type:eventType,payload_json:payload,occurred_at:at});
    for(const row of result.assessments){
      const previous=existingAssessments.filter(item=>item.opportunity_id===row.opportunity_id).sort((a,b)=>String(b.assessed_at).localeCompare(String(a.assessed_at)))[0]||null;
      for(const old of existingAssessments.filter(item=>item.opportunity_id===row.opportunity_id&&(item.is_current===true||item.current_key===row.opportunity_id)))assessments.put({...old,is_current:false,current_key:null,superseded_at:at});
      assessments.put({...row,current_key:row.opportunity_id});
      const changed=!previous||previous.status!==row.status||JSON.stringify(previous.reasons)!==JSON.stringify(row.reasons)||JSON.stringify(previous.gaps)!==JSON.stringify(row.gaps);
      if(changed){emit(row.opportunity_id,'READINESS_EVALUATED',{previous_status:previous?.status||null,status:row.status,reasons:row.reasons,gaps:row.gaps,readiness_score:row.readiness_score});if(previous?.status!=='READY'&&row.status==='READY')emit(row.opportunity_id,'PROPERTY_BECAME_READY',{previous_status:previous?.status||null});if(previous?.status==='READY'&&row.status!=='READY')emit(row.opportunity_id,'PROPERTY_BECAME_NOT_READY',{status:row.status});}
    }
    for(const old of existingTasks.filter(row=>assessedIds.has(row.opportunity_id))){const current=result.tasks.find(row=>row.id===old.id);if(!current&&['OPEN','IN_PROGRESS','FAILED'].includes(old.status)){tasks.put({...old,status:'RESOLVED',resolved_at:at,updated_at:at});emit(old.opportunity_id,'ENRICHMENT_TASK_RESOLVED',{task_id:old.id,task_type:old.task_type});}}
    for(const row of result.tasks){const old=existingTasks.find(item=>item.id===row.id);if(old)tasks.put({...row,status:['IN_PROGRESS','DISMISSED','FAILED'].includes(old.status)?old.status:'OPEN',created_at:old.created_at||row.created_at});else{tasks.put(row);emit(row.opportunity_id,'ENRICHMENT_TASK_CREATED',{task_id:row.id,task_type:row.task_type});}}
    for(const old of existingPackages.filter(row=>assessedIds.has(row.opportunity_id)&&!packageIds.has(row.id)))packages.put({...old,status:'INVALIDATED',updated_at:at});
    for(const row of result.packages){const old=existingPackages.find(item=>item.id===row.id),changed=!old||old.status!==row.status||JSON.stringify(old.payload_json)!==JSON.stringify(row.payload_json);packages.put({...row,created_at:old?.created_at||row.created_at});if(changed)emit(row.opportunity_id,old?'PACKAGE_UPDATED':'PACKAGE_CREATED',{package_id:row.id});}
    const activeMediaIds=new Set(result.packageMedia.map(row=>row.id));for(const old of existingPackageMedia.filter(row=>packageIds.has(row.package_id)&&!activeMediaIds.has(row.id)&&row.status!=='REVOKED'))packageMediaStore.put({...old,status:'REVOKED',revoked_at:at,updated_at:at});
    for(const row of result.packageMedia){const old=existingPackageMedia.find(item=>item.id===row.id);packageMediaStore.put({...row,created_at:old?.created_at||row.created_at,revoked_at:null});}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();return {evaluated:result.evaluated,assessments:result.assessments.length,tasks:result.tasks.length,packages:result.packages.length,scope};
}

// ---------- Radar Backup v0.5.0.2 --------------------------------------------
const BACKUP_STORES=[
  PROP_STORE,IMPORT_STORE,FAV_STORE,CONTACT_STORE,MUNICIPALITY_STORE,ZONE_STORE,
  COMPLEX_STORE,LOCATION_PENDING_STORE,MASTER_STORE,SOURCE_POST_STORE,BUYER_STORE,
  MATCH_STORE,SYNC_QUEUE_STORE
  ,SOURCE_ATTACHMENT_STORE,MEDIA_ASSET_STORE,PROPERTY_MEDIA_STORE,IDENTITY_LINK_STORE,
  PROPERTY_REDIRECT_STORE,OWN_LISTING_STORE,REVIEW_QUEUE_STORE
  ,CLIENT_STORE,DEMAND_STORE,MATCH_RUN_STORE,MATCH_CANDIDATE_STORE,OPPORTUNITY_STORE,
  OPPORTUNITY_SCORE_STORE,OPPORTUNITY_EVENT_STORE,DEMAND_SOURCE_STORE,
  READINESS_STORE,ENRICHMENT_TASK_STORE,PROPERTY_PACKAGE_STORE,PACKAGE_MEDIA_STORE
];
export const BACKUP_STORE_NAMES=Object.freeze([...BACKUP_STORES]);

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
    backup_version:3,
    schemaVersion:BACKUP_SCHEMA_VERSION,
    app_version:APP_VERSION,
    db_name:DB_NAME,
    db_version:DB_VERSION,
    created_at:new Date().toISOString(),
    origin:typeof location!=='undefined'?location.origin:null,
    counts,
    stores
  };
}

export function migrateBackupSnapshot(snapshot){
  if(!snapshot||snapshot.format!=='radar-inmobiliario-backup')throw new Error('Este archivo no es un respaldo válido de Radar Inmobiliario.');
  const version=Number(snapshot.schemaVersion||snapshot.backup_version||1);
  if(version<1||version>BACKUP_SCHEMA_VERSION)throw new Error(`Versión de respaldo no compatible: ${version}.`);
  const stores={...(snapshot.stores||{})};
  for(const name of BACKUP_STORES){
    if(stores[name]===undefined||stores[name]===null)stores[name]=[];
    else if(!Array.isArray(stores[name]))throw new Error(`La tabla ${name} del respaldo está dañada.`);
  }
  if(version===1){
    stores[SOURCE_POST_STORE]=stores[SOURCE_POST_STORE].map(row=>({
      ...row,
      sourceType:row.sourceType||(row.source_type==='whatsapp'?'whatsapp_zip':row.source_type||'external_web'),
      sourceChannel:row.sourceChannel||(row.source_type==='whatsapp'?'primary_number':row.channel_name||row.source_type||'external_web'),
      sourceId:row.sourceId||row.id||null,importedAt:row.importedAt||row.detected_at||row.created_at||snapshot.created_at||null,
      publishedAt:row.publishedAt||row.published_at||null
    }));
  }
  const counts=Object.fromEntries(BACKUP_STORES.map(name=>[name,stores[name].length]));
  return {...snapshot,backup_version:3,schemaVersion:BACKUP_SCHEMA_VERSION,app_version:APP_VERSION,stores,counts,migrated_from:version<BACKUP_SCHEMA_VERSION?version:null};
}

export function validateBackupSnapshot(snapshot){
  if(!snapshot||snapshot.format!=='radar-inmobiliario-backup') throw new Error('Este archivo no es un respaldo válido de Radar Inmobiliario.');
  if(!snapshot.stores||typeof snapshot.stores!=='object') throw new Error('El respaldo no contiene las tablas esperadas.');
  let total=0;
  for(const name of BACKUP_STORES){
    if(snapshot.stores[name]!=null&&!Array.isArray(snapshot.stores[name])) throw new Error(`La tabla ${name} del respaldo está dañada.`);
    const rows=snapshot.stores[name]||[];total+=rows.length;
    for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`La tabla ${name} contiene un registro inválido.`);}
  }
  return {valid:true,total,stores:BACKUP_STORES.length};
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
  const prepared=migrateBackupSnapshot(snapshot);
  validateBackupSnapshot(prepared);
  const db=await openDB();
  try{
    // One transaction means a validation/write failure aborts the complete
    // replacement instead of leaving a half-restored database.
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(BACKUP_STORES,'readwrite');
      BACKUP_STORES.forEach((name,i)=>{
        const store=tx.objectStore(name),rows=prepared.stores[name]||[];
        onProgress?.({store:name,index:i+1,total:BACKUP_STORES.length,rows:rows.length});
        store.clear();for(const row of rows)store.put(row);
      });
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('La restauración fue cancelada.'));
    });
  }finally{db.close();}
  return {restored_at:new Date().toISOString(),counts:prepared.counts||{},schemaVersion:prepared.schemaVersion,migrated_from:prepared.migrated_from};
}

export function backupSnapshotSummary(snapshot){
  const prepared=migrateBackupSnapshot(snapshot);validateBackupSnapshot(prepared);
  const c=prepared.counts||{};
  return {
    properties:Number(c[PROP_STORE]||prepared.stores?.[PROP_STORE]?.length||0),
    masters:Number(c[MASTER_STORE]||prepared.stores?.[MASTER_STORE]?.length||0),
    sources:Number(c[SOURCE_POST_STORE]||prepared.stores?.[SOURCE_POST_STORE]?.length||0),
    contacts:Number(c[CONTACT_STORE]||prepared.stores?.[CONTACT_STORE]?.length||0),
    buyers:Number(c[BUYER_STORE]||prepared.stores?.[BUYER_STORE]?.length||0),
    matches:Number(c[MATCH_STORE]||prepared.stores?.[MATCH_STORE]?.length||0),
    created_at:prepared.created_at||null,schemaVersion:prepared.schemaVersion,migrated_from:prepared.migrated_from
  };
}

export async function clearDatabase() {
  const db = await openDB();
  const stores = [...BACKUP_STORES];
  await Promise.all(stores.map(name => new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.objectStore(name).clear();
  })));
  db.close();
}
