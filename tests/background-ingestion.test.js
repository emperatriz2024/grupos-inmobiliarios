import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatch,batchStatus,createMemoryJobStore,processJob,resultChunk,retryJob} from '../ingestion/background-jobs.js';
import {readFile} from 'node:fs/promises';

function storedZip(name,text){const enc=new TextEncoder(),n=enc.encode(name),d=enc.encode(text),local=30+n.length+d.length,central=46+n.length,total=local+central+22,b=new Uint8Array(total),v=new DataView(b.buffer);let p=0;v.setUint32(p,0x04034b50,true);v.setUint16(p+4,20,true);v.setUint32(p+18,d.length,true);v.setUint32(p+22,d.length,true);v.setUint16(p+26,n.length,true);b.set(n,p+30);b.set(d,p+30+n.length);p=local;v.setUint32(p,0x02014b50,true);v.setUint16(p+4,20,true);v.setUint16(p+6,20,true);v.setUint32(p+20,d.length,true);v.setUint32(p+24,d.length,true);v.setUint16(p+28,n.length,true);b.set(n,p+46);p+=central;v.setUint32(p,0x06054b50,true);v.setUint16(p+8,1,true);v.setUint16(p+10,1,true);v.setUint32(p+12,central,true);v.setUint32(p+16,local,true);return b;}
const chat=count=>Array.from({length:count},(_,i)=>`[8/30/26, 10:${String(i%60).padStart(2,'0')}:00 a. m.] A${i}: Apartamento venta Torre Worker ${i}\nPrecio $${75000+i}\n2 habitaciones`).join('\n');

test('18 ZIP server-side: progreso persistente, aislamiento, retry y sin duplicados',async()=>{
  const store=createMemoryJobStore(),entries=Array.from({length:18},(_,i)=>({name:`chat-${i+1}.zip`,path:`/CHAT_PENDIENTES/chat-${i+1}.zip`})),files=new Map(entries.map((entry,i)=>[entry.path,storedZip('_chat.txt',chat(i===0?1105:i===1?500:2))])),moves=[],failedPath=entries[5].path;let failOnce=true;
  const dropbox={download:async path=>files.get(path),move:async(path,name)=>{if(path===failedPath&&failOnce){failOnce=false;throw new Error('move_temporal');}moves.push(name);}};
  const {batch,jobs}=await createBatch(entries,{store,buildSha:'test-sha'});
  await Promise.all(jobs.map(job=>processJob(job.id,{store,dropbox,chunkSize:250,clock:()=>Date.parse('2026-08-31T12:00:00Z')})));
  let state=await batchStatus(batch.id,{store});assert.equal(state.completed,17);assert.equal(state.failed,1);assert.equal(state.total,18);
  const failed=state.jobs.find(row=>row.status==='FAILED');assert.equal(failed.result_chunks>0,true);await retryJob(failed.id,{store});await processJob(failed.id,{store,dropbox,chunkSize:250});
  state=await batchStatus(batch.id,{store});assert.equal(state.completed,18);assert.equal(state.failed,0);assert.equal(new Set(moves).size,18);assert.equal(moves.length,18);
  const large=state.jobs[0];assert.equal(large.result_summary.unique>1100,true);assert.equal((await resultChunk(large.id,0,{store})).properties.length,250);
  const reopened=await batchStatus(batch.id,{store});assert.equal(reopened.completed,18);assert.equal(reopened.build_sha,'test-sha');
});

test('file_hash completado evita reprocesar ZIP duplicado',async()=>{
  const store=createMemoryJobStore(),bytes=storedZip('_chat.txt',chat(3)),entries=[{name:'a.zip',path:'/a.zip'},{name:'b.zip',path:'/b.zip'}],moves=[];let downloads=0;
  const dropbox={download:async()=>{downloads++;return bytes;},move:async(_path,name)=>moves.push(name)},created=await createBatch(entries,{store});await processJob(created.jobs[0].id,{store,dropbox,clock:()=>Date.parse('2026-08-31T12:00:00Z')});const second=await processJob(created.jobs[1].id,{store,dropbox,clock:()=>Date.parse('2026-08-31T12:00:00Z')});assert.equal(second.duplicate,true);assert.equal(second.job.result_chunks,0);assert.deepEqual(moves,['a.zip','b.zip']);assert.equal(downloads,2);
});

test('cliente worker no borra ni reemplaza IndexedDB existente',async()=>{const source=await readFile(new URL('../app.js',import.meta.url),'utf8'),block=source.slice(source.indexOf('async function applyWorkerResults'),source.indexOf('async function monitorIngestionBatch'));assert.match(block,/mergeProperties/);assert.match(block,/saveImportCheckpoint/);assert.doesNotMatch(block,/clear\(|deleteDatabase|restoreDatabaseSnapshot/);assert.match(source,/INGESTION_BATCH_KEY/);assert.match(source,/build_sha/);});
