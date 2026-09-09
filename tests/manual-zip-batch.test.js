import test from 'node:test';
import assert from 'node:assert/strict';
import {runManualZipBatch} from '../ingestion/manual-zip-batch.js';

const zip=(name,size=10)=>({name,size});
const completed=(added=1,updated=0)=>({summary:{added,updated,duplicates_detected:updated,status:'COMPLETED'}});

test('procesa un ZIP y mantiene compatibilidad individual',async()=>{
  const seen=[];
  const result=await runManualZipBatch([zip('uno.zip')],{importOneZip:async file=>{seen.push(file.name);return completed(2);}});
  assert.deepEqual(seen,['uno.zip']);
  assert.deepEqual(result.summary,{selected:1,processed:1,skipped:0,failed:0,added:2,updated:0,duplicates:0,pending:0});
});

test('procesa múltiples ZIP estrictamente en secuencia',async()=>{
  let active=0,maxActive=0;const order=[];
  const files=['a.zip','b.zip','c.zip'].map(zip);
  const result=await runManualZipBatch(files,{importOneZip:async file=>{active++;maxActive=Math.max(maxActive,active);order.push(file.name);await new Promise(resolve=>setTimeout(resolve,2));active--;return completed();}});
  assert.equal(maxActive,1);assert.deepEqual(order,['a.zip','b.zip','c.zip']);assert.equal(result.summary.processed,3);
});

test('omite un ZIP ya procesado mediante su checkpoint',async()=>{
  const result=await runManualZipBatch([zip('repetido.zip')],{importOneZip:async()=>({summary:{status:'already_processed',already_processed:true,added:9}})});
  assert.equal(result.summary.skipped,1);assert.equal(result.summary.processed,0);assert.equal(result.summary.added,9);
});

test('un error intermedio no detiene los ZIP siguientes',async()=>{
  const seen=[];
  const result=await runManualZipBatch(['a.zip','malo.zip','c.zip'].map(zip),{importOneZip:async file=>{seen.push(file.name);if(file.name==='malo.zip')throw new Error('ZIP dañado');return completed();}});
  assert.deepEqual(seen,['a.zip','malo.zip','c.zip']);assert.equal(result.summary.processed,2);assert.equal(result.summary.failed,1);assert.equal(result.failures[0].file,'malo.zip');
});

test('reintenta solamente los archivos fallidos seleccionados',async()=>{
  const seen=[];const files=['a.zip','malo.zip','c.zip'].map(zip);
  const result=await runManualZipBatch(files,{onlyNames:new Set(['malo.zip']),importOneZip:async file=>{seen.push(file.name);return completed(3);}});
  assert.deepEqual(seen,['malo.zip']);assert.equal(result.summary.selected,1);assert.equal(result.summary.added,3);
});

test('acepta una selección vacía sin ejecutar el importador',async()=>{
  let calls=0;const events=[];
  const result=await runManualZipBatch([],{importOneZip:async()=>{calls++;},onProgress:event=>events.push(event.stage)});
  assert.equal(calls,0);assert.deepEqual(events,['start','complete']);assert.equal(result.summary.pending,0);
});

test('consolida añadidos, actualizados, duplicados y progreso final',async()=>{
  const events=[];
  const result=await runManualZipBatch([zip('a.zip'),zip('b.zip')],{importOneZip:async file=>file.name==='a.zip'?completed(4,2):completed(3,1),onProgress:event=>events.push(event)});
  assert.equal(result.summary.added,7);assert.equal(result.summary.updated,3);assert.equal(result.summary.duplicates,3);assert.equal(result.summary.pending,0);assert.equal(events.at(-1).stage,'complete');
});
