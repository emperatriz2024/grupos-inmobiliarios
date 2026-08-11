
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


function parseLocalDate(dateStr='') {
  const m=String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return 0;
  let y=Number(m[3]); if(y<100)y+=2000;
  return new Date(y,Number(m[2])-1,Number(m[1])).getTime();
}

export async function purgeOldProperties(maxAgeDays=60) {
  const db=await openDB();
  const cutoff=new Date();
  cutoff.setHours(0,0,0,0);
  cutoff.setDate(cutoff.getDate()-Number(maxAgeDays));
  const cutoffTs=cutoff.getTime();
  let removed=0, refreshed=0;

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
      const candidates=[
        {date:p.date,time:p.time,sender:p.sender,group:p.group,phone:p.phone},
        ...(p.sources||[])
      ].filter(x=>parseLocalDate(x.date));

      candidates.sort((a,b)=>{
        const ta=parseLocalDate(a.date), tb=parseLocalDate(b.date);
        if(ta!==tb) return tb-ta;
        return String(b.time||'').localeCompare(String(a.time||''));
      });

      const latest=candidates[0];
      const latestTs=latest ? parseLocalDate(latest.date) : 0;

      if(latestTs && latestTs < cutoffTs){
        c.delete();
        favs.delete(p.id);
        removed++;
      } else if(latest && (latest.date!==p.date || latest.time!==p.time)){
        c.update({...p,date:latest.date,time:latest.time,
          sender:latest.sender||p.sender,group:latest.group||p.group,
          phone:latest.phone||p.phone});
        refreshed++;
      }
      c.continue();
    };
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
  db.close();
  return {removed,refreshed,cutoff:cutoff.toISOString().slice(0,10)};
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
