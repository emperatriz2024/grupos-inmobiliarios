import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runManualZipBatch,zipFailure} from '../ingestion/manual-zip-batch.js';

const file=name=>({name,size:1});

test('primer error conserva archivo, nombre, mensaje sanitizado y fase',async()=>{
  const error=new Error('falló token=secreto\nen unzip');error.name='DataCloneError';error.radarPhase='unzip';
  const result=await runManualZipBatch([file('primero.zip')],{importOneZip:async()=>{throw error;}});
  assert.deepEqual(result.failures,[{file:'primero.zip',name:'DataCloneError',message:'falló token=[oculto] en unzip',phase:'unzip'}]);
});

test('resultado válido nunca se convierte silenciosamente en fallido',async()=>{
  const result=await runManualZipBatch([file('bien.zip')],{importOneZip:async()=>({summary:{status:'COMPLETED',added:2}})});
  assert.equal(result.summary.processed,1);assert.equal(result.summary.failed,0);assert.equal(result.results[0].status,'completed');
});

test('el lote llama directamente importOneZip con File original y deferMatching',async()=>{
  const original=file('original.zip');let received,options;
  await runManualZipBatch([original],{importOneZip:async(input,_group,_progress,opts)=>{received=input;options=opts;return {summary:{status:'COMPLETED'}};}});
  assert.equal(received,original);assert.deepEqual(options,{deferMatching:true});
});

test('contrato Safari transfiere ArrayBuffer al worker y no clona File',()=>{
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const worker=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
  assert.match(app,/worker\.postMessage\(\{bytes,fileName,group,locationCatalog\},\[bytes\]\)/);
  assert.doesNotMatch(app,/worker\.postMessage\(\{file,group,locationCatalog\}\)/);
  assert.match(worker,/extractWhatsAppChat\(\{name:fileName,arrayBuffer:async\(\)=>bytes\}\)/);
});

test('zipFailure limita diagnóstico y oculta bearer',()=>{
  const row=zipFailure(file('x.zip'),Object.assign(new Error(`Bearer ${'x'.repeat(400)}`),{radarPhase:'hash'}));
  assert.equal(row.message.includes('x'.repeat(30)),false);assert.ok(row.message.length<=240);assert.equal(row.phase,'hash');
});
