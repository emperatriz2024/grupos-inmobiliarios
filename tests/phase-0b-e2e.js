import {
  getMasterProperties, setMasterOwnership, getOwnListingDetails,
  saveOwnListingDetails
} from '../db.js';
import {serializePublicProperty} from '../core/radar/own-listings.js';
import {APP_LABEL} from '../version.js';

const DB_NAME='grupos-inmobiliarios';
const DB_VERSION=15;
const STATE_KEY='phase-0b-automated-e2e-state';
const LEGACY_ID='TEST-PHASE0B-LEGACY-001';
const OWN_ID='TEST-PHASE0B-MASTER-OWN-001';
const ARCHIVED_ID='TEST-PHASE0B-MASTER-ARCHIVED-001';
const PRIVATE_NOTE='TEST-PRIVATE-NOTE-DO-NOT-LEAK';
const result=document.querySelector('#result');

function assert(value,message){if(!value)throw new Error(message);}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function openDatabase(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function getStoreRecord(store,id){const db=await openDatabase(),tx=db.transaction(store,'readonly'),row=await request(tx.objectStore(store).get(id));db.close();return row;}
async function getAllStoreRecords(store){const db=await openDatabase(),tx=db.transaction(store,'readonly'),rows=await request(tx.objectStore(store).getAll());db.close();return rows;}

async function seedFixture(){
  const db=await openDatabase(),now='2026-08-28T12:00:00.000Z';
  assert(db.version===DB_VERSION,'IndexedDB no abrió en V7');
  for(const store of ['properties','master_properties','own_listing_details','sync_queue'])assert(db.objectStoreNames.contains(store),`Falta store ${store}`);
  const tx=db.transaction(['properties','master_properties'],'readwrite');
  tx.objectStore('properties').put({id:LEGACY_ID,group:'TEST PHASE 0B',property_type:'Apartamento',operation:'Venta',zone:'TEST ZONE',residence:'TEST RESIDENCE',price_usd:123456,bedrooms:3,bathrooms:2,parking:2,area_m2:144,text:'TEST PHASE 0B persistent legacy inventory',date:now,received_at:now});
  tx.objectStore('master_properties').put({id:OWN_ID,workspace_id:'local',status:'ACTIVE',ownership_scope:'UNKNOWN',property_type:'Apartamento',operation:'Venta',zone_name:'TEST ZONE',residence_name:'TEST OWN RESIDENCE',price_usd:123456,legacy_ids:[LEGACY_ID],created_at:now,updated_at:now,last_seen_at:now});
  tx.objectStore('master_properties').put({id:ARCHIVED_ID,workspace_id:'local',status:'ARCHIVED',redirected_to:OWN_ID,ownership_scope:'MARKET',property_type:'Apartamento',operation:'Venta',zone_name:'TEST ZONE',residence_name:'TEST ARCHIVED RESIDENCE',price_usd:999999,created_at:now,updated_at:now,last_seen_at:now});
  await transactionDone(tx);db.close();
}

async function run(){
  const phase=sessionStorage.getItem(STATE_KEY)||'seed';
  if(phase==='seed'){
    await seedFixture();sessionStorage.setItem(STATE_KEY,'own');location.reload();return;
  }
  if(phase==='own'){
    assert((await getStoreRecord('properties',LEGACY_ID))?.price_usd===123456,'Inventario legacy no persistió tras reload');
    const normal=await getMasterProperties(),all=await getMasterProperties({includeArchived:true});
    assert(normal.some(row=>row.id===OWN_ID),'Master TEST activo no aparece');
    assert(!normal.some(row=>row.id===ARCHIVED_ID),'Master ARCHIVED aparece en resultados normales');
    assert(all.some(row=>row.id===ARCHIVED_ID),'Master ARCHIVED no quedó persistido');
    assert(normal.find(row=>row.id===OWN_ID).ownership_scope==='UNKNOWN','Estado inicial no es UNKNOWN');
    await setMasterOwnership(OWN_ID,'OWN');
    assert((await getMasterProperties()).find(row=>row.id===OWN_ID).ownership_scope==='OWN','Falló UNKNOWN → OWN');
    await saveOwnListingDetails({property_id:OWN_ID,workspace_id:'local',agreement_type:'EXCLUSIVE',commission_pct:5,authorized_price:120000,currency:'USD',internal_notes:PRIVATE_NOTE,documents_status:'COMPLETE',media_authorization_status:'OWNED'});
    sessionStorage.setItem(STATE_KEY,'market');location.reload();return;
  }
  if(phase==='market'){
    const details=await getOwnListingDetails(OWN_ID);
    assert(details?.internal_notes===PRIVATE_NOTE&&details?.commission_pct===5,'own_listing_details no persistió tras reload');
    assert((await getMasterProperties()).find(row=>row.id===OWN_ID).ownership_scope==='OWN','OWN no persistió tras reload');
    await setMasterOwnership(OWN_ID,'MARKET');
    sessionStorage.setItem(STATE_KEY,'final');location.reload();return;
  }
  const master=(await getMasterProperties()).find(row=>row.id===OWN_ID),details=await getOwnListingDetails(OWN_ID);
  assert(master?.ownership_scope==='MARKET','Falló OWN → MARKET');
  assert(details?.internal_notes===PRIVATE_NOTE&&details?.commission_pct===5,'OWN → MARKET borró datos privados');
  const history=(await getAllStoreRecords('sync_queue')).filter(row=>row.entity_id===OWN_ID&&row.operation==='PROPERTY_OWNERSHIP_CHANGED');
  assert(history.some(row=>row.payload_json?.previous==='UNKNOWN'&&row.payload_json?.scope==='OWN'),'Falta historial UNKNOWN → OWN');
  assert(history.some(row=>row.payload_json?.previous==='OWN'&&row.payload_json?.scope==='MARKET'),'Falta historial OWN → MARKET');
  const normal=await getMasterProperties();
  assert(!normal.some(row=>row.id===ARCHIVED_ID),'Master ARCHIVED aparece después del flujo');
  const publicRow=serializePublicProperty({...master,...details,own_listing_details:details});
  assert(!('internal_notes'in publicRow)&&!('commission_pct'in publicRow)&&!('own_listing_details'in publicRow),'Datos privados filtrados al serializer público');
  assert(!('internal_notes'in master)&&!('commission_pct'in master),'Datos privados contaminaron master_properties');
  const index=await (await fetch('../index.html',{cache:'no-store'})).text();
  assert(index.includes('id="appVersionLabel"')&&!index.includes('V0.6.1 WHATSAPP SECONDARY'),'index.html conserva versión visual hardcodeada');
  const report={
    status:'PASS',indexedDBVersion:DB_VERSION,legacyInventoryPersistence:'PASS',unknownToOwn:'PASS',
    ownDetailsPersistenceAfterReload:'PASS',ownToMarket:'PASS',ownHistoryRetained:'PASS',
    archivedMastersHidden:'PASS',privateDataIsolation:'PASS',versionLabel:APP_LABEL
  };
  sessionStorage.removeItem(STATE_KEY);result.textContent=JSON.stringify(report,null,2);
}

run().catch(error=>{sessionStorage.removeItem(STATE_KEY);result.textContent=`FAIL\n${error.stack||error.message}`;document.body.dataset.status='FAIL';});
