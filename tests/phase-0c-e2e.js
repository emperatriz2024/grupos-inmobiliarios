import {mirrorLegacyBuyersToDemands,saveDemandRecords,runDemandOpportunityMatching,getClients,getDemands,getOpportunities,getOpportunityEvents,setMasterOwnership} from '../db.js';
import {parseDemandRequest} from '../core/radar/demand-engine.js';
import {APP_LABEL} from '../version.js';

const result=document.querySelector('#result'),STATE='phase-0c-e2e-state',DB='grupos-inmobiliarios',VERSION=8;
const ids={buyer:'TEST-0C-BUYER',p1:'TEST-0C-P1',p2:'TEST-0C-P2',p3:'TEST-0C-P3',p4:'TEST-0C-P4'};
const request=parseDemandRequest({text:'Solicito Casa San Diego hasta $60.000',messageId:'TEST-0C-REQUEST',source_channel:'secondary_number'},{origin:'MARKET'});
const assert=(value,message)=>{if(!value)throw new Error(message);};
const reqP=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
const open=()=>new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
async function put(store,row){const db=await open(),tx=db.transaction(store,'readwrite');tx.objectStore(store).put(row);await done(tx);db.close();}
async function seed(){
  await getClients();const db=await open();assert(db.version===8,'IndexedDB no abrió V8');for(const name of ['clients','demands','match_runs','match_candidates','opportunities','opportunity_scores','opportunity_events'])assert(db.objectStoreNames.contains(name),`Falta ${name}`);
  const now='2026-08-28T12:00:00.000Z',tx=db.transaction(['buyers','master_properties'],'readwrite');
  tx.objectStore('buyers').put({id:ids.buyer,name:'Cliente TEST Casa San Diego',status:'active',operation:'Venta',property_types:['Casa'],municipality_ids:['san-diego'],max_price:60000,budget_tolerance:0,created_at:now,updated_at:now});
  const property=(id,ownership_scope,price_usd,property_type='Casa')=>({id,workspace_id:'local',status:'ACTIVE',ownership_scope,operation:'Venta',property_type,municipality_id:'san-diego',price_usd,last_seen_at:now,created_at:now,updated_at:now});
  for(const row of [property(ids.p1,'OWN',55000),property(ids.p2,'MARKET',58000),property(ids.p3,'MARKET',70000),property(ids.p4,'MARKET',50000,'Apartamento')])tx.objectStore('master_properties').put(row);
  await done(tx);db.close();await mirrorLegacyBuyersToDemands();await saveDemandRecords([request]);await runDemandOpportunityMatching({trigger_type:'E2E_INITIAL'});
}
async function run(){
  const phase=sessionStorage.getItem(STATE)||'seed';
  if(phase==='seed'){await seed();sessionStorage.setItem(STATE,'transitions');location.reload();return;}
  if(phase==='transitions'){
    const clients=await getClients(),demands=await getDemands(),opportunities=await getOpportunities();assert(clients.some(x=>x.legacy_buyer_id===ids.buyer),'Mirror client no persistió');assert(demands.some(x=>x.origin==='CLIENT')&&demands.some(x=>x.origin==='MARKET'),'Demandas CLIENT/MARKET no persistieron');
    const active=opportunities.filter(x=>x.status==='ACTIVE'),clientDemand=demands.find(x=>x.legacy_buyer_id===ids.buyer);
    assert(active.filter(x=>x.demand_id===clientDemand.id).length===2,'CLIENT no obtuvo P1+P2');assert(active.filter(x=>x.demand_id===request.id).length===1&&active.some(x=>x.demand_id===request.id&&x.property_id===ids.p1),'MARKET no quedó limitado a P1 OWN');
    await setMasterOwnership(ids.p2,'OWN');await runDemandOpportunityMatching({trigger_type:'OWNERSHIP_CHANGED',trigger_entity_id:ids.p2});
    assert((await getOpportunities()).filter(x=>x.status==='ACTIVE'&&x.demand_id===request.id).length===2,'MARKET→OWN no abrió P2');
    await put('master_properties',{...(await getMaster(ids.p1)),status:'ARCHIVED'});await runDemandOpportunityMatching({trigger_type:'PROPERTY_ARCHIVED',trigger_entity_id:ids.p1});
    await put('master_properties',{...(await getMaster(ids.p2)),price_usd:70000});await runDemandOpportunityMatching({trigger_type:'PRICE_CHANGED',trigger_entity_id:ids.p2});
    await put('master_properties',{...(await getMaster(ids.p2)),price_usd:59000});await runDemandOpportunityMatching({trigger_type:'PRICE_CHANGED',trigger_entity_id:ids.p2});
    sessionStorage.setItem(STATE,'final');location.reload();return;
  }
  const demands=await getDemands(),opportunities=await getOpportunities(),events=await getOpportunityEvents(),clientDemand=demands.find(x=>x.legacy_buyer_id===ids.buyer),p1=opportunities.filter(x=>x.property_id===ids.p1),p2=opportunities.filter(x=>x.property_id===ids.p2);
  assert(p1.every(x=>x.status==='INVALIDATED'),'ARCHIVED no invalidó oportunidades P1');assert(p2.filter(x=>x.demand_id===clientDemand.id||x.demand_id===request.id).every(x=>x.status==='ACTIVE'),'Price drop no reabrió P2');assert(events.some(x=>x.event_type==='OPPORTUNITY_INVALIDATED')&&events.some(x=>x.event_type==='OPPORTUNITY_REOPENED'),'Historial no conservó invalidación/reapertura');
  sessionStorage.removeItem(STATE);result.textContent=JSON.stringify({status:'PASS',indexedDBVersion:8,backupSchema:3,clientMigration:'PASS',marketRouting:'PASS',opportunityInvalidation:'PASS',opportunityReopen:'PASS',eventHistory:'PASS',versionLabel:APP_LABEL},null,2);
}
async function getMaster(id){const db=await open(),row=await reqP(db.transaction('master_properties','readonly').objectStore('master_properties').get(id));db.close();return row;}
run().catch(error=>{sessionStorage.removeItem(STATE);result.textContent=`FAIL\n${error.stack||error.message}`;document.body.dataset.status='FAIL';});
