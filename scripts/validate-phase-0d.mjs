import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const sql=read('db/migrations/005_phase_0d_ready_enrichment.sql'),db=read('db.js'),engine=read('core/radar/readiness-engine.js'),version=read('version.js');
for(const table of ['readiness_assessments','enrichment_tasks','property_packages','package_media'])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
assert.match(db,/const DB_VERSION = (?:10|11|12|13|14|15)/);assert.match(db,/runOpportunityReadiness/);assert.match(db,/READINESS_STORE,ENRICHMENT_TASK_STORE,PROPERTY_PACKAGE_STORE,PACKAGE_MEDIA_STORE/);
assert.match(engine,/serializePublicProperty/);assert.match(engine,/PUBLIC_MEDIA_RIGHTS/);assert.match(engine,/scope\.opportunityIds/);
assert.match(version,/0\.7\.(?:3|4|5|6|7)-test/);assert.match(version,/V0\.7\.(?:3 READY \+ ENRICHMENT|4 CLIENT \+ BROKER TWIN|5 REVENUE OPERATIONS|6 OWNER \+ CAPTACION|7 REVENUE OS COMPLETE) TEST/);
console.log('Phase 0D architecture contract: PASS');
