import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPriceDetailed,extractStructuredFieldsDetailed} from '../engine.js';
import {consolidateProperties,comparePropertyCandidates} from '../dedupe-utils.js';
import {scoreBuyerMaster} from '../buyer-utils.js';
import {cleanPhone} from '../contact-utils.js';
import {propertyDisplayName} from '../core/property-policy.js';
import {migrateBackupSnapshot,validateBackupSnapshot} from '../db.js';
import {SecondaryWhatsAppSource} from '../ingestion/source-ingestion.js';

test('precio principal $130.000 no es reemplazado por otro número',()=>{
  const r=extractPriceDetailed('Apartamento en venta\nPrecio: $130.000\nCódigo interno: 70.000','Venta');
  assert.equal(r.value,130000);assert.equal(r.status,'ok');assert.match(r.evidence,/130\.000/);
});

test('código 25-8282 no se interpreta como precio',()=>{
  const r=extractPriceDetailed('Código: 25-8282\nPrecio: $75.000\nApartamento en venta','Venta');
  assert.equal(r.value,75000);assert.ok(!r.candidates.some(x=>x.value===258282||x.value===258282000));
});

test('área 144 m² conserva evidencia',()=>{
  const r=extractStructuredFieldsDetailed('Área 144 m²');assert.equal(r.area_m2.value,144);assert.match(r.area_m2.evidence,/144/);
});

test('2 habitaciones + estudio no suma el estudio',()=>{
  const r=extractStructuredFieldsDetailed('Habitaciones: 2 + estudio');
  assert.equal(r.bedrooms.value,2);assert.equal(r.study.value,true);assert.equal(r.study_as_bedroom.value,false);
});

test('estacionamiento 2 puestos',()=>{
  const r=extractStructuredFieldsDetailed('Estacionamiento: 2 puestos');assert.equal(r.parking.value,2);
});

test('propiedad sin precio queda desconocida',()=>{
  const r=extractPriceDetailed('Apartamento de tres habitaciones con piscina','Venta');assert.equal(r.value,null);assert.equal(r.confidence,'missing');
});

test('cinco apariciones idénticas producen un maestro con cinco fuentes',()=>{
  const rows=Array.from({length:5},(_,i)=>({id:`p${i}`,text:'Apartamento venta Residencias Sol 3 habitaciones 2 baños Precio $75.000',property_type:'Apartamento',zone:'El Parral',residence:'Residencias Sol',price_usd:75000,bedrooms:3,bathrooms:2,parking:2,sender:'María',group:`G${i}`,date_iso:`2026-08-${String(10+i).padStart(2,'0')}`,sources:[{sender:'María',group:`G${i}`,date_iso:`2026-08-${String(10+i).padStart(2,'0')}`}]}));
  const result=consolidateProperties(rows);assert.equal(result.length,1);assert.equal(result[0].sources.length,5);
});

test('dos unidades del mismo edificio no se fusionan solo por edificio',()=>{
  const a={id:'a',text:'Apartamento piso 3 cocina blanca',property_type:'Apartamento',zone:'El Parral',residence:'Residencias Sol',area_m2:100,bedrooms:3,bathrooms:2,parking:2,price_usd:80000,sender:'A'};
  const b={id:'b',text:'Apartamento piso 9 cocina gris',property_type:'Apartamento',zone:'El Parral',residence:'Residencias Sol',area_m2:140,bedrooms:4,bathrooms:3,parking:3,price_usd:120000,sender:'B'};
  assert.equal(comparePropertyCandidates(a,b).automatic,false);assert.equal(consolidateProperties([a,b]).length,2);
});

test('comprador exige 2 puestos y dato ausente nunca obtiene 100%',()=>{
  const match=scoreBuyerMaster({property_types:['Apartamento'],operation:'Venta',min_parking:2,max_price:100000},{property_type:'Apartamento',operation:'Venta',parking:null,price_usd:90000,status:'active_unverified',last_seen_at:new Date().toISOString()});
  assert.ok(match);assert.equal(match.match_kind,'por_verificar');assert.ok(match.score<100);assert.match(match.gaps.join(' '),/Puestos: dato por verificar/);
});

test('respaldo V1 migra a V3 sin perder fuentes',()=>{
  const old={format:'radar-inmobiliario-backup',backup_version:1,created_at:'2026-01-01T00:00:00Z',stores:{source_posts:[{id:'s1',source_type:'whatsapp',published_at:'2026-01-01'}]}};
  const next=migrateBackupSnapshot(old);assert.equal(next.schemaVersion,3);assert.equal(next.stores.source_posts.length,1);assert.equal(next.stores.source_posts[0].sourceType,'whatsapp_zip');assert.deepEqual(next.stores.requests,[]);assert.deepEqual(next.stores.selections,[]);assert.equal(validateBackupSnapshot(next).valid,true);
});

test('teléfonos venezolanos equivalentes se normalizan igual',()=>{
  assert.equal(cleanPhone('0414-123-4567'),cleanPhone('+58 414 123 4567'));assert.equal(cleanPhone('0058 414 123 4567'),'584141234567');
});

test('nombre nunca usa fragmentos absurdos',()=>{
  assert.equal(propertyDisplayName({residence:'pecto a los servicios',property_type:'Apartamento',zone:'La Trigaleña'}),'Apartamento · La Trigaleña');
  assert.notEqual(propertyDisplayName({residence:'revestido',property_type:'Casa',zone:'Mañongo'}),'revestido');
});

test('WhatsApp secundario declara capacidad no configurada',async()=>{
  const source=new SecondaryWhatsAppSource();assert.equal(source.capability().available,false);await assert.rejects(()=>source.ingest(),/no está configurado/i);
});
