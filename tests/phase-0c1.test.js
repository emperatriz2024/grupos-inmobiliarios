import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MARKET_DEMAND_ACTIVE_DAYS,parseDemandRequest,consolidateMarketDemands,legacyBuyerToClientDemand,evaluateDemandProperty,isDemandActive,matchDemandsToProperties,matchPrefilteredCandidates,OpportunityEngine} from '../core/radar/demand-engine.js';

const day=86400000,t0=Date.parse('2026-08-01T12:00:00Z');
const own={id:'p-own',status:'ACTIVE',ownership_scope:'OWN',operation:'Venta',property_type:'Casa',municipality_id:'san-diego',price_usd:55000,last_seen_at:'2026-08-01T12:00:00Z'};
const client={id:'client-demand',origin:'CLIENT',status:'ACTIVE',operation:'Venta',property_types:['Casa'],municipality_ids:['san-diego'],max_price:60000};
const marketRequest=(messageId,requester,observedAt=t0)=>parseDemandRequest({text:'Solicito Casa San Diego hasta $60.000',messageId,author_id:requester,group_id:'grupo-test',received_at:new Date(observedAt).toISOString(),source_channel:'secondary_number'},{origin:'MARKET'});

test('MARKET demand expira a 7 días por defecto',()=>{
  const demand=marketRequest('m1','requester-1');assert.equal(MARKET_DEMAND_ACTIVE_DAYS,7);assert.equal(Date.parse(demand.expires_at),t0+7*day);assert.equal(isDemandActive(demand,t0+7*day),true);assert.equal(isDemandActive(demand,t0+7*day+1),false);assert.equal(evaluateDemandProperty(demand,own,{now:t0+8*day}).classification,'REJECTED');
});

test('repost válido al día 5 renueva last_seen_at y expires_at preservando sources',()=>{
  const first=marketRequest('m1','requester-1'),initial=consolidateMarketDemands([first],[],[]),repost=marketRequest('m2','requester-1',t0+5*day),next=consolidateMarketDemands([repost],initial.demands,initial.sources);
  assert.equal(next.demands.length,1);assert.equal(Date.parse(next.demands[0].first_seen_at),t0);assert.equal(Date.parse(next.demands[0].last_seen_at),t0+5*day);assert.equal(Date.parse(next.demands[0].expires_at),t0+12*day);assert.equal(next.sources.length,2);assert.deepEqual(next.sources.map(x=>x.source_kind).sort(),['ORIGINAL','REPOST']);
});

test('paused buyer produce client y demand PAUSED; closed CLOSED; active ACTIVE',()=>{
  for(const [legacy,expected] of [['paused','PAUSED'],['closed','CLOSED'],['active','ACTIVE']]){const pair=legacyBuyerToClientDemand({id:`b-${legacy}`,name:'Ana',status:legacy});assert.equal(pair.client.status,expected);assert.equal(pair.demand.status,expected);}
  const paused=legacyBuyerToClientDemand({id:'paused',status:'paused',operation:'Venta',property_types:['Casa']}).demand;assert.equal(evaluateDemandProperty(paused,own).classification,'REJECTED');
});

test('mirror legacy conserva criterios de área y features',()=>{
  const buyer={id:'b',status:'active',min_area:100,max_area:200,required_features:['pozo'],desired_features:['piscina'],min_bedrooms:3,max_price:70000},demand=legacyBuyerToClientDemand(buyer).demand;
  for(const key of ['min_area','max_area','min_bedrooms','max_price'])assert.equal(demand[key],buyer[key]);assert.deepEqual(demand.required_features,['pozo']);assert.deepEqual(demand.desired_features,['piscina']);
});

test('area hard gates: known below REJECT y missing VERIFY',()=>{
  assert.equal(evaluateDemandProperty({...client,min_area:100},{...own,area_m2:90}).classification,'REJECTED');assert.equal(evaluateDemandProperty({...client,min_area:100},{...own,area_m2:null}).classification,'VERIFY');assert.equal(evaluateDemandProperty({...client,max_area:120},{...own,area_m2:130}).classification,'REJECTED');
});

test('required feature missing VERIFY e incompatible REJECT',()=>{
  assert.equal(evaluateDemandProperty({...client,required_features:['pozo']},{...own,pozo:false}).classification,'VERIFY');assert.equal(evaluateDemandProperty({...client,required_features:['pozo']},{...own,feature_evidence:{pozo:false}}).classification,'REJECTED');assert.equal(evaluateDemandProperty({...client,required_features:['pozo']},{...own,pozo:true}).classification,'EXACT');
});

test('desired feature missing no rechaza',()=>{assert.notEqual(evaluateDemandProperty({...client,desired_features:['piscina']},{...own,piscina:false}).classification,'REJECTED');});

test('mismo requester + messageId distinto consolida; requester distinto separa',()=>{
  const a=marketRequest('m1','requester-1'),b=marketRequest('m2','requester-1',t0+day),same=consolidateMarketDemands([a,b],[],[]);assert.equal(same.demands.length,1);assert.equal(same.sources.length,2);
  const other=marketRequest('m3','requester-2',t0+day),different=consolidateMarketDemands([a,other],[],[]);assert.equal(different.demands.length,2);assert.equal(different.sources.length,2);
});

test('demand provenance preserva contrato y raw source',()=>{
  const state=consolidateMarketDemands([marketRequest('m1','requester-1')],[],[]),source=state.sources[0];for(const key of ['demand_id','source_reference','source_channel','group_thread','requester_observed','observed_at','source_kind','raw_text'])assert.ok(source[key]);assert.equal(source.source_kind,'ORIGINAL');
});

test('cambio de criterios del mismo requester queda como UPDATE sin borrar original',()=>{
  const original=marketRequest('m1','requester-1'),changed=parseDemandRequest({text:'Solicito Casa San Diego hasta $70.000',messageId:'m2',author_id:'requester-1',received_at:new Date(t0+day).toISOString(),source_channel:'secondary_number'},{origin:'MARKET'}),state=consolidateMarketDemands([original,changed],[],[]);assert.equal(state.demands.length,2);assert.deepEqual(state.sources.map(x=>x.source_kind).sort(),['ORIGINAL','UPDATE']);
});

test('candidate prefilter reduce universo y trigger dirigido no evalúa todo',()=>{
  const demands=Array.from({length:20},(_,i)=>({...client,id:`d${i}`,property_types:[i?'Apartamento':'Casa']})),properties=Array.from({length:100},(_,i)=>({...own,id:`p${i}`,property_type:i?'Apartamento':'Casa'}));
  const directed=matchPrefilteredCandidates(demands,properties,{demandIds:['d0']});assert.equal(directed.stats.cartesian_universe,2000);assert.equal(directed.stats.scoped_demands,1);assert.equal(directed.stats.prefiltered_pairs,1);assert.ok(directed.stats.prefiltered_pairs<directed.stats.cartesian_universe);
});

test('targeted reconciliation no invalida oportunidad ajena',()=>{
  const d1={...client,id:'d1'},d2={...client,id:'d2'},p1={...own,id:'p1'},p2={...own,id:'p2'},engine=new OpportunityEngine({clock:()=>t0});engine.reconcile(matchDemandsToProperties([d1,d2],[p1,p2]),[d1,d2]);
  const before=[...engine.opportunities.values()].find(x=>x.demand_id==='d2'&&x.property_id==='p2');engine.reconcile([],[d1,d2],{full:false,propertyIds:['p1']});assert.equal(engine.opportunities.get(before.id).status,'ACTIVE');assert.ok([...engine.opportunities.values()].filter(x=>x.property_id==='p1').every(x=>x.status==='INVALIDATED'));
});

test('004 es aditiva y declara lifecycle, EXPIRED y demand_sources',async()=>{
  const sql=await readFile(new URL('../db/migrations/004_phase_0c1_demand_hardening.sql',import.meta.url),'utf8');for(const field of ['first_seen_at','last_seen_at','expires_at'])assert.match(sql,new RegExp(`ADD COLUMN ${field}`));assert.match(sql,/CREATE TABLE demand_sources/);assert.match(sql,/EXPIRED/);assert.doesNotMatch(sql,/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);assert.match(sql,/^BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
});
