import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {searchPropertiesChunked} from '../search-chunks.js';
import {matchesFilters,sortProperties} from '../search-utils.js?v=0784';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fixture=i=>({id:String(i),text:'Casa en venta en Valencia, zona Centro, torre Sol. 3 habitaciones. '+('Información original completa. '.repeat(30)),date_iso:new Date(Date.now()-86400000).toISOString().slice(0,10),operation:'Venta',property_type:'Casa',municipality:'Valencia',municipality_id:'m1',zone:'Centro',zone_id:'z1',residence:'Sol',price_usd:50000+i,bedrooms:3,bathrooms:2,parking:2,area_m2:100,phone:'04141234567',planta_100:true,planta_electrica:true,pozo:true,tanque:true,amoblado:true,financiamiento:true,piscina:true});
test('13.051 registros: filtro y orden equivalentes, event loop vivo, sin mutar propiedades',async()=>{
 const rows=Array.from({length:13051},(_,i)=>Object.freeze(fixture(i)));
 let ticks=0;const timer=setInterval(()=>ticks++,0);
 try{const result=await searchPropertiesChunked(rows,{q:'casa Valencia',zones:['Centro']},'price_desc');assert.equal(result.length,13051);assert.deepEqual(result,sortProperties(rows,'price_desc'));assert.ok(ticks>20,`ticks=${ticks}`);const warm=await searchPropertiesChunked(rows,{residence:'Sol'},'recent');assert.equal(warm.length,13051);}finally{clearInterval(timer);}
});
test('cancelación descarta búsqueda previa',async()=>{
 let generation=1,pauses=0;const rows=Array.from({length:1000},(_,i)=>fixture(i));
 const result=await searchPropertiesChunked(rows,{},'recent',{cancelled:()=>generation!==1,yieldTask:async()=>{if(++pauses===2)generation++;}});
 assert.equal(result,null);assert.equal(pauses,2);
});
test('todos los filtros mantienen semántica e índice invalida texto cambiado',()=>{
 const p=fixture(0);const good={operation:'Venta',property_types:['Casa'],municipality_ids:['m1'],zone_ids:['z1'],zones:['Centro'],residence:'Sol',min_price:40000,max_price:60000,bedrooms:3,bathrooms:2,parking:2,min_area:90,max_area:110,max_age_days:1,only_phone:true,planta_100:true,planta_electrica:true,pozo:true,tanque:true,amoblado:true,financiamiento:true,piscina:true};
 assert.equal(matchesFilters(p,good),true);
 for(const [key,value] of Object.entries({operation:'Alquiler',property_types:['Apartamento'],municipality_ids:['m2'],zone_ids:['z2'],zones:['Maracaibo'],residence:'Inexistente',min_price:60000,max_price:40000,bedrooms:4,bathrooms:3,parking:3,min_area:110,max_area:90}))assert.equal(matchesFilters(p,{[key]:value}),false,key);
 for(const key of ['planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina'])assert.equal(matchesFilters({...p,[key]:false},{[key]:true}),false,key);
 assert.equal(matchesFilters({...p,phone:''},{only_phone:true}),false);
 assert.equal(matchesFilters(p,{q:'Valencia'}),true);p.text='Casa en venta en Barquisimeto';p.municipality='Barquisimeto';assert.equal(matchesFilters(p,{q:'Valencia'}),false);
});
test('selectores DOM: abrir tres modos, múltiples, aplicar, cerrar y pill sin búsqueda',()=>{
 assert.match(html,/<div id="multiSelectorPanel"[^>]*hidden>/);assert.doesNotMatch(html,/<dialog id="multiSelector/);
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',textContent:'',onclick:null,focus(){},querySelectorAll(){return this.buttons||[];}});return nodes.get(id);};
 const context=vm.createContext({Set,performance,searchMetric(){},document:{body:{classList:{add(){},remove(){}}},addEventListener(){}},$:node});
 vm.runInContext(`let selectorMode,selectorDraft=new Set(),selectedPropertyTypes=new Set(),selectedMunicipalities=new Set(),selectedZones=new Set();let saves=0,updates=0;const locationCatalog={zones:[]};function renderSelectorOptions(){}function updateSelectorUI(){updates++}function rememberSearchPosition(){saves++}function esc(x){return x}`,context);
 vm.runInContext(app.slice(app.indexOf('function openSelector('),app.indexOf('async function openDetail')),context);
 for(const [id,mode] of [['openTypeSelector','types'],['openMunicipalitySelector','municipalities'],['openZoneSelector','zones']]){
 node('#'+id).onclick();assert.equal(node('#multiSelectorPanel').hidden,false);vm.runInContext("selectorDraft.add('a');selectorDraft.add('b')",context);node('#selectorApplyBtn').onclick();assert.equal(node('#multiSelectorPanel').hidden,true);assert.equal(vm.runInContext(`(${mode==='types'?'selectedPropertyTypes':mode==='municipalities'?'selectedMunicipalities':'selectedZones'}).size`,context),2);
 }
 node('#openTypeSelector').onclick();node('#closeMultiSelector').onclick();assert.equal(node('#multiSelectorPanel').hidden,true);
 vm.runInContext(app.slice(app.indexOf('function renderPills('),app.indexOf('function updateSelectorUI(')),context);
 node('#typeSelectedPills').buttons=[{dataset:{value:'a'}}];vm.runInContext("renderPills('typeSelectedPills',selectedPropertyTypes)",context);node('#typeSelectedPills').buttons[0].onclick();assert.equal(vm.runInContext("selectedPropertyTypes.has('a')",context),false);assert.equal(vm.runInContext('saves',context),4);
});
test('solo botón Buscar y Limpiar llaman runSearch; sin IndexedDB en índice',()=>{
 const controls=app.slice(app.indexOf("$('#searchBtn').onclick"),app.indexOf('const PROPERTY_TYPES'));
 assert.equal((controls.match(/runSearch\(/g)||[]).length,2);
 assert.match(app,/generation!==searchGeneration/);assert.match(app,/Buscando…/);
 const helper=fs.readFileSync(new URL('../search-chunks.js',import.meta.url),'utf8');assert.doesNotMatch(helper,/indexedDB|put\(|saveProperty/);
});
