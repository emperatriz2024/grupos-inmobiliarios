import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('persistencia demand es selectiva, incremental, por chunks y con yield',async()=>{
  const source=await readFile(new URL('../db.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('export async function saveDemandRecords'),source.indexOf('export async function getClients'));
  assert.doesNotMatch(body,/objectStore\(DEMAND_STORE\)\.getAll\(\)/);
  assert.doesNotMatch(body,/objectStore\(DEMAND_SOURCE_STORE\)\.getAll\(\)/);
  assert.match(body,/market_identity/);
  assert.match(body,/requester_identity/);
  assert.match(body,/source_reference/);
  assert.match(body,/consolidated\.changedDemands/);
  assert.match(body,/consolidated\.changedSources/);
  assert.match(body,/setTimeout\(resolve,0\)/);
});

test('ZIP conserva checkpoint de propiedades, demandas y cierre en orden',async()=>{
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const properties=source.indexOf("status:'PROPERTIES_SAVED'"),demands=source.indexOf("status:'DEMANDS_SAVED'"),completed=source.indexOf("status:'COMPLETED'",demands);
  assert.ok(properties>0&&demands>properties&&completed>demands);
  assert.match(source,/IMPORT_PHASE_RANK\.PROPERTIES_SAVED/);
  assert.match(source,/phase==='DEMANDS_SAVED'/);
  assert.match(source,/phase:'demand'/);
});
