import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),sql=read('db/migrations/006_phase_0d1_readiness_hardening.sql'),db=read('db.js'),engine=read('core/radar/readiness-engine.js');
for(const token of ['is_current','superseded_at','IN_PROGRESS','RESOLVED','DISMISSED','FAILED','revoked_at'])assert.match(sql,new RegExp(token));
assert.doesNotMatch(sql,/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);assert.match(db,/const DB_VERSION = 11/);assert.match(db,/SOURCE_POST_STORE/);assert.match(db,/PROPERTY_BECAME_READY/);assert.match(db,/ENRICHMENT_TASK_RESOLVED/);assert.match(engine,/masterAvailabilityGate/);assert.match(engine,/sourceFreshness/);assert.doesNotMatch(engine,/storage_key:asset\.storage_key/);
console.log('Phase 0D.1 integrity contract: PASS');
