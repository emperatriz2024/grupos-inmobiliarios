const DB_NAME = 'grupos-inmobiliarios';
const DB_VERSION = 1;
const PROP_STORE = 'properties';
const IMPORT_STORE = 'imports';

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
  const tx = db.transaction([PROP_STORE, IMPORT_STORE], 'readonly');
  const properties = await reqP(tx.objectStore(PROP_STORE).count());
  const imports = await reqP(tx.objectStore(IMPORT_STORE).count());
  db.close();
  return { properties, imports };
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

export async function clearDatabase() {
  const db = await openDB();
  await Promise.all([
    new Promise((resolve, reject) => {
      const tx = db.transaction(PROP_STORE, 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(PROP_STORE).clear();
    }),
    new Promise((resolve, reject) => {
      const tx = db.transaction(IMPORT_STORE, 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(IMPORT_STORE).clear();
    })
  ]);
  db.close();
}
