import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDemandRequest,legacyBuyerToClientDemand,evaluateDemandProperty,matchDemandsToProperties,OpportunityEngine} from '../core/radar/demand-engine.js';
import {TerritoryOntology,trigalTerritorySeed} from '../core/radar/territory.js';
import {processChatText} from '../engine.js';
import {processZipDemandMessages} from '../ingestion/demand-processing.js';
import {processSecondaryEvents} from '../ingestion/secondary-processing.js';
import {radarDemandEngineEnabled} from '../core/radar/config.js';
import {migrateBackupSnapshot,BACKUP_STORE_NAMES} from '../db.js';

const now='2026-08-28T12:00:00.000Z';
const client={id:'d-client',origin:'CLIENT',status:'ACTIVE',operation:'Venta',property_types:['Casa'],municipality_ids:['san-diego'],max_price:60000,budget_tolerance:0};
const market={...client,id:'d-market',origin:'MARKET'};
const property=(id,ownership_scope,price_usd,type='Casa',extra={})=>({id,ownership_scope,price_usd,property_type:type,operation:'Venta',municipality_id:'san-diego',status:'ACTIVE',last_seen_at:now,...extra});
const P1=property('P1','OWN',55000),P2=property('P2','MARKET',58000),P3=property('P3','MARKET',70000),P4=property('P4','MARKET',50000,'Apartamento');

test('escenario obligatorio CLIENT busca OWN + MARKET elegibles',()=>{
  const rows=matchDemandsToProperties([client],[P1,P2,P3,P4]);
  assert.deepEqual(rows.filter(x=>x.classification==='EXACT').map(x=>x.property_id),['P1','P2']);
  assert.deepEqual(rows.filter(x=>x.classification==='REJECTED').map(x=>x.property_id),['P3','P4']);
});

test('solicitud colega enruta exclusivamente a OWN y reacciona MARKET → OWN',()=>{
  let rows=matchDemandsToProperties([market],[P1,P2,P3,P4]);
  assert.deepEqual(rows.filter(x=>x.classification!=='REJECTED').map(x=>x.property_id),['P1']);
  rows=matchDemandsToProperties([market],[P1,{...P2,ownership_scope:'OWN'},P3,P4]);
  assert.deepEqual(rows.filter(x=>x.classification!=='REJECTED').map(x=>x.property_id),['P1','P2']);
});

test('hard gates: budget, operación, tipo y espacios conocidos inferiores rechazan',()=>{
  assert.equal(evaluateDemandProperty(client,P3).classification,'REJECTED');
  assert.equal(evaluateDemandProperty(client,{...P1,operation:'Alquiler'}).classification,'REJECTED');
  assert.equal(evaluateDemandProperty(client,P4).classification,'REJECTED');
  assert.equal(evaluateDemandProperty({...client,min_bedrooms:3},{...P1,bedrooms:2}).classification,'REJECTED');
});

test('dato requerido ausente produce VERIFY con scores explicables',()=>{
  const row=evaluateDemandProperty({...client,min_bedrooms:3},{...P1,bedrooms:null});
  assert.equal(row.classification,'VERIFY');assert.ok(row.gaps.some(x=>x.includes('ausente')));
  for(const key of ['fit_score','evidence_score','availability_score','ready_score'])assert.equal(typeof row[key],'number');
});

test('precio dentro de tolerancia se clasifica ALTERNATIVE',()=>{
  assert.equal(evaluateDemandProperty({...client,budget_tolerance:10},{...P1,price_usd:63000}).classification,'ALTERNATIVE');
});

test('jerarquía Trigal expande descendientes y Trigal Norte permanece exacto',()=>{
  const ontology=new TerritoryOntology(trigalTerritorySeed()),base={...client,municipality_ids:[],territory_ids:['familia-trigal']};
  assert.equal(evaluateDemandProperty(base,{...P1,territory_id:'trigal-norte'},{territoryOntology:ontology}).classification,'EXACT');
  const exact={...base,territory_ids:['trigal-norte']};
  assert.equal(evaluateDemandProperty(exact,{...P1,territory_id:'trigal-centro'},{territoryOntology:ontology}).classification,'REJECTED');
});

test('REQUEST parser clasifica solicitud como MARKET y no confunde Vendo',()=>{
  const request=parseDemandRequest({text:'Solicito apartamento 2 hab Campo Alegre hasta $75.000',messageId:'m1'},{origin:'MARKET'});
  assert.equal(request.origin,'MARKET');assert.equal(request.max_price,75000);assert.equal(request.min_bedrooms,2);
  assert.equal(parseDemandRequest({text:'Vendo apartamento 2 hab Campo Alegre $75.000',messageId:'m2'},{origin:'MARKET'}),null);
});

test('ZIP request ingestion conserva demanda y excluye PROPERTY request',()=>{
  const chat='[8/28/26, 9:00:00 a. m.] Corredor: Solicito Casa San Diego hasta $60.000\n[8/28/26, 9:01:00 a. m.] Corredor: Vendo Casa San Diego precio $55.000 3 habitaciones 2 baños';
  const result=processChatText(chat,'TEST',{maxAgeDays:60,now:Date.parse(now),sourceChannel:'primary_number'}),demands=processZipDemandMessages(result.demand_messages);
  assert.equal(demands.length,1);assert.equal(demands[0].origin,'MARKET');assert.equal(result.unique.length,1);
});

test('secondary request ingestion produce demand y listing sigue PROPERTY',()=>{
  const event=(messageId,text)=>({messageId,groupId:'120@g.us',groupName:'TEST',authorId:'58412@c.us',timestamp:now,receivedAt:now,messageType:'text',text,hasMedia:false,sourceType:'whatsapp_secondary',sourceChannel:'secondary_number'});
  const result=processSecondaryEvents([event('request-1','Solicito Casa San Diego hasta $60.000'),event('listing-1','Vendo Casa San Diego precio $55.000 3 habitaciones 2 baños 2 puestos')]);
  assert.equal(result.demands.length,1);assert.equal(result.demands[0].origin,'MARKET');assert.equal(result.records.length,1);
});

test('repost fiable no duplica demand y mirror legacy es determinista',()=>{
  const a=parseDemandRequest({text:'Solicito Casa San Diego hasta $60.000',messageId:'same',source_channel:'primary_number'},{origin:'MARKET'}),b=parseDemandRequest({text:'Solicito Casa San Diego hasta $60.000',messageId:'same',source_channel:'primary_number'},{origin:'MARKET'});
  assert.equal(a.id,b.id);assert.equal(new Map([a,b].map(x=>[x.id,x])).size,1);
  assert.deepEqual(legacyBuyerToClientDemand({id:'b1',name:'Ana',property_types:['Casa']}),legacyBuyerToClientDemand({id:'b1',name:'Ana',property_types:['Casa']}));
});

test('oportunidad idempotente, invalidación ARCHIVED y conservación de historial',()=>{
  const engine=new OpportunityEngine({clock:()=>Date.parse(now)}),first=engine.reconcile(matchDemandsToProperties([market],[P1]),[market]);
  assert.equal(first.opportunities.length,1);assert.equal(first.opportunities[0].opportunity_type,'BROKER_OWN_LISTING');
  const rerun=engine.reconcile(matchDemandsToProperties([market],[P1]),[market]);assert.equal(rerun.opportunities.length,1);
  const invalid=engine.reconcile(matchDemandsToProperties([market],[{...P1,status:'ARCHIVED'}]),[market]);
  assert.equal(invalid.opportunities[0].status,'INVALIDATED');assert.ok(invalid.events.some(x=>x.event_type==='OPPORTUNITY_INVALIDATED'));
});

test('price fuera de budget invalida y price drop reabre/actualiza',()=>{
  let clock=Date.parse(now),engine=new OpportunityEngine({clock:()=>clock});
  engine.reconcile(matchDemandsToProperties([client],[P1]),[client]);clock+=1000;
  engine.reconcile(matchDemandsToProperties([client],[{...P1,price_usd:70000}]),[client]);assert.equal([...engine.opportunities.values()][0].status,'INVALIDATED');clock+=1000;
  engine.reconcile(matchDemandsToProperties([client],[{...P1,price_usd:59000}]),[client]);assert.equal([...engine.opportunities.values()][0].status,'ACTIVE');assert.ok(engine.events.some(x=>x.event_type==='OPPORTUNITY_REOPENED'));
});

test('feature flag default OFF y backup V1/V2/V3 añade stores 0C sin perder legacy',()=>{
  assert.equal(radarDemandEngineEnabled({}),false);assert.equal(radarDemandEngineEnabled({RADAR_DEMAND_ENGINE_ENABLED:'true'}),true);
  for(const version of [1,2,3]){const snapshot=migrateBackupSnapshot({format:'radar-inmobiliario-backup',backup_version:version,schemaVersion:version,stores:{properties:[{id:'legacy'}],buyers:[{id:'b'}]}});assert.equal(snapshot.stores.properties.length,1);for(const name of ['clients','demands','match_runs','match_candidates','opportunities','opportunity_scores','opportunity_events'])assert.deepEqual(snapshot.stores[name],[]);}
  assert.ok(BACKUP_STORE_NAMES.includes('opportunities'));
});

test('migración 003 es aditiva y contiene contratos 0C',async()=>{
  const sql=await readFile(new URL('../db/migrations/003_phase_0c_demand_matching_opportunity.sql',import.meta.url),'utf8');
  for(const table of ['clients','demands','match_runs','match_candidates','opportunities','opportunity_scores'])assert.match(sql,new RegExp(`CREATE TABLE ${table}\\b`));
  assert.match(sql,/UNIQUE\(opportunity_type,demand_id,property_id\)/);assert.doesNotMatch(sql,/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);assert.match(sql,/^BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
});

test('UI comercial mínima expone demandas, mercado, oportunidades y explicaciones',async()=>{
  const [html,app]=await Promise.all([readFile(new URL('../index.html',import.meta.url),'utf8'),readFile(new URL('../app.js',import.meta.url),'utf8')]);
  for(const id of ['demandCommercialPanel','clientDemandList','marketDemandList','opportunityList'])assert.match(html,new RegExp(`id="${id}"`));
  for(const token of ['fit_score','evidence_score','availability_score','ready_score','row.reasons','row.gaps','row.conflicts'])assert.ok(app.includes(token));
});
