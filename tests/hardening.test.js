import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPriceDetailed,extractStructuredFieldsDetailed,processChatText} from '../engine.js';
import {comparePropertyCandidates,consolidateProperties} from '../dedupe-utils.js';
import {scoreBuyerMaster} from '../buyer-utils.js';
import {masterSnapshot,migrateBackupSnapshot,validateBackupSnapshot,BACKUP_STORE_NAMES} from '../db.js';
import {matchesFilters,formatMoney,whatsappNumber} from '../search-utils.js';
import {extractWhatsAppChat,decodeChat} from '../zip-reader.js';
import {adapterForUrl,safeExternalUrl,sourceTypeFromUrl} from '../external/adapters.js';
import {normalizePath,getAccessToken} from '../dropbox.js';

test('precio A: ignora área, habitaciones y teléfono',()=>{
  const r=extractPriceDetailed('Precio $130.000\nÁrea 70 m²\n2 habitaciones\n0414-1234567','Venta');
  assert.equal(r.value,130000);assert.equal(r.status,'ok');
});
test('precio B: código con guion nunca compite con $75.000',()=>{
  const r=extractPriceDetailed('25-8282 Precio $75.000','Venta');assert.equal(r.value,75000);
});
test('precio C: canon no mezcla depósito ni adelantados',()=>{
  const r=extractPriceDetailed('Canon $700\n3 meses depósito\n2 adelantados','Alquiler');assert.equal(r.value,700);assert.match(r.evidence,/Canon/i);
});
test('precio D: precio actual prevalece y anterior conserva evidencia',()=>{
  const r=extractPriceDetailed('Antes $90.000 ahora $82.000','Venta');
  assert.equal(r.value,82000);assert.equal(r.status,'ok');assert.ok(r.candidates.some(x=>x.value===90000&&x.role==='previous'));
});
test('precio E y F: ausencia o solo condominio queda desconocida',()=>{
  assert.equal(extractPriceDetailed('Apartamento amplio, consultar precio','Venta').value,null);
  assert.equal(extractPriceDetailed('Condominio $120\nApartamento en venta','Venta').value,null);
});

test('precio confirmado fluye parser → master → tarjeta/filtro → matching',()=>{
  const chat='[8/20/26, 10:00:00 a. m.] Ana: Apartamento en venta La Trigaleña\nPrecio $90.000\n3 habitaciones\n2 puestos';
  const result=processChatText(chat,'Grupo',{maxAgeDays:60,now:Date.parse('2026-08-20T15:00:00Z')});
  assert.equal(result.unique.length,1);const parsed=result.unique[0];assert.equal(parsed.price_usd,90000);
  const master=masterSnapshot(parsed,'m1');assert.equal(master.price_usd,90000);assert.match(formatMoney(master.price_usd),/90/);
  assert.equal(matchesFilters({...parsed,date_iso:'2026-08-20'},{max_price:100000}),true);
  const match=scoreBuyerMaster({operation:'Venta',property_types:['Apartamento'],max_price:100000,min_bedrooms:3,min_parking:2},master);
  assert.equal(match.match_kind,'estricto');assert.equal(match.score,100);
});

test('extracción distingue estudio, servicio, cero explícito y unknown',()=>{
  const a=extractStructuredFieldsDetailed('Área: 144 m²\nHabitaciones: 2 + Estudio\nBaños: 2 + servicio\nEstacionamiento: 2 puestos');
  assert.equal(a.area_m2.value,144);assert.equal(a.bedrooms.value,2);assert.equal(a.study.value,true);assert.equal(a.bathrooms.value,2);assert.equal(a.parking.value,2);
  const b=extractStructuredFieldsDetailed('3 habitaciones + habitación de servicio\nNo tiene puesto');
  assert.equal(b.bedrooms.value,3);assert.equal(b.service_bedroom.value,true);assert.equal(b.parking.value,0);assert.equal(b.parking.confidence,'high');
  assert.equal(extractStructuredFieldsDetailed('Apartamento con balcón').parking.value,null);
});

test('dedupe: teléfono+conjunto sin distribución no basta; con hechos sí',()=>{
  const base={property_type:'Apartamento',zone:'La Trigaleña',residence:'Residencias Sol',phone:'04141234567'};
  assert.equal(comparePropertyCandidates({...base,text:'Apartamento A'},{...base,text:'Apartamento B'}).automatic,false);
  const strong=comparePropertyCandidates({...base,text:'Apartamento 3 habitaciones 2 puestos Precio $90.000',bedrooms:3,parking:2,price_usd:90000},{...base,text:'Apartamento 3 habitaciones 2 puestos Precio $92.000',bedrooms:3,parking:2,price_usd:92000});
  assert.equal(strong.automatic,true);assert.equal(strong.level,'fuerte');
});
test('dedupe: municipio+tipo es débil y dos unidades mismo edificio/metraje no fusionan',()=>{
  const weak=comparePropertyCandidates({text:'Unidad piso bajo',property_type:'Apartamento',municipality:'Valencia'},{text:'Unidad piso alto',property_type:'Apartamento',municipality:'Valencia'});
  assert.equal(weak.automatic,false);assert.ok(weak.score<35);
  const a={id:'a',text:'Piso 2 cocina roja',property_type:'Apartamento',zone:'X',residence:'Torre Uno',area_m2:100,bedrooms:2,price_usd:70000};
  const b={id:'b',text:'Piso 9 cocina blanca',property_type:'Apartamento',zone:'X',residence:'Torre Uno',area_m2:100,bedrooms:3,price_usd:90000};
  assert.equal(consolidateProperties([a,b]).length,2);
});

test('matching: unknown verifica, completo llega a 100 y sobreprecio solo alternativa con tolerancia',()=>{
  const buyer={operation:'Venta',property_types:['Apartamento'],zone_ids:['trigalena'],max_price:100000,min_bedrooms:3,min_parking:2};
  const base={operation:'Venta',property_type:'Apartamento',zone_id:'trigalena',price_usd:90000,bedrooms:3,status:'active_unverified',last_seen_at:new Date().toISOString()};
  const unknown=scoreBuyerMaster(buyer,{...base,parking:null});assert.equal(unknown.match_kind,'por_verificar');assert.match(unknown.gaps.join(' '),/Puestos: dato por verificar/);
  const exact=scoreBuyerMaster(buyer,{...base,parking:2});assert.equal(exact.score,100);assert.equal(exact.match_kind,'estricto');
  assert.equal(scoreBuyerMaster(buyer,{...base,parking:2,price_usd:110000}),null);
  const alternative=scoreBuyerMaster({...buyer,budget_tolerance:10},{...base,parking:2,price_usd:110000});assert.equal(alternative.match_kind,'alternativa');assert.ok(alternative.score<70);
});

test('backup V1→V2 es idempotente, completo y rechaza tabla corrupta',()=>{
  const old={format:'radar-inmobiliario-backup',backup_version:1,created_at:'2026-08-20T00:00:00Z',stores:{buyers:[{id:'b1'}],source_posts:[{id:'s1',source_type:'instagram'}],complexes:[{id:'c1',aliases:['Torre 1']} ]}};
  const once=migrateBackupSnapshot(old),twice=migrateBackupSnapshot(once);
  assert.deepEqual(twice.stores,once.stores);assert.equal(validateBackupSnapshot(twice).valid,true);
  assert.equal(twice.stores.buyers.length,1);assert.equal(twice.stores.source_posts.length,1);assert.deepEqual(twice.stores.complexes[0].aliases,['Torre 1']);
  assert.ok(!BACKUP_STORE_NAMES.some(x=>/token|secret|password/i.test(x)));
  assert.throws(()=>migrateBackupSnapshot({...old,stores:{source_posts:{bad:true}}}),/dañada/);
});

test('adaptadores validan URL, metadata pública y fallan honestamente',async()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),null);assert.equal(safeExternalUrl('data:text/html,x'),null);
  assert.equal(sourceTypeFromUrl('https://articulo.mercadolibre.com.ve/MLV-123456789-x'),'mercadolibre');
  const adapter=adapterForUrl('https://example.com/listing');
  const ok=await adapter.analyze('https://example.com/listing',{fetchImpl:async()=>({ok:true,text:async()=>'<meta property="og:title" content="Casa segura"><meta property="og:description" content="Precio $80.000">'})});
  assert.equal(ok.ok,true);assert.equal(ok.title,'Casa segura');
  const blocked=await adapter.analyze('https://example.com/listing',{fetchImpl:async()=>{throw new Error('CORS')}});assert.equal(blocked.ok,false);assert.match(blocked.message,/no pudo leer/i);
});

test('Dropbox desconectado falla sin ninguna operación de datos',async()=>{
  const old=globalThis.localStorage;globalThis.localStorage={getItem:()=>null};
  try{await assert.rejects(()=>getAccessToken(),/no está conectado/i);assert.equal(normalizePath('CHAT_PENDIENTES/'),'/CHAT_PENDIENTES');}finally{globalThis.localStorage=old;}
});

function storedZip(name,text){
  const enc=new TextEncoder(),n=enc.encode(name),d=enc.encode(text),local=30+n.length+d.length,central=46+n.length,total=local+central+22,b=new Uint8Array(total),v=new DataView(b.buffer);let p=0;
  v.setUint32(p,0x04034b50,true);v.setUint16(p+4,20,true);v.setUint16(p+8,0,true);v.setUint32(p+18,d.length,true);v.setUint32(p+22,d.length,true);v.setUint16(p+26,n.length,true);b.set(n,p+30);b.set(d,p+30+n.length);p=local;
  v.setUint32(p,0x02014b50,true);v.setUint16(p+4,20,true);v.setUint16(p+6,20,true);v.setUint32(p+20,d.length,true);v.setUint32(p+24,d.length,true);v.setUint16(p+28,n.length,true);v.setUint32(p+42,0,true);b.set(n,p+46);p+=central;
  v.setUint32(p,0x06054b50,true);v.setUint16(p+8,1,true);v.setUint16(p+10,1,true);v.setUint32(p+12,central,true);v.setUint32(p+16,local,true);return b;
}
test('ZIP WhatsApp stored sigue legible y respeta ventana de 60 días',async()=>{
  const chat='[8/20/26, 10:00:00 a. m.] Ana: Apartamento venta\nPrecio $75.000\n2 habitaciones\n[5/1/26, 10:00:00 a. m.] Ana: Apartamento venta antiguo Precio $50.000';
  const bytes=storedZip('_chat.txt',chat),file={arrayBuffer:async()=>bytes.buffer};const extracted=await extractWhatsAppChat(file);assert.equal(decodeChat(extracted.bytes),chat);
  const result=processChatText(chat,'Grupo',{maxAgeDays:60,now:Date.parse('2026-08-20T12:00:00Z')});assert.equal(result.messages_skipped_age,1);assert.equal(result.unique.length,1);
});

test('chat grande se procesa de forma determinista y conserva metadata de canal',()=>{
  const lines=[];for(let i=0;i<3000;i++)lines.push(`[8/20/26, 10:${String(i%60).padStart(2,'0')}:00 a. m.] A${i}: Apartamento venta Torre ${i}\nPrecio $${75000+i}\n2 habitaciones`);
  const progress=[],start=performance.now(),result=processChatText(lines.join('\n'),'Grande',{maxAgeDays:60,now:Date.parse('2026-08-20T12:00:00Z'),sourceType:'whatsapp_zip',sourceChannel:'primary_number',onProgress:p=>progress.push(p)}),elapsed=performance.now()-start;
  assert.equal(result.messages,3000);assert.ok(result.unique.length>2500);assert.equal(result.unique[0].sourceType,'whatsapp_zip');assert.equal(result.unique[0].sourceChannel,'primary_number');assert.ok(progress.length>=12);assert.equal(progress.at(-1).done,3000);assert.ok(elapsed<15000,`procesamiento tardó ${elapsed} ms`);
});

test('wa.me normaliza variantes venezolanas sin enviar',()=>{
  assert.equal(whatsappNumber('04141234567'),'584141234567');assert.equal(whatsappNumber('+584141234567'),'584141234567');assert.equal(whatsappNumber('00584141234567'),'584141234567');
});
