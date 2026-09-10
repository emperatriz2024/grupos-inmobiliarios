import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseWhatsAppText,processChatText} from '../engine.js';
import {checkpointDisposition,importSanity,mergeSelectedZipFiles,IMPORT_ENGINE_VERSION} from '../ingestion/manual-import-state.js';
import {runManualZipBatch} from '../ingestion/manual-zip-batch.js';

const now=Date.parse('2026-09-09T12:00:00-04:00');
const realisticText='\u200e[8/21/26, 1:18:48\u202fp.\u00a0m.] Ana: En Venta Casa Campestre En Minigranjas las Morochas\nimagen omitida\n1900Mt2\n6 Hab / 6 baños / piscina / Planta 100%\n178.000$\n[8/21/26, 1:56:52\u202fp.\u00a0m.] Ana: OPORTUNIDAD EN SAN DIEGO – TOWNHOUSE EN VENTA EN RES. PUEBLO VIEJO\n124 m² terreno\n120 m² construcción\n4 habitaciones\n3 baños\n70.000$\n[8/22/26, 11:23:21\u202fa.\u00a0m.] Ana: Vendo Apartamento en La Abadia 4 San Diego\n85 m²\n3 habitaciones\n2 baños\n58.000$';

test('fixture iPhone real detecta mensajes, fecha MDY y conserva ventana de 60 días',()=>{
  const rows=parseWhatsAppText(realisticText,'SOLO SAN DIEGO',{maxAgeDays:60,now});
  assert.equal(rows.length,3);assert.equal(rows.skippedOld,0);assert.equal(rows[0].date_iso,'2026-08-21');
});
test('fixture iPhone real detecta al menos tres propiedades',()=>{
  const result=processChatText(realisticText,'SOLO SAN DIEGO',{maxAgeDays:60,now});
  assert.ok(result.properties_detected>=3);assert.ok(result.unique.length>=3);
});
test('checkpoint válido con propiedades se omite y vacío se reindexa',()=>{
  assert.equal(checkpointDisposition({status:'COMPLETED',unique:2,engine_version:IMPORT_ENGINE_VERSION}),'ALREADY_PROCESSED');
  assert.equal(checkpointDisposition({status:'COMPLETED',unique:0,detected:0,engine_version:'defectuoso'}),'REINDEX_REQUIRED');
});
test('resultado con mensajes y cero propiedades queda sospechoso',()=>{
  const sanity=importSanity({messages_total:9,messages:8,properties_detected:0,unique:[],requests_skipped:1,date_order:'MDY'});
  assert.equal(sanity.suspicious,true);assert.equal(sanity.messages_after_age_filter,8);assert.equal(sanity.parser_diagnostics.date_order,'MDY');
});
test('selección acumulativa suma aperturas y deduplica por metadatos estables',()=>{
  const f=(name,size,lastModified)=>({name,size,lastModified});
  const first=[f('a.zip',1,1),f('b.zip',2,2),f('c.zip',3,3)];
  const merged=mergeSelectedZipFiles(first,[f('d.zip',4,4),f('e.zip',5,5)]);
  assert.equal(merged.length,5);
  assert.equal(mergeSelectedZipFiles([], [f('a.zip',1,1),f('a.zip',1,1)]).length,1);
});
test('NotFoundError falla solo ese ZIP y el lote continúa',async()=>{
  const seen=[],files=['a.zip','b.zip','c.zip'].map(name=>({name,size:1,lastModified:1}));
  const result=await runManualZipBatch(files,{importOneZip:async file=>{seen.push(file.name);if(file.name==='b.zip'){const e=new DOMException('The object can not be found here.','NotFoundError');e.radarPhase='hash';throw e;}return {summary:{status:'COMPLETED',added:1}};}});
  assert.deepEqual(seen,['a.zip','b.zip','c.zip']);assert.equal(result.summary.failed,1);assert.equal(result.failures[0].phase,'hash');assert.equal(result.failures[0].name,'NotFoundError');
});
test('lote real-format reporta propiedades añadidas',async()=>{
  const result=await runManualZipBatch([{name:'SOLO SAN DIEGO.zip',size:1,lastModified:1}],{importOneZip:async()=>{const parsed=processChatText(realisticText,'SOLO SAN DIEGO',{maxAgeDays:60,now});return {summary:{status:'COMPLETED',added:parsed.unique.length}};}});
  assert.ok(result.summary.added>=3);
});
test('guard Safari no deshabilita input ni vuelve a consultar input.files al procesar',()=>{
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const fn=app.slice(app.indexOf('async function processSelectedZipBatch'),app.indexOf('async function refreshStatsOnly'));
  assert.doesNotMatch(fn,/fileInput\.disabled\s*=\s*true/);
  assert.doesNotMatch(fn,/fileInput\.files/);
});
