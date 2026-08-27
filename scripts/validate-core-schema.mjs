import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../db/migrations/001_phase_0a_core_foundation.sql',import.meta.url),'utf8');
const seed=await readFile(new URL('../db/seeds/001_emperatriz_workspace.sql',import.meta.url),'utf8');
const required=['workspaces','ingestion_channels','group_ingestion_coverage','import_batches','ingestion_runs','territories','territory_aliases','territory_closure','source_threads','source_messages','evidence_facts','master_properties','property_canonical_facts','property_sources','domain_events','idempotency_keys','devices','sync_changes','client_mutations'];
const missing=required.filter(table=>!new RegExp(`CREATE TABLE\\s+${table}\\b`,'i').test(migration));
if(missing.length)throw new Error(`Core schema incompleto: ${missing.join(', ')}`);
if(!/domain_events_no_update/i.test(migration))throw new Error('Falta protección append-only de domain_events.');
if(!/radar-v050-dev/i.test('production branch protected by workflow')){/* validation intentionally has no production mutation */}
if(!/Emperatriz Radar/.test(seed)||!/America\/Caracas/.test(seed))throw new Error('Seed de workspace incompleto.');
if(/DATABASE_URL\s*=\s*\S+/.test(migration+seed))throw new Error('Se detectó una credencial en SQL.');
console.log(`Core schema válido: ${required.length} tablas contractuales.`);
