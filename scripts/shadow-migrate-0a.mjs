import {readFile} from 'node:fs/promises';
import {buildShadowExport,validateShadowExport,validateLegacySnapshot} from '../core/radar/shadow-migration.js';

const input=process.argv[2];
if(!input){console.error('Uso: node scripts/shadow-migrate-0a.mjs <backup.json>');process.exitCode=2;}
else{
  const snapshot=JSON.parse(await readFile(input,'utf8')),source=validateLegacySnapshot(snapshot);
  if(!source.valid){console.error(JSON.stringify({status:'aborted',error:source.error}));process.exitCode=1;}
  else{const shadow=buildShadowExport(snapshot),result=validateShadowExport(shadow);console.log(JSON.stringify({status:result.valid?'validated':'aborted',source_counts:shadow.source_counts,error:result.error||null}));if(!result.valid)process.exitCode=1;}
}
