import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../db/migrations/003_phase_0c_demand_matching_opportunity.sql',import.meta.url),'utf8');
const db=await readFile(new URL('../db.js',import.meta.url),'utf8');
const version=await readFile(new URL('../version.js',import.meta.url),'utf8');
for(const table of ['clients','demands','match_runs','match_candidates','opportunities','opportunity_scores'])if(!new RegExp(`CREATE TABLE ${table}\\b`,'i').test(sql))throw new Error(`Phase 0C incompleta: ${table}`);
if(!/const DB_VERSION = (?:8|9)/.test(db))throw new Error('IndexedDB no conserva compatibilidad 0C.');
for(const store of ['CLIENT_STORE','DEMAND_STORE','MATCH_RUN_STORE','MATCH_CANDIDATE_STORE','OPPORTUNITY_STORE','OPPORTUNITY_SCORE_STORE'])if(!new RegExp(`BACKUP_STORES[\\s\\S]*${store}`).test(db))throw new Error(`Backup sin ${store}`);
if(!/APP_VERSION='0\.7\.2-test'/.test(version)||!/APP_LABEL='V0\.7\.2 DEMAND \+ OPPORTUNITY TEST'/.test(version))throw new Error('Versión TEST 0C incorrecta.');
console.log('Phase 0C schema válido: 6 tablas SQL; IndexedDB V8+; backup V3 compatible.');
