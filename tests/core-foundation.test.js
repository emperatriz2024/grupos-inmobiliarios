import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RadarCoreFoundation} from '../core/radar/foundation.js';
import {AdditiveIngestionCoordinator} from '../core/radar/legacy-adapters.js';
import {AtomicShadowTarget,assertSnapshotUnchanged,buildShadowExport,SHADOW_LEGACY_DB_NAME,validateLegacySnapshot} from '../core/radar/shadow-migration.js';
import {TerritoryOntology,trigalTerritorySeed} from '../core/radar/territory.js';

const channel=(core,type,role)=>core.createChannel({channel_type:type,account_role:role,mode:type==='WHATSAPP_ZIP'?'MANUAL':'AUTOMATIC'});
const thread=(core,ingestion_channel_id,id)=>core.upsertThread({id,ingestion_channel_id,external_thread_id:id,name:id});

test('mismo ZIP produce already_processed y no crea un segundo import_batch',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'group-zip');
  const first=await core.beginImportBatch({fileBytes:new TextEncoder().encode('zip fijo'),fileName:'grupo.zip',threadId:chat.id});
  const retry=await core.beginImportBatch({fileBytes:new TextEncoder().encode('zip fijo'),fileName:'grupo.zip',threadId:chat.id});
  assert.equal(first.status,'started');assert.equal(retry.status,'already_processed');assert.equal(core.importBatches.size,1);
});

test('retry del mismo mensaje y canal no duplica source_message',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'group-a');
  const input={source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'m1',raw_text:'Casa en venta',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'};
  assert.equal((await core.receiveSourceMessage(input)).duplicate,false);assert.equal((await core.receiveSourceMessage(input)).duplicate,true);assert.equal(core.messages.size,1);
});

test('ZIP primario y WhatsApp secundario convergen en un master y preservan dos sources',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),secondary=channel(core,'WHATSAPP_SECONDARY','SECONDARY_NUMBER');
  const zipThread=thread(core,zip.id,'zip-group'),secondaryThread=thread(core,secondary.id,'secondary-group'),correlation_id=core.id();
  const first=await core.receiveSourceMessage({source_thread_id:zipThread.id,ingestion_channel_id:zip.id,external_message_id:'zip-1',raw_text:'Apartamento Trigal Norte 80000',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'},{correlation_id});
  const second=await core.receiveSourceMessage({source_thread_id:secondaryThread.id,ingestion_channel_id:secondary.id,external_message_id:'secondary-1',raw_text:'Apartamento Trigal Norte 80000',classification:'PROPERTY',received_at:'2026-08-26T10:01:00Z'},{correlation_id});
  core.createOrLinkProperty({identity_key:'venta|apartamento|trigal-norte|80000',fields:{operation:'Venta',property_type:'Apartamento',price_usd:80000},source_message_id:first.message.id,correlation_id});
  core.createOrLinkProperty({identity_key:'venta|apartamento|trigal-norte|80000',fields:{operation:'Venta',property_type:'Apartamento',price_usd:80000},source_message_id:second.message.id,correlation_id});
  assert.equal(core.properties.size,1);assert.equal(core.propertySources.size,2);assert.deepEqual(new Set([...core.messages.values()].map(item=>item.ingestion_channel_id)),new Set([zip.id,secondary.id]));
});

test('falla secundaria no bloquea ZIP y falla Core usa legacy',async()=>{
  let zipCalls=0,secondaryCalls=0,legacyVisible=true;
  const coordinator=new AdditiveIngestionCoordinator({env:{RADAR_CORE_ENABLED:'true'},zipImport:async()=>{zipCalls++;return {ok:true};},secondaryImport:async()=>{secondaryCalls++;throw new Error('secondary_down');},coreWrite:async()=>{throw new Error('core_down');}});
  assert.deepEqual(await coordinator.importZip({}),{ok:true});assert.equal(zipCalls,1);assert.equal(legacyVisible,true);
  await assert.rejects(()=>coordinator.importSecondary({}),/secondary_down/);assert.equal(secondaryCalls,1);
});

test('DB_NAME legacy e IndexedDB permanecen sin cambio',async()=>{
  const source=await readFile(new URL('../db.js',import.meta.url),'utf8');
  assert.match(source,/const DB_NAME = 'grupos-inmobiliarios'/);assert.equal(SHADOW_LEGACY_DB_NAME,'grupos-inmobiliarios');assert.match(source,/indexedDB\.open\(DB_NAME, DB_VERSION\)/);
});

test('shadow export no modifica origen y conserva mappings legacy',()=>{
  const snapshot={format:'radar-inmobiliario-backup',db_name:'grupos-inmobiliarios',created_at:'2026-08-26T00:00:00Z',stores:{properties:[{id:'p1',price_usd:10}],source_posts:[{id:'s1',master_id:'p1',text:'fuente'}],zones:[{id:'z1',name:'Trigal'}]}};
  const before=structuredClone(snapshot),shadow=buildShadowExport(snapshot);assert.equal(assertSnapshotUnchanged(before,snapshot),true);assert.equal(shadow.master_properties[0].legacy_id,'p1');assert.equal(shadow.source_messages[0].legacy_master_id,'p1');
});

test('migración shadow inválida aborta sin resultado parcial',()=>{
  const target=new AtomicShadowTarget(),valid={format:'radar-inmobiliario-backup',db_name:'grupos-inmobiliarios',stores:{properties:[{id:'p1'}],source_posts:[{id:'s1'}]}};
  target.migrate(valid);const prior=structuredClone(target.current);assert.throws(()=>target.migrate(valid,{validate:()=>({valid:false,error:'forced_failure'})}),/forced_failure/);assert.deepEqual(target.current,prior);
  assert.equal(validateLegacySnapshot({...valid,stores:{properties:{bad:true}}}).valid,false);
});

test('dato ausente queda null y Evidence exige fuente real',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'facts');
  const received=await core.receiveSourceMessage({source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'f1',raw_text:'Casa sin precio',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'});
  const linked=core.createOrLinkProperty({identity_key:'casa-sin-precio',fields:{property_type:'Casa'},source_message_id:received.message.id});assert.equal(linked.property.price_usd,null);
  assert.throws(()=>core.observeFact({entity_type:'master_property',field_key:'price_usd',value_json:100}),/evidence_source_required/);
});

test('hecho canónico apunta a Evidence exacta y explica el valor seleccionado',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'canonical'),correlation_id=core.id();
  const received=await core.receiveSourceMessage({source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'canonical-1',raw_text:'Casa precio $90.000',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'},{correlation_id});
  const linked=core.createOrLinkProperty({identity_key:'canonical-property',fields:{},source_message_id:received.message.id,correlation_id});
  const observed=core.observeFact({entity_type:'master_property',entity_id:linked.property.id,field_key:'price_usd',value_json:90000,source_message_id:received.message.id,evidence_method:'description',confidence:0.98},{correlation_id});
  const canonical=core.selectCanonicalFact({property_id:linked.property.id,field_key:'price_usd',evidence_fact_id:observed.fact.id},{correlation_id,causation_id:observed.event.id});
  assert.equal(canonical.evidence_fact_id,observed.fact.id);assert.equal(linked.property.price_usd,90000);assert.equal(core.messages.get(received.message.id).raw_text,'Casa precio $90.000');
});

test('fecha futura conserva future_date_flag',async()=>{
  const core=new RadarCoreFoundation({clock:()=>Date.parse('2026-08-26T10:00:00Z')}),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'future');
  const result=await core.receiveSourceMessage({source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'future-1',raw_text:'Casa',classification:'PROPERTY',published_at:'2026-08-27T10:00:00Z',received_at:'2026-08-26T10:00:00Z'});assert.equal(result.message.future_date_flag,true);assert.equal(result.message.published_at,'2026-08-27T10:00:00Z');
});

test('ontología Trigal expande familia pero Trigal Norte no incluye Centro o Sur',()=>{
  const seed=trigalTerritorySeed(),ontology=new TerritoryOntology(seed),family=ontology.expand('Trigal').map(item=>item.id),north=ontology.expand('Trigal Norte').map(item=>item.id);
  assert.ok(family.includes('trigal-norte')&&family.includes('trigal-centro')&&family.includes('trigal-sur'));assert.deepEqual(north,['trigal-norte']);
});

test('link repetido no elimina sources y no duplica relación',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'multi');
  const received=await core.receiveSourceMessage({source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'multi-1',raw_text:'Casa',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'});
  const first=core.createOrLinkProperty({identity_key:'multi-property',fields:{},source_message_id:received.message.id});const retry=core.createOrLinkProperty({identity_key:'multi-property',fields:{},source_message_id:received.message.id});assert.equal(first.duplicateSource,false);assert.equal(retry.duplicateSource,true);assert.equal(core.propertySources.size,1);
});

test('sync mutation repetida se aplica una vez',()=>{
  const core=new RadarCoreFoundation(),device=core.registerDevice({device_name:'test'});let applied=0,input={mutation_id:core.id(),device_id:device.id,entity_type:'master_property',entity_id:core.id(),operation:'upsert',payload_json:{status:'ACTIVE'}};
  assert.equal(core.applyClientMutation(input,()=>applied++).duplicate,false);assert.equal(core.applyClientMutation(input,()=>applied++).duplicate,true);assert.equal(applied,1);assert.equal(core.syncChanges.length,1);
});

test('domain events son append-only y correlación enlaza source evidence property',async()=>{
  const core=new RadarCoreFoundation(),zip=channel(core,'WHATSAPP_ZIP','PRIMARY_NUMBER'),chat=thread(core,zip.id,'events'),correlation_id=core.id();
  const received=await core.receiveSourceMessage({source_thread_id:chat.id,ingestion_channel_id:zip.id,external_message_id:'event-1',raw_text:'Casa $100',classification:'PROPERTY',received_at:'2026-08-26T10:00:00Z'},{correlation_id});
  const observed=core.observeFact({entity_type:'property_candidate',field_key:'price_usd',value_json:100,source_message_id:received.message.id},{correlation_id,causation_id:received.event.id});
  core.createOrLinkProperty({identity_key:'events-property',fields:{price_usd:100},source_message_id:received.message.id,correlation_id,causation_id:observed.event.id});
  const chain=core.events.list({correlation_id});assert.ok(chain.some(item=>item.event_type==='SOURCE_MESSAGE_RECEIVED'));assert.ok(chain.some(item=>item.event_type==='FACT_EXTRACTED'));assert.ok(chain.some(item=>item.event_type==='PROPERTY_MASTER_CREATED'));assert.throws(()=>core.events.update(),/append_only/);assert.throws(()=>core.events.delete(),/append_only/);
});

test('cobertura gradual conserva fallback ZIP',()=>{
  const core=new RadarCoreFoundation(),coverage=core.setGroupCoverage({group_identifier:'grupo-1',group_name:'Grupo 1',coverage_status:'DUAL',secondary_available:true});assert.equal(coverage.zip_available,true);assert.equal(coverage.zip_fallback_enabled,true);assert.equal(coverage.coverage_status,'DUAL');
});
