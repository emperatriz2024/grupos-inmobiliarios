import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runManualZipBatch} from '../ingestion/manual-zip-batch.js';

test('batch passes filename to the actual application group normalizer',async()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const definition=source.match(/function groupFromName\(name = ''\) \{[\s\S]*?\n\}/)[0];
  const groupFromName=Function(`${definition}; return groupFromName;`)();
  let calls=0;
  const result=await runManualZipBatch([new File(['fixture'],'WhatsApp Chat - Valencia.zip')],{
    groupFromName,
    importOneZip:async(file,group)=>{calls++;assert.equal(group,'Valencia');return {summary:{status:'COMPLETED',added:1}};}
  });
  assert.equal(result.failures.length,0,JSON.stringify(result.failures));
  assert.equal(calls,1);
});
