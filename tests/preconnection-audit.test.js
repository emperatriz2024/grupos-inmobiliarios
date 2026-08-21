import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPriceDetailed,extractProperty} from '../engine.js';
import {propertyDisplayName} from '../core/property-policy.js';
import {groupConsecutiveEvents,processSecondaryEvents} from '../ingestion/secondary-processing.js';
import {consolidateProperties} from '../dedupe-utils.js';

const baseTime='2026-08-20T12:00:00.000Z';
const event=(id,text,extra={})=>({messageId:id,groupId:'audit@g.us',groupName:'Grupo auditoría',authorId:'publisher@lid',authorIdentifier:'publisher@lid',authorDisplayName:'Publicador observado',timestamp:baseTime,receivedAt:baseTime,messageType:'chat',text,hasMedia:false,...extra});

test('histórico: precio actual 130.000 prevalece sobre precio anterior 70.000',()=>{
  const price=extractPriceDetailed('Apartamento en venta\nPrecio anterior $70.000\nPrecio actual $130.000','Venta');assert.equal(price.value,130000);assert.equal(price.status,'ok');
});

test('histórico: título basura no se convierte en nombre del inmueble',()=>{
  assert.equal(propertyDisplayName({residence:'pecto a los servicios',property_type:'Apartamento',zone:'Mañongo'}),'Apartamento · Mañongo');assert.notEqual(propertyDisplayName({residence:'revestido',property_type:'Casa',zone:'El Trigal'}),'revestido');
});

test('histórico: precio no explícito permanece no detectado',()=>{
  const parsed=extractProperty({group:'G',sender:'A',date:'8/20/2026',date_iso:'2026-08-20',time:'12:00:00',text:'Apartamento amplio en venta con tres habitaciones y piscina'});assert.ok(parsed);assert.equal(parsed.price_usd,null);assert.equal(parsed.price_confidence,'missing');
});

test('autor observado se conserva como publisher y no se afirma captador',()=>{
  const parsed=processSecondaryEvents([event('publisher','Apartamento en venta Mañongo 3 habitaciones 2 baños Precio $75.000')]).records[0];assert.equal(parsed.publisher.role,'publisher_observed');assert.equal(parsed.publisher.observed_identifier,'publisher@lid');assert.equal(parsed.probable_captor_id,undefined);assert.equal(parsed.captor_score,undefined);
});

test('multimensaje conserva mismo autor/grupo y separa autor o intervalo incompatibles',()=>{
  const title=event('one','Apartamento en Mañongo'),details=event('two','3 hab 2 baños',{timestamp:'2026-08-20T12:00:05Z'}),price=event('three','$75.000',{timestamp:'2026-08-20T12:00:10Z'});
  assert.equal(groupConsecutiveEvents([title,details,price]).length,1);
  assert.equal(groupConsecutiveEvents([title,{...details,authorId:'other@lid',authorIdentifier:'other@lid'}]).length,2);
  assert.equal(groupConsecutiveEvents([title,{...details,timestamp:'2026-08-20T12:10:00Z'}]).length,2);
});

test('carga representativa consolida 7.000 fuentes en ~1.400 maestros',()=>{
  const records=[];for(let master=0;master<1400;master++)for(let source=0;source<5;source++)records.push({id:`${master}-${source}`,text:`Apartamento venta Residencias Audit ${master} 3 habitaciones 2 baños 2 puestos Precio $${75000+master}`,property_type:'Apartamento',zone:'Mañongo',residence:`Residencias Audit ${master}`,area_m2:100+(master%20),bedrooms:3,bathrooms:2,parking:2,price_usd:75000+master,sender:'Agente auditoría',date_iso:`2026-08-${String(20-source).padStart(2,'0')}`,sources:[{group:`G${source}`,sender:'Agente auditoría',date_iso:`2026-08-${String(20-source).padStart(2,'0')}`,time:'12:00:00'}]});
  const started=performance.now(),masters=consolidateProperties(records),elapsedMs=performance.now()-started;assert.equal(records.length,7000);assert.equal(masters.length,1400);assert.equal(masters.reduce((sum,x)=>sum+x.sources.length,0),7000);assert.ok(elapsedMs<15000,`carga 1400/7000 tardó ${elapsedMs} ms`);
});
