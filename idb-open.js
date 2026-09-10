export function isTransientIndexedDBError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  return ['UnknownError', 'NotFoundError', 'AbortError', 'TimeoutError'].includes(name)
    || /internal error|Indexed Database server/i.test(message);
}

function timeoutError(attempt, timeoutMs) {
  const error = new Error(`IndexedDB no respondió en ${timeoutMs} ms`);
  error.name = 'TimeoutError';
  error.attempt = attempt;
  return error;
}

export function openIndexedDatabase({
  indexedDBApi = globalThis.indexedDB,
  name,
  version,
  onUpgrade,
  onDiagnostic = () => {},
  timeoutMs = 8000,
  maxAttempts = 3,
  backoffs = [250, 750],
  delay = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  if (!indexedDBApi?.open) return Promise.reject(new Error('IndexedDB no está disponible'));

  const attemptOpen = attempt => new Promise((resolve, reject) => {
    let settled = false;
    let expired = false;
    const request = indexedDBApi.open(name, version);
    const finish = (callback, value) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      callback(value);
      return true;
    };
    const timer = setTimeout(() => {
      expired = true;
      finish(reject, timeoutError(attempt, timeoutMs));
    }, timeoutMs);

    request.onblocked = () => onDiagnostic({ phase: 'DB_OPEN', status: 'blocked', attempt });
    request.onupgradeneeded = event => onUpgrade?.(request, event);
    request.onerror = () => {
      const source = request.error || new Error('IndexedDB open error');
      let error = source;
      try { error.attempt = attempt; } catch { error = Object.assign(new Error(source.message), { name: source.name, attempt }); }
      finish(reject, error);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (expired || settled) {
        try { db?.close(); } catch {}
        return;
      }
      if (db) db.onversionchange = () => db.close();
      finish(resolve, db);
    };
  });

  return (async () => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      onDiagnostic({ phase: 'DB_OPEN', status: 'before', attempt });
      try {
        const db = await attemptOpen(attempt);
        onDiagnostic({ phase: 'DB_OPEN_OK', status: 'after', attempt });
        return db;
      } catch (error) {
        if (error.attempt == null) {
          try { error.attempt = attempt; } catch { error = Object.assign(new Error(error.message), { name: error.name, attempt }); }
        }
        lastError = error;
        onDiagnostic({ phase: 'DB_OPEN', status: 'error', attempt, error });
        if (attempt >= maxAttempts || !isTransientIndexedDBError(error)) throw error;
        await delay(backoffs[Math.min(attempt - 1, backoffs.length - 1)] || 0);
      }
    }
    throw lastError;
  })();
}

export function requestResult(request) {
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function readStoreCounts(db, stores) {
  const names=Object.values(stores);
  const tx=db.transaction(names,'readonly');
  const entries=await Promise.all(Object.entries(stores).map(async ([key,name])=>[key,await requestResult(tx.objectStore(name).count())]));
  return Object.fromEntries(entries);
}
