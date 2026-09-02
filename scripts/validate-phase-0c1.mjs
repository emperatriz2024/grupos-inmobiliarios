import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../db/migrations/004_phase_0c1_demand_hardening.sql',import.meta.url),'utf8'),db=await readFile(new URL('../db.js',import.meta.url),'utf8');
for(const column of ['first_seen_at','last_seen_at','expires_at'])if(!new RegExp(`ADD COLUMN ${column}\\b`,'i').test(sql))throw new Error(`004 sin ${column}`);
if(!/CREATE TABLE demand_sources\b/i.test(sql)||!/EXPIRED/.test(sql))throw new Error('004 sin provenance o EXPIRED.');
if(/DROP\s+(TABLE|COLUMN)|TRUNCATE/i.test(sql))throw new Error('004 no es aditiva.');
if(!/const DB_VERSION = (?:9|10|11|12|13)/.test(db)||!/DEMAND_SOURCE_STORE/.test(db)||!/market_identity/.test(db)||!/requester_identity/.test(db))throw new Error('IndexedDB demand scale incompleta.');
console.log('Phase 0C.1 válido: lifecycle 7 días, demand_sources, estados e índices de escala.');
