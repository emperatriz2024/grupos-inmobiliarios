import { isDemandRequest } from './intent-utils.js?v=048';
import { extractLocationTerms, bestZone } from './location-utils.js?v=048';
import { detectDateOrderFromDates, parseFlexibleDate, toISODate } from './date-utils.js?v=048';

const DB_NAME = 'grupos-inmobiliarios';
const DB_VERSION = 2;
const PROP_STORE = 'properties';
const IMPORT_STORE = 'imports';
const FAV_STORE = 'favorites';

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
  const stores = [PROP_STORE, IMPORT_STORE, FAV_STORE];
  await Promise.all(stores.map(name => new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.objectStore(name).clear();
  })));
  db.close();
}
