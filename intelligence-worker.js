import {buildContactIndex} from './contact-utils.js?v=0786';
import * as db from './db.js?v=0786';
import {auditExistingPropertyPrice} from './engine.js?v=0786';
import {consolidateProperties} from './dedupe-utils.js?v=0786';
import {recencyInfo} from './search-utils.js?v=0786';
import {isDemandRequest} from './intent-utils.js?v=0786';
import {legacyBuyerToClientDemand,evaluateDemandProperty} from './core/radar/demand-engine.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
let running=false;
self.onmessage=async({data})=>{
  if(data.type==='detail'){try{const master=(await db.getMasterProperties()).find(row=>row.id===data.id||(row.legacy_ids||[]).includes(data.id))||null;const own=master?await db.getOwnListingDetails(master.id):null;self.postMessage({type:'detail',id:data.id,master,own});}catch{}return;}
  if(running||data.type!=='start')return;running=true;
  let raw=[],valid=[],consolidated=[],core={};
  const task=async(name,run)=>{await pause();try{await run();self.postMessage({type:'task',name,ok:true});}catch(e){self.postMessage({type:'task',name,ok:false,error:{name:e.name,message:String(e.message).slice(0,180)}});}};
  try{
    await task('price_audit',async()=>{raw=await db.getAllProperties();for(let i=0;i<raw.length;i+=100){const pending=raw.slice(i,i+100).filter(p=>p.price_audit_version!=='0600');if(pending.length)await db.patchPropertyPriceAudits(pending.map(auditExistingPropertyPrice));await pause();}});
    await task('radar_core',async()=>{raw=await db.getAllProperties();valid=raw.filter(p=>{const r=recencyInfo(p);return r.days<=60&&!isDemandRequest(p.text||'');});consolidated=consolidateProperties(valid);core=await db.syncRadarCore(valid,consolidated);});
    await task('demand_engine',async()=>{if(data.demandEnabled){await db.mirrorLegacyBuyersToDemands();if(core.touchedMasterIds?.length)await db.runDemandOpportunityMatching({trigger_type:'INVENTORY_REFRESH',trigger_entity_id:core.touchedMasterIds});}});
    await task('buyer_matching',async()=>{
      const buyers=await db.getBuyers(),masters=await db.getMasterProperties();
      for(const buyer of buyers){
        if(buyer.status==='closed'){await db.replaceBuyerMatches(buyer.id,[]);continue;}
        const demand=legacyBuyerToClientDemand(buyer).demand;
        const matches=masters.map(master=>({master,...evaluateDemandProperty(demand,master)})).filter(row=>row.classification!=='REJECTED').map(row=>({...row,score:row.ready_score,tier:row.classification==='EXACT'?'excelente':row.classification==='ALTERNATIVE'?'alternativa':'revisar',match_kind:row.classification.toLowerCase(),strict_ok:row.classification==='EXACT',recency_days:0})).sort((a,b)=>b.score-a.score);
        await db.replaceBuyerMatches(buyer.id,matches.map(m=>({master_id:m.master.id,score:m.score,tier:m.tier,match_kind:m.match_kind,strict_ok:m.strict_ok,reasons:m.reasons,gaps:m.gaps,recency_days:m.recency_days})));await pause();
      }
    });
    await task('contacts',async()=>{const rows=await db.getAllContacts();self.postMessage({type:'contacts',rows,index:buildContactIndex(rows)});});
    await task('location',async()=>{await db.ensureLocationCatalogSeed();const catalog=await db.getLocationCatalog();await db.rematchAllPropertyLocations(catalog);});
  }finally{running=false;self.postMessage({type:'complete'});}
};
