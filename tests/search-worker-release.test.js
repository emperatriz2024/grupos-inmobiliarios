import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
import {SearchWorkerController} from '../search-worker-controller.js';
import {createSearchRecord,matchesSearchRecord,prepareFilters} from '../search-index.js';
import {matchesFilters,sortProperties} from '../search-utils.js?v=0786';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const fixture=i=>({id:String(i),operation:i%2?'Alquiler':'Venta',property_type:i%2?'Apartamento':'Casa',municipality_id:'m1',municipality:'Valencia',zone_id:'z1',zone:'Centro',residence:'Sol',price_usd:50000+i,bedrooms:3,bathrooms:2,parking:1,area_m2:100,planta_100:true,planta_electrica:true,pozo:true,tanque:true,amoblado:true,financiamiento:true,piscina:true,phone:'04141234567',date_iso:new Date(Date.now()-86400000).toISOString().slice(0,10),time:'10:30',text:'Casa en venta Valencia Centro Torre Sol.',appearances:i%7});
test('worker REAL indexa 13.051; cola READY, IDs, cancelación, rebuild, main vivo',async()=>{
 const nodeWorker=new Worker(new URL('./search-worker-node-host.js',import.meta.url),{type:'module'});
 const messages=[],metrics=[],status=[];
 const adapter={postMessage:m=>{messages.push({type:m.type,count:m.records?.length});nodeWorker.postMessage(m);}};
 nodeWorker.on('message',data=>adapter.onmessage?.({data}));nodeWorker.on('error',error=>adapter.onerror?.(error));
 const controller=new SearchWorkerController({workerFactory:()=>adapter,onStatus:s=>status.push(s),onMetric:(name,ms)=>metrics.push({name,ms})});
 const rows=Array.from({length:13051},(_,i)=>Object.freeze(fixture(i)));let ticks=0;const timer=setInterval(()=>ticks++,5);
 try{
   const building=controller.rebuild(rows);
   const queued=controller.search({operation:'Venta'},'price_desc',1);
   await building;const ids=await queued;
   assert.equal(ids.length,6526);assert.equal(ids[0],'13050');assert.ok(ids.every(id=>typeof id==='string'));assert.ok(ticks>20);
   assert.ok(messages.filter(m=>m.type==='batch').every(m=>m.count<=250));assert.ok(status.includes('Búsqueda lista'));
   const first=controller.search({q:'casa'},'recent',2);const second=controller.search({q:'Valencia',zones:['Centro']},'price_asc',3);
   assert.equal(await first,null);const latest=await second;assert.equal(latest.length,13051);assert.equal(latest[0],'0');
   assert.deepEqual(await controller.propertiesForIds(latest,()=>false),rows);
   // Actual main-thread projection + postMessage and ID mapping budget.
   for(const m of metrics.filter(m=>m.name==='indexTransferTaskMs'||m.name==='resultMappingTaskMs'))assert.ok(m.ms<50,`${m.name}: ${m.ms}`);
   await controller.rebuild([fixture(33)]);assert.deepEqual(await controller.search({},'recent',4),['33']);
 }finally{clearInterval(timer);await nodeWorker.terminate();}
});
test('índice compilado conserva todos los filtros, fuzzy y descarta texto original',()=>{
 const rows=[fixture(0),fixture(1),{...fixture(2),municipality_id:null,zone_id:null}, {...fixture(3),phone:'',resolved_phone:''}, {...fixture(4),date_iso:'2020-01-01'}, {...fixture(5),text:'Busco apartamento para cliente en Valencia'}];
 const filters=[{}, {q:'cassa'}, {q:'Valencia Centro'}, {operation:'Venta'}, {property_types:['Apartamento']},{municipality_ids:['m1'],municipality_names:['Valencia']},{municipality_ids:['m2'],municipality_names:['Caracas']},{zone_ids:['z1'],zones:['Centro']},{zone_ids:['z2'],zones:['Norte']},{residence:'Sol'},{min_price:50002},{max_price:50002},{bedrooms:4},{bathrooms:3},{parking:2},{min_area:101},{max_area:99},{max_age_days:1},{only_phone:true},...['planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina'].map(key=>({[key]:true}))];
 const index=rows.map(createSearchRecord);
 for(const f of filters)assert.deepEqual(index.filter(p=>matchesSearchRecord(p,prepareFilters(f))).map(p=>p.id),rows.filter(p=>matchesFilters(p,f)).map(p=>p.id),JSON.stringify(f));
 assert.ok(index.every(p=>!('text' in p)&&!('location_terms' in p)));
});
test('worker orders price/recent match legacy',async()=>{
 const worker=new Worker(new URL('./search-worker-node-host.js',import.meta.url),{type:'module'});
 const adapter={postMessage:m=>worker.postMessage(m)};worker.on('message',data=>adapter.onmessage?.({data}));
 const controller=new SearchWorkerController({workerFactory:()=>adapter});
 const rows=[{...fixture(0),price_usd:null},{...fixture(1),time:'09:00'},fixture(2)];
 try{await controller.rebuild(rows);for(const [i,mode] of ['price_asc','price_desc','recent','appearances'].entries())assert.deepEqual(await controller.search({},mode,i),sortProperties(rows,mode).map(p=>p.id));}finally{await worker.terminate();}
});
test('main ne filtre pas; zonas y municipios solo 60 etiquetas por página',()=>{
 assert.doesNotMatch(app,/searchPropertiesChunked|matchesFilters/);
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,innerHTML:'',querySelectorAll:()=>[]});return nodes.get(id);};
 const context=vm.createContext({$,performance,searchMetric(){},normLoc:s=>s.toLowerCase(),esc:s=>s,Set,Map});
 vm.runInContext(`let selectorMode='zones',selectorDraft=new Set(),selectedMunicipalities=new Set();const PROPERTY_TYPES=['Casa','Apartamento'];const zoneCatalog=Array.from({length:2000},(_,i)=>({id:String(i),nombre:'Zona '+i,municipio_id:'m'}));const locationCatalog={municipalities:zoneCatalog};function municipalityName(){return 'Municipio'}`,context);
 vm.runInContext(app.slice(app.indexOf('let selectorLimit=15;'),app.indexOf('function openSelector(')),context);
 for(const mode of ['zones','municipalities']){vm.runInContext(`selectorMode='${mode}';selectorLimit=15;renderSelectorOptions()`,context);assert.equal(($ ('#selectorOptionsList').innerHTML.match(/<label/g)||[]).length,15);vm.runInContext('selectorLimit=30;renderSelectorOptions()',context);assert.equal(($ ('#selectorOptionsList').innerHTML.match(/<label/g)||[]).length,15);}
 const source=fs.readFileSync(new URL('../search-index.js',import.meta.url),'utf8');const query=source.slice(source.indexOf('export function matchesSearchRecord'));assert.doesNotMatch(query,/extractLocationTerms|isDemandRequest\(|norm\(p\.text/);
});
