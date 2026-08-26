import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

function openLegacyDatabase(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('grupos-inmobiliarios',6);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('properties'))db.createObjectStore('properties',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}

test('migración IndexedDB V6→V7 conserva inventario y añade solicitudes/selecciones',async()=>{
  const legacy=await openLegacyDatabase();
  await new Promise((resolve,reject)=>{const tx=legacy.transaction('properties','readwrite');tx.objectStore('properties').put({id:'legacy-1',text:'Inventario existente'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});legacy.close();
  const db=await import('../db.js?requests-db-test');
  const request=await db.saveRequest({title:'Locales',criteria:{operation:'Venta',property_types:['Local comercial'],max_price:40000}});
  const selection=await db.saveSelection({request_id:request.id,master_property_ids:['master-1','master-2'],title:'Opciones'});
  await db.recordSelectionPublication(selection);
  assert.equal((await db.getRequests()).length,1);assert.equal((await db.getSelections()).length,1);
  assert.deepEqual(new Set(await db.getPreviouslySentMasterIds({requestId:request.id})),new Set(['master-1','master-2']));
  assert.equal((await db.getAllProperties()).some(row=>row.id==='legacy-1'),true);
  const backup=await db.exportDatabaseSnapshot();assert.equal(backup.schemaVersion,3);assert.equal(backup.stores.requests.length,1);assert.equal(backup.stores.selections.length,1);assert.equal(backup.stores.selection_history.length,1);
});
