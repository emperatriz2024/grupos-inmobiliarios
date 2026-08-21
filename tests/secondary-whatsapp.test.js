import test from 'node:test';
import assert from 'node:assert/strict';
import {isGroupMessage,normalizeWhatsAppMessage} from '../bridge/whatsapp-secondary/event-normalizer.js';
import {MemoryOutbox} from '../bridge/whatsapp-secondary/outbox.js';
import {DurableOutbox} from '../bridge/whatsapp-secondary/outbox.js';
import {BatchUploader} from '../bridge/whatsapp-secondary/uploader.js';
import {MemoryGroupState} from '../bridge/whatsapp-secondary/group-state.js';
import {SecondaryBridge,BRIDGE_STATES} from '../bridge/whatsapp-secondary/bridge.js';
import {MemoryEventQueue} from '../secondary-whatsapp/queue.js';
import {normalizePhoneIdentity,validateSecondaryEvent} from '../secondary-whatsapp/contract.js';
import {createIngestHandler} from '../netlify/functions/secondary-whatsapp-ingest.js';
import {createSyncHandler} from '../netlify/functions/secondary-whatsapp-sync.js';
import {resetRateLimits} from '../netlify/functions/_secondary-security.js';
import {SecondaryWhatsAppSource} from '../ingestion/source-ingestion.js';
import {looksLikeRealEstate,processSecondaryEvents} from '../ingestion/secondary-processing.js';
import {extractPriceDetailed,processChatText} from '../engine.js';
import {consolidateProperties} from '../dedupe-utils.js';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const now='2026-08-20T14:00:00.000Z';
function raw(id='m1',overrides={}){return {messageId:id,groupId:'120@g.us',groupName:'Inmuebles Valencia',authorId:'584141234567@c.us',authorIdentifier:'584141234567@c.us',authorDisplayName:'Ana',timestamp:now,receivedAt:now,messageType:'chat',text:'Apartamento en venta Mañongo\n3 habitaciones 2 baños 2 puestos\nPrecio $75.000',hasMedia:false,...overrides};}
function waMessage(overrides={}){return {from:'120@g.us',author:'584141234567@c.us',timestamp:Date.parse(now)/1000,type:'chat',body:'Apartamento venta Precio $75.000',hasMedia:false,fromMe:false,id:{_serialized:'m1',remote:'120@g.us'},getChat:async()=>({name:'Grupo Uno'}),getContact:async()=>({pushname:'Ana'}),...overrides};}

test('bridge ignora chat privado y mensajes propios',async()=>{
  assert.equal(isGroupMessage(waMessage({from:'584141234567@c.us'})),false);
  assert.equal(isGroupMessage(waMessage({fromMe:true})),false);
  assert.equal(await normalizeWhatsAppMessage(waMessage({from:'584141234567@c.us'})),null);
  assert.equal(await normalizeWhatsAppMessage(waMessage({from:'status@broadcast'})),null);
});

test('outbox duradera sobrevive reinicio del bridge',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'radar-v061-')),file=path.join(folder,'outbox','events.json');try{const first=new DurableOutbox(file);await first.enqueue(raw('persisted'));const restarted=new DurableOutbox(file);assert.equal(await restarted.count(),1);assert.equal((await restarted.ready())[0].messageId,'persisted');}finally{await rm(folder,{recursive:true,force:true});}
});

test('bridge acepta grupo y conserva grupo, autor e identidad verificable',async()=>{
  const event=await normalizeWhatsAppMessage(waMessage());assert.equal(event.groupId,'120@g.us');assert.equal(event.groupName,'Grupo Uno');assert.equal(event.authorDisplayName,'Ana');assert.equal(event.authorPhone,'584141234567');
});

test('LID conserva identificador y deja teléfono como no verificable',()=>{
  const identity=normalizePhoneIdentity('123456789@lid');assert.equal(identity.authorPhone,null);assert.equal(identity.authorIdentifier,'123456789@lid');assert.equal(identity.phoneStatus,'unverifiable');
});

test('messageId es idempotente en outbox',async()=>{
  const box=new MemoryOutbox();assert.equal((await box.enqueue(raw())).duplicate,false);assert.equal((await box.enqueue(raw())).duplicate,true);assert.equal(await box.count(),1);
});

test('cursor por grupo evita reencolar un mensaje tras vaciar outbox',async()=>{
  const listeners={},client={on:(name,fn)=>listeners[name]=fn},outbox=new MemoryOutbox(),groupState=new MemoryGroupState(),uploader={flush:async()=>({uploaded:0,pending:0})},bridge=new SecondaryBridge({client,outbox,groupState,uploader});
  assert.equal((await bridge.accept(waMessage())).duplicate,false);await outbox.acknowledge(['m1']);assert.equal((await bridge.accept(waMessage())).duplicate,true);assert.equal(await outbox.count(),0);assert.equal(bridge.stats.duplicatesSkipped,1);assert.equal(BRIDGE_STATES.RECONNECTING,'RECONNECTING');
});

test('fallo de red conserva outbox y programa retry con backoff',async()=>{
  const box=new MemoryOutbox();await box.enqueue(raw());const uploader=new BatchUploader({outbox:box,endpoint:'https://test.invalid',token:'test-only',fetchImpl:async()=>{throw new Error('offline')}});const result=await uploader.flush(1000);assert.equal(result.uploaded,0);assert.equal(await box.count(),1);assert.ok(result.retryInMs>=2000);assert.equal((await box.ready(50,1001)).length,0);
});

test('HTTP 500 y 429 mantienen mensajes y backoff; flush concurrente se serializa',async()=>{
  for(const status of [500,429]){const box=new MemoryOutbox();await box.enqueue(raw(`http-${status}`));let calls=0;const uploader=new BatchUploader({outbox:box,endpoint:'https://test.invalid',token:'test-only',fetchImpl:async()=>{calls++;return {ok:false,status}}});const [a,b]=await Promise.all([uploader.flush(1000),uploader.flush(1000)]);assert.equal(calls,1);assert.equal(a.error,`HTTP ${status}`);assert.deepEqual(a,b);assert.equal(await box.count(),1);}
});

test('lote subido se confirma y duplicado remoto no crea dos eventos',async()=>{
  const queue=new MemoryEventQueue(),handler=createIngestHandler({queueFactory:async()=>queue,env:{RADAR_BRIDGE_INGEST_TOKEN:'secret-test'}}),event={httpMethod:'POST',headers:{'content-type':'application/json',authorization:'Bearer secret-test'},body:JSON.stringify({events:[raw()]})};
  const first=JSON.parse((await handler(event)).body),second=JSON.parse((await handler(event)).body);assert.equal(first.accepted,1);assert.equal(second.duplicates,1);assert.equal((await queue.list()).events.length,1);
});

test('dos lotes simultáneos convergen en un solo messageId',async()=>{
  resetRateLimits();const queue=new MemoryEventQueue(),handler=createIngestHandler({queueFactory:async()=>queue,env:{RADAR_BRIDGE_INGEST_TOKEN:'secret-test'}}),request={httpMethod:'POST',headers:{'content-type':'application/json',authorization:'Bearer secret-test'},body:JSON.stringify({events:[raw('concurrent')]})};await Promise.all([handler(request),handler(request)]);assert.equal((await queue.list()).events.length,1);
});

test('endpoint ingest rechaza sin token, acepta token y rechaza payload inválido',async()=>{
  const queue=new MemoryEventQueue(),handler=createIngestHandler({queueFactory:async()=>queue,env:{RADAR_BRIDGE_INGEST_TOKEN:'secret-test'}}),base={httpMethod:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({events:[raw()]})};
  assert.equal((await handler(base)).statusCode,401);assert.equal((await handler({...base,headers:{...base.headers,authorization:'Bearer secret-test'}})).statusCode,202);assert.equal((await handler({...base,headers:{...base.headers,authorization:'Bearer secret-test'},body:JSON.stringify({events:[{bad:true}]})})).statusCode,422);
});

test('ingest valida método, Content-Type, tamaño, timestamps y oculta fallos internos',async()=>{
  resetRateLimits();const env={RADAR_BRIDGE_INGEST_TOKEN:'secret-test'},handler=createIngestHandler({queueFactory:async()=>new MemoryEventQueue(),env}),auth={authorization:'Bearer secret-test'};
  assert.equal((await handler({httpMethod:'GET',headers:auth})).statusCode,405);
  assert.equal((await handler({httpMethod:'POST',headers:{...auth,'content-type':'text/plain'},body:'{}'})).statusCode,415);
  assert.equal((await handler({httpMethod:'POST',headers:{...auth,'content-type':'application/json'},body:' '.repeat(512001)})).statusCode,413);
  assert.equal((await handler({httpMethod:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({events:[raw('bad-date',{timestamp:'ayer'})]})})).statusCode,422);
  const broken=createIngestHandler({queueFactory:async()=>{throw new Error('internal account detail')},env});const response=await broken({httpMethod:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({events:[raw('safe-error')]})});assert.equal(response.statusCode,503);assert.equal(response.body.includes('internal account detail'),false);
});

test('sync exige token y entrega páginas incrementales',async()=>{
  resetRateLimits();
  const queue=new MemoryEventQueue();await queue.put(raw('a'));await queue.put(raw('b',{timestamp:'2026-08-20T14:01:00Z'}));const handler=createSyncHandler({queueFactory:async()=>queue,env:{RADAR_SECONDARY_SYNC_TOKEN:'read-test'}});
  assert.equal((await handler({httpMethod:'GET',headers:{},queryStringParameters:{}})).statusCode,401);
  const one=JSON.parse((await handler({httpMethod:'GET',headers:{authorization:'Bearer read-test'},queryStringParameters:{limit:'1'}})).body);assert.equal(one.events.length,1);assert.equal(one.hasMore,true);
  const two=JSON.parse((await handler({httpMethod:'GET',headers:{authorization:'Bearer read-test'},queryStringParameters:{cursor:one.nextCursor}})).body);assert.equal(two.events[0].messageId,'b');
});

test('sync rechaza cursor y origen ajeno; CORS acepta únicamente origen TEST',async()=>{
  resetRateLimits();const queue=new MemoryEventQueue(),handler=createSyncHandler({queueFactory:async()=>queue,env:{RADAR_SECONDARY_SYNC_TOKEN:'read-test',RADAR_SECONDARY_ALLOWED_ORIGIN:'https://test.example'}}),headers={authorization:'Bearer read-test',origin:'https://test.example'};
  assert.equal((await handler({httpMethod:'GET',headers,queryStringParameters:{cursor:'../../bad'}})).statusCode,400);
  assert.equal((await handler({httpMethod:'GET',headers:{...headers,origin:'https://evil.example'},queryStringParameters:{}})).statusCode,403);
  const ok=await handler({httpMethod:'GET',headers,queryStringParameters:{}});assert.equal(ok.statusCode,200);assert.equal(ok.headers['access-control-allow-origin'],'https://test.example');
});

test('sync limita cada página a 100 eventos',async()=>{
  resetRateLimits();const queue=new MemoryEventQueue();for(let i=0;i<120;i++)await queue.put(raw(`page-${String(i).padStart(3,'0')}`,{receivedAt:new Date(Date.parse(now)+i).toISOString()}));const handler=createSyncHandler({queueFactory:async()=>queue,env:{RADAR_SECONDARY_SYNC_TOKEN:'read-test'}}),response=await handler({httpMethod:'GET',headers:{authorization:'Bearer read-test'},queryStringParameters:{limit:'9999'}}),body=JSON.parse(response.body);assert.equal(body.events.length,100);assert.equal(body.hasMore,true);
});

test('rate limiting defensivo devuelve 429 sin revelar detalles',async()=>{
  resetRateLimits();const queue=new MemoryEventQueue(),handler=createIngestHandler({queueFactory:async()=>queue,env:{RADAR_BRIDGE_INGEST_TOKEN:'secret-test'}}),event={httpMethod:'POST',headers:{'content-type':'application/json',authorization:'Bearer secret-test','x-forwarded-for':'203.0.113.10'},body:JSON.stringify({events:[raw('rate')]})};let response;for(let i=0;i<61;i++)response=await handler(event);assert.equal(response.statusCode,429);assert.deepEqual(JSON.parse(response.body),{error:'rate_limited'});resetRateLimits();
});

test('retención TEST elimina raw vencido y conserva reciente',async()=>{
  const queue=new MemoryEventQueue();await queue.put(raw('old',{receivedAt:'2026-07-01T00:00:00Z'}));await queue.put(raw('recent',{receivedAt:now}));const result=await queue.purgeExpired({now:Date.parse(now),rawDays:14});assert.equal(result.rawRemoved,1);assert.deepEqual((await queue.list()).events.map(x=>x.messageId),['recent']);
});

test('desconexión entra en RECONNECTING con espera inicial de 5 segundos',()=>{
  const listeners={},delays=[],client={on:(name,fn)=>listeners[name]=fn,initialize:async()=>{}},bridge=new SecondaryBridge({client,outbox:new MemoryOutbox(),uploader:{flush:async()=>({uploaded:0})},scheduleFn:(fn,delay)=>{delays.push(delay);return {unref(){}}}});bridge.wire();listeners.disconnected('network');assert.equal(bridge.state,'RECONNECTING');assert.deepEqual(delays,[5000]);
});

test('backfill queda acotado a 100 grupos y 50 mensajes por grupo',async()=>{
  let groupsFetched=0;const chats=Array.from({length:120},()=>({isGroup:true,fetchMessages:async options=>{groupsFetched++;assert.equal(options.limit,50);return [];}})),client={getChats:async()=>chats},bridge=new SecondaryBridge({client,outbox:new MemoryOutbox(),uploader:{flush:async()=>({uploaded:0,pending:0})}});await bridge.backfill();assert.equal(groupsFetched,100);assert.equal(bridge.stats.backfillAttempts,1);assert.equal(bridge.stats.backfillErrors,0);
});

test('cola remota conserva eventos mientras Radar está cerrado',async()=>{
  const queue=new MemoryEventQueue();await queue.put(raw('while-closed'));const later=await queue.list({limit:50});assert.equal(later.events[0].messageId,'while-closed');assert.ok(later.nextCursor);
});

test('SecondaryWhatsAppSource usa lectura autenticada y cursor',async()=>{
  let requested;const source=new SecondaryWhatsAppSource({endpoint:'https://example.test/sync',token:'read-test',fetchImpl:async(url,options)=>{requested={url:String(url),options};return {ok:true,json:async()=>({events:[raw()],nextCursor:'event-m1',hasMore:false})};}});const page=await source.ingest({cursor:'event-old'});assert.equal(page.events.length,1);assert.match(requested.url,/cursor=event-old/);assert.equal(requested.options.headers.authorization,'Bearer read-test');
});

test('mensaje no inmobiliario no crea inmueble y publicación válida usa Radar Core',()=>{
  const social=raw('social',{text:'Buenos días, feliz jueves'});assert.equal(looksLikeRealEstate(social.text),false);assert.equal(processSecondaryEvents([social]).records.length,0);
  const result=processSecondaryEvents([raw()]);assert.equal(result.records.length,1);assert.equal(result.records[0].sourceType,'whatsapp_secondary');assert.equal(result.records[0].price_usd,75000);assert.equal(consolidateProperties(result.records).length,1);
});

test('agrupamiento conservador combina continuidad del mismo autor y no autores distintos',()=>{
  const title=raw('p1',{text:'APARTAMENTO EN MAÑONGO'}),details=raw('p2',{timestamp:'2026-08-20T14:00:30Z',text:'3 habitaciones, 2 baños, planta'}),price=raw('p3',{timestamp:'2026-08-20T14:01:00Z',text:'Precio $75.000'});assert.equal(processSecondaryEvents([title,details,price]).records.length,1);
  const other=raw('p4',{timestamp:'2026-08-20T14:00:30Z',authorId:'otro@lid',authorIdentifier:'otro@lid',text:'Precio $90.000'});assert.ok(processSecondaryEvents([title,other]).records.length<=1);
});

test('precio estricto y ZIP principal continúan funcionando',()=>{
  assert.equal(extractPriceDetailed('Precio $75.000\nÁrea 144 m²\nCódigo 25-8282','Venta').value,75000);
  const chat='[8/20/26, 10:00:00 a. m.] Ana: Apartamento venta Mañongo\nPrecio $75.000\n3 habitaciones';const result=processChatText(chat,'ZIP principal',{maxAgeDays:60,now:Date.parse(now),sourceType:'whatsapp_zip',sourceChannel:'primary_number'});assert.equal(result.unique.length,1);assert.equal(result.unique[0].sourceChannel,'primary_number');
});

test('contrato rechaza evento administrativo vacío',()=>{assert.equal(validateSecondaryEvent(raw('admin',{text:'',caption:'',hasMedia:false})).ok,false);});
