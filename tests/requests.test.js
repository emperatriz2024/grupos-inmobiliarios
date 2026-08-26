import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRequestToMasters, newMatchingMasterIds, parseRequestText } from '../request-utils.js';
import { buildPublicSelection, publicSelectionAvailable, sanitizePublicProperty } from '../selection-utils.js';
import { createSelectionHandler } from '../netlify/functions/selections.js';

const catalog={municipalities:[],complexes:[],zones:[
  {id:'manongo',nombre:'Mañongo'},{id:'el-parral',nombre:'El Parral'},
  {id:'lomas-del-este',nombre:'Lomas del Este'},{id:'el-bosque',nombre:'El Bosque'}
]};
const master=(id,patch={})=>({id,operation:'Venta',property_type:'Casa',zone_id:'manongo',zone:'Mañongo',price_usd:100000,bedrooms:3,bathrooms:2,parking:2,status:'active_unverified',source_types:['whatsapp'],last_seen_at:new Date().toISOString(),...patch});

test('solicitud A: locales hasta $40.000 respeta tipo y máximo estricto',()=>{
  const parsed=parseRequestText('Solicito locales en venta hasta $40.000.',catalog);
  const rows=[master('ok',{property_type:'Local comercial',price_usd:40000}),master('over',{property_type:'Local comercial',price_usd:41000}),master('house',{price_usd:35000})];
  const matches=matchRequestToMasters(parsed.criteria,rows);
  assert.deepEqual(matches.exact.map(x=>x.master_id),['ok']);
});

test('solicitud B: casa o townhouse acepta cuatro zonas y tope $150.000',()=>{
  const parsed=parseRequestText('Busco casa o townhouse en Mañongo, El Parral, Lomas del Este y El Bosque hasta $150.000.',catalog);
  assert.deepEqual(new Set(parsed.criteria.property_types),new Set(['Casa','Townhouse']));
  assert.equal(parsed.criteria.max_price,150000);
  assert.equal(parsed.criteria.zone_ids.length,4);
  const rows=[master('a'),master('b',{property_type:'Townhouse',zone_id:'el-parral',zone:'El Parral',price_usd:150000}),master('c',{zone_id:'el-bosque',price_usd:170000})];
  assert.deepEqual(matchRequestToMasters(parsed.criteria,rows).exact.map(x=>x.master_id).sort(),['a','b']);
});

test('solicitud siempre se ejecuta sobre maestros únicos, no source posts',()=>{
  const request={operation:'Venta',property_types:['Casa'],max_price:150000};
  const matches=matchRequestToMasters(request,[master('one',{source_count:3})]);
  assert.equal(matches.exact.length,1);assert.equal(matches.exact[0].master.source_count,3);
});

test('propiedad sin precio va a por verificar con máximo obligatorio',()=>{
  const matches=matchRequestToMasters({operation:'Venta',property_types:['Casa'],max_price:150000},[master('unknown',{price_usd:null})]);
  assert.equal(matches.exact.length,0);assert.equal(matches.verify.length,1);
});

test('vigencia confirmada requerida separa inventario no verificado',()=>{
  const matches=matchRequestToMasters({operation:'Venta',property_types:['Casa'],vigency_requirement:'verified'},[master('unverified')]);
  assert.equal(matches.exact.length,0);assert.equal(matches.verify.length,1);assert.match(matches.verify[0].gaps.join(' '),/Disponibilidad por confirmar/);
});

test('selección pública contiene exactamente los maestros elegidos y elimina datos internos',()=>{
  const masters=[master('a',{agent_phone:'584120000000',probable_captor_name:'Privado',source_posts:[{text:'privado'}],public_description:'Casa lista'}),master('b'),master('c')];
  const payload=buildPublicSelection({master_property_ids:['a','c'],title:'Opciones'},masters);
  assert.equal(payload.properties.length,2);assert.equal(payload.properties.some(x=>'id' in x),false);
  assert.equal('agent_phone' in payload.properties[0],false);assert.equal('probable_captor_name' in payload.properties[0],false);assert.equal('source_posts' in payload.properties[0],false);
});

test('selección de ocho propiedades publica exactamente ocho',()=>{
  const masters=Array.from({length:10},(_,index)=>master(`m${index}`));
  const payload=buildPublicSelection({master_property_ids:masters.slice(0,8).map(x=>x.id)},masters);
  assert.equal(payload.properties.length,8);
});

test('link desactivado o expirado deja de estar disponible',()=>{
  assert.equal(publicSelectionAvailable({status:'disabled'}),false);
  assert.equal(publicSelectionAvailable({status:'active',expires_at:'2020-01-01T00:00:00Z'}),false);
});

test('propiedad ya enviada no vuelve a marcarse como nueva aunque reaparezca',()=>{
  const matches={exact:[{master_id:'old'},{master_id:'new'}],verify:[],alternatives:[]};
  assert.deepEqual(newMatchingMasterIds(matches,['old']),['new']);
});

test('sanitización pública usa lista positiva de campos',()=>{
  const out=sanitizePublicProperty(master('x',{group_name:'Grupo privado',sender_phone:'0412',internal_notes:'no publicar'}));
  assert.equal(out.group_name,undefined);assert.equal(out.sender_phone,undefined);assert.equal(out.internal_notes,undefined);
});

test('API pública exige auth para publicar y conserva lectura anónima',async()=>{
  const memory=new Map(),store={get:async key=>memory.get(key)||null,setJSON:async(key,value)=>memory.set(key,value)};
  const handler=createSelectionHandler({getStoreImpl:()=>store,env:{RADAR_SELECTION_ADMIN_TOKEN:'test-secret'}});
  const denied=await handler(new Request('https://example.test/api/selections',{method:'POST',body:'{}'}));assert.equal(denied.status,401);
  const created=await handler(new Request('https://example.test/api/selections',{method:'POST',headers:{authorization:'Bearer test-secret','content-type':'application/json'},body:JSON.stringify({title:'Ocho',properties:[master('a')]})}));
  assert.equal(created.status,201);const info=await created.json();
  const read=await handler(new Request(`https://example.test/api/selections/${info.slug}`));assert.equal(read.status,200);assert.equal((await read.json()).properties.length,1);
  const updated=await handler(new Request(`https://example.test/api/selections/${info.slug}`,{method:'PUT',headers:{authorization:'Bearer test-secret','content-type':'application/json'},body:JSON.stringify({title:'Ahora seis',properties:Array.from({length:6},(_,index)=>master(`u${index}`))})}));
  assert.equal(updated.status,200);assert.equal((await updated.json()).slug,info.slug);
  const reread=await handler(new Request(`https://example.test/api/selections/${info.slug}`));assert.equal((await reread.json()).properties.length,6);
  const disabled=await handler(new Request(`https://example.test/api/selections/${info.slug}`,{method:'DELETE',headers:{authorization:'Bearer test-secret'}}));assert.equal(disabled.status,200);
  assert.equal((await handler(new Request(`https://example.test/api/selections/${info.slug}`))).status,404);
});

test('API rechaza escritura sin auth antes de inicializar Blobs',async()=>{
  const handler=createSelectionHandler({getStoreImpl:()=>{throw new Error('store should not initialize');},env:{RADAR_SELECTION_ADMIN_TOKEN:'secret'}});
  const response=await handler(new Request('https://example.test/api/selections',{method:'POST',body:'{}'}));
  assert.equal(response.status,401);
});
